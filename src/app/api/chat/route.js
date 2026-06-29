import { streamText } from "ai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";
import { getPlanLimits } from "@/lib/plan-limits";
import { createClient } from "@supabase/supabase-js";
import { buildStreamingProviderChain, recordKeyFailure, recordKeySuccess } from "@/lib/ai/provider-chain";

// Lazy-init Supabase admin client to avoid build-time errors (env vars not available during build)
let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function POST(req) {
  const requestStart = Date.now();
  console.log(`[ChatAPI] === New request ===`);
  try {
    // ─── Check Supabase env vars first ───
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("[ChatAPI] CRITICAL: Missing Supabase env vars");
      return Response.json({ error: "Server configuration error: Supabase not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." }, { status: 500 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn(`[ChatAPI] Auth failed: ${authError?.message || 'no user'} (${Date.now() - requestStart}ms)`);
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[ChatAPI] Auth OK: user=${user.email} (${Date.now() - requestStart}ms)`);

    const body = await req.json();

    const { data: account, error: accountError } = await getAdminClient()
      .from("accounts")
      .select("plan, business_name, country, currency")
      .eq("id", user.id)
      .single();

    if (accountError) {
      console.error(`[ChatAPI] Account lookup failed: ${accountError.message} (${Date.now() - requestStart}ms)`);
      return Response.json({ error: "Could not load your account. Please try again." }, { status: 500 });
    }

    const planLimits = getPlanLimits(account?.plan || "starter");
    const maxMsgs = planLimits.copilot_msgs_per_day;
    console.log(`[ChatAPI] Plan: ${account?.plan}, maxMsgs: ${maxMsgs} (${Date.now() - requestStart}ms)`);

    if (maxMsgs === 0) {
      return Response.json({ error: "Sellora Agent is not available on your current plan. Please upgrade." }, { status: 403 });
    }

    // Basic rate limit check (skip in development)
    if (maxMsgs !== -1 && process.env.NODE_ENV === "production") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await getAdminClient()
        .from("rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("email", user.email)
        .eq("action", "copilot_msg")
        .gte("created_at", oneDayAgo);

      if (count >= maxMsgs) {
        return Response.json({ error: "Daily Agent limit reached. Upgrade for more." }, { status: 429 });
      }
    }

    // Only log rate limits in production
    if (process.env.NODE_ENV === "production") {
      await getAdminClient().from("rate_limits").insert({
        email: user.email,
        action: "copilot_msg",
      });
    }

    const { messages } = body;
    const coreMessages = (messages || []).map((msg) => {
      let content = "";
      if (msg.parts && Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("");
      }
      if (!content && typeof msg.content === "string") {
        content = msg.content;
      }
      return {
        role: msg.role === "user" ? "user" : "assistant",
        content: content || "",
      };
    });

    const businessName = account?.business_name || "this store";
    const currency = account?.currency || "EGP";

    const systemPrompt = `You are Sellora Agent, an intelligent AI business assistant for the owner of "${businessName}".

YOU ARE NOT A CHATBOT — you are an AGENTIC AI that takes ACTION. You have tools to fetch real data, create products, generate reports, manage orders, and run the store. Always use your tools when relevant.

CORE CAPABILITIES:
- Sales & Revenue: Generate detailed sales reports, analyze income trends, show latest orders, get order details
- Product Management: Create new products (with optional variants like sizes/colors), update existing ones, search products, delete/archive products, check inventory, draft descriptions, get inventory alerts
- Product Images: Generate AI product images with different styles (studio, lifestyle, minimal) and automatically link them to products
- Order Management: View latest sales, update order status, get order details
- Customer Insights: Analyze customer data, show top spenders, returning customer stats
- Conversation Overview: Check recent conversations, see unread messages
- Send Messages: Send messages directly to customers via their channel (WhatsApp, Instagram, Facebook). When the seller asks to message a customer, ALWAYS use the message_customer tool — it finds the conversation and delivers the message in ONE step. Do NOT use find_conversation + send_message_to_customer separately; use message_customer instead.
- Coupon Management: Create new coupon codes (percentage off, fixed amount off, free shipping), list existing coupons, with plan limit enforcement
- Plan Comparison: Compare Starter, Professional, and Business plans. When the seller asks about plans, pricing, plan limits, upgrading, or "what's the difference between plans", ALWAYS use the compare_plans tool. Do NOT fire off unrelated tools like analytics or inventory — just use compare_plans and then explain the results clearly.
- Search & Filter: Search products by name/category, filter inventory

APP NAVIGATION: When the seller asks "where is X?" or "go to Y", use the navigate_to tool. Key pages: /dashboard, /dashboard/conversations, /dashboard/orders, /dashboard/products, /dashboard/customers, /dashboard/campaigns, /dashboard/coupons, /dashboard/analytics, /dashboard/settings, /dashboard/billing, /admin.


═══════════════════════════════════════════════════════════
CRITICAL RULES — READ FIRST
═══════════════════════════════════════════════════════════
1. NEVER write preambles like "Step 1", "Let me gather", "I'll analyze", "First, I'll", "To do this, I'll". These are BANNED.
2. When the user asks for a deliverable (plan, report, analysis, strategy), you MUST:
   a. Call the relevant tools FIRST (no text before the tool call)
   b. After tools return, write the FULL deliverable (400-800 words, with ## markdown headers)
3. NEVER stop after a tool call without writing the full deliverable. If you called a tool, you MUST follow it with the complete answer.
4. The user must see the actual plan/report — not "I'll create a plan" or "Step 1: gathering data".

WORKFLOW EXAMPLES:

User: "Create a marketing plan for next month"
WRONG (banned): "I'll create a marketing plan. First, let me gather customer insights..." [calls tool] [stops]
RIGHT: [silently call get_customer_insights + get_store_analytics in parallel] → after both return → write a 600+ word plan with sections: ## Customer Segments, ## Revenue Opportunities, ## Recommended Campaigns, ## Budget Allocation, ## Success Metrics — citing real numbers from tool results.

User: "How are my sales?"
WRONG: "Let me pull up your sales data..." [calls tool] [stops]
RIGHT: [call get_store_analytics + get_latest_orders] → write ## Total Revenue, ## Top Products, ## Recent Orders, ## Trends, ## Recommendations.

CALL MULTIPLE TOOLS IN PARALLEL when independent. For "marketing plan", call get_customer_insights AND get_store_analytics at the same time — don't call them sequentially.
═══════════════════════════════════════════════════════════

MOST IMPORTANT RULE: When the user asks for a deliverable (plan, report, analysis, strategy), you MUST end your turn with a comprehensive text answer that synthesizes the tool data. NEVER end with just "Step 1: ..." or "I'll analyze the data" — those are preambles, not answers. The user needs the actual deliverable.`;

    // Build provider model list using unified chain (multi-key + health tracking)
    const providerModels = buildStreamingProviderChain();
    console.log(`[ChatAPI] Provider chain: ${providerModels.length} providers available [${providerModels.map(p => p.name).join(', ')}] (${Date.now() - requestStart}ms)`);

    if (providerModels.length === 0) {
      console.error("[ChatAPI] No AI providers available! Check env vars: GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, etc.");
      return Response.json({ error: 'AI is not configured. Please add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file. Visit /api/ai/status for diagnostics.' }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);

    // ─── Use streamText for proper streaming with useChat ───
    // streamText produces the correct stream format that the useChat hook
    // can parse, including both tool calls AND text responses.
    // Error handling: If streamText fails at the start (rate limit, auth error),
    // it throws before we return the response, so we can fall back to the next provider.
    // Mid-stream errors cannot be caught (same trade-off as /api/agent/route.js),
    // but initial errors (most common) are handled properly.

    let lastError = null;
    let lastErrorType = 'unknown'; // Track error type for better messages

    // Attempt 1: Try each provider with tools (streaming)
    console.log(`[ChatAPI] Starting provider failover chain...`);
    for (const providerEntry of providerModels) {
      try {
        console.log(`[ChatAPI] Trying ${providerEntry.name}...`);
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 15,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
          tools,
        });

        console.log(`[ChatAPI] ✅ ${providerEntry.name} stream started successfully (${Date.now() - requestStart}ms)`);
        // ✅ Success — mark key as healthy
        if (providerEntry._provider !== undefined) recordKeySuccess(providerEntry._provider, providerEntry._keyIndex);
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        lastError = providerError;
        const errMsg = providerError?.message || '';
        console.warn(`[ChatAPI] ❌ ${providerEntry.name} failed: ${errMsg.substring(0, 200)} (${Date.now() - requestStart}ms)`);
        // ❌ Failure — record it for smart failover
        if (providerEntry._provider !== undefined) recordKeyFailure(providerEntry._provider, providerEntry._keyIndex, providerError);

        // Detect error type for user-friendly messages
        if (errMsg.includes('Rate limit') || errMsg.includes('429') || errMsg.includes('too many requests')) {
          lastErrorType = 'rate_limit';
        } else if (errMsg.includes('Invalid API Key') || errMsg.includes('Unauthorized') || errMsg.includes('authentication') || errMsg.includes('401') || errMsg.includes('403')) {
          lastErrorType = 'auth_error';
        } else if (errMsg.includes('overloaded') || errMsg.includes('503') || errMsg.includes('500')) {
          lastErrorType = 'server_error';
        } else if (errMsg.includes('Failed to call a function') || errMsg.includes('invalid_request_error')) {
          lastErrorType = 'function_error';
        }
      }
    }

    // Attempt 2: Fallback — stream WITHOUT tools
    console.warn(`[ChatAPI] ⚠️ All ${providerModels.length} providers with tools failed, trying without tools...`);
    for (const providerEntry of providerModels) {
      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 1,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
        });

        console.log(`[ChatAPI] ✅ ${providerEntry.name} stream started without tools (${Date.now() - requestStart}ms)`);
        if (providerEntry._provider !== undefined) recordKeySuccess(providerEntry._provider, providerEntry._keyIndex);
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        console.warn(`[ChatAPI] ❌ ${providerEntry.name} without tools also failed: ${providerError?.message?.substring(0, 120)}`);
        if (providerEntry._provider !== undefined) recordKeyFailure(providerEntry._provider, providerEntry._keyIndex, providerError);
      }
    }

    // Return a user-friendly error message based on the error type
    console.error(`[ChatAPI] 💀 All providers exhausted. Last error: ${lastError?.message?.substring(0, 200)}. Visit /api/ai/status for diagnostics.`);
    let userMessage;
    switch (lastErrorType) {
      case 'rate_limit':
        userMessage = 'Daily AI usage limit reached. Please try again in a few minutes when the limit resets.';
        break;
      case 'auth_error':
        userMessage = 'AI service configuration issue. Please check your API keys.';
        break;
      case 'server_error':
        userMessage = 'AI service is temporarily overloaded. Please try again shortly.';
        break;
      case 'function_error':
        userMessage = 'AI had trouble processing the request. Please try again or rephrase your message.';
        break;
      default:
        userMessage = 'All AI providers are currently unavailable. Please try again in a few minutes.';
        break;
    }

    return Response.json({ error: userMessage }, { status: 500 });
  } catch (error) {
    console.error("Agent API Error:", error);
    return Response.json({ error: error.message || "Something went wrong." }, { status: 500 });
  }
}
