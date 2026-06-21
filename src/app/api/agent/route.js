import { streamText } from "ai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";
import { getPlanLimits } from "@/lib/plan-limits";
import { createClient } from "@supabase/supabase-js";
import { buildStreamingProviderChain, recordKeyFailure, recordKeySuccess } from "@/lib/ai/provider-chain";

/**
 * Sellora Agent API endpoint (alternative route).
 * Accepts a POST request with `{ messages: [...] }` and returns a streamed
 * response using available AI providers and the full agent tool set.
 * This mirrors /api/chat but is available as /api/agent for flexibility.
 */

// Lazy-init Supabase admin client to avoid build-time errors
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
  try {
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
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Plan-based rate limiting (same as /api/chat) ───
    const { data: account } = await getAdminClient()
      .from("accounts")
      .select("plan, business_name, country, currency")
      .eq("id", user.id)
      .single();

    const planLimits = getPlanLimits(account?.plan || "starter");
    const maxMsgs = planLimits.copilot_msgs_per_day;

    if (maxMsgs === 0) {
      return Response.json({ error: "Sellora Agent is not available on your current plan. Please upgrade." }, { status: 403 });
    }

    // Rate limit check (skip in development)
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

    // Log rate limit in production
    if (process.env.NODE_ENV === "production") {
      await getAdminClient().from("rate_limits").insert({
        email: user.email,
        action: "copilot_msg",
      });
    }

    const businessName = account?.business_name || "this store";
    const currency = account?.currency || "EGP";

    const body = await req.json();
    const coreMessages = (body.messages || []).map((msg) => {
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
      return { role: msg.role, content: content || "" };
    });

    const systemPrompt = `You are Sellora Agent, an intelligent AI business assistant for the owner of "${businessName}".

YOU ARE NOT A CHATBOT — you are an AGENTIC AI that takes ACTION. You have tools to fetch real data, create products, generate reports, manage orders, and run the store. Always use your tools when relevant.

CRITICAL RULES — READ FIRST:
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

User: "Add a t-shirt for 200 EGP"
RIGHT: [call create_product] → write "✅ Created T-Shirt for 200 EGP with 0 stock. Want me to generate an AI image or adjust the stock?"

CALL MULTIPLE TOOLS IN PARALLEL when independent. For "marketing plan", call get_customer_insights AND get_store_analytics at the same time — don't call them sequentially.

CORE CAPABILITIES:
- Sales & Revenue: get_store_analytics, get_sales_report, get_latest_sales, get_order_details
- Products: create_product (with variants), update_product, search_products, get_inventory_alerts
- Product Images: generate_product_image (styles: studio, lifestyle, minimal)
- Customers: get_customer_insights (totals, top spenders, channel distribution)
- Messaging: message_customer (finds conversation + sends in one step)

After EVERY tool call, you MUST write a detailed text response:
- For deliverables (plans/reports): 400-800 words with markdown headers, real data, specific recommendations
- For actions (create/update): confirmation + offer next steps
- For queries: actual answer with the data

PRODUCT VARIANTS:
- "T-shirt in S/M/L for 200 EGP, 10 each" → ONE product, 3 variants: [{name:"Size S",price:"200",stock:"10"},{name:"Size M",price:"200",stock:"10"},{name:"Size L",price:"200",stock:"10"}]
- Each variant has its OWN absolute price (not offsets)
- To add variants to existing product: search_products → update_product (variants array REPLACES existing)

MESSAGING:
- Use message_customer(customer_name, message) — ONE step, not find+send
- After sending: "I've sent your message to [Name] on [channel]."

Currency: ${currency}

MOST IMPORTANT: The user must ALWAYS see the actual deliverable or answer. Never end your turn with a preamble. If you called tools, you MUST follow with the real answer.`;

    // Build provider fallback chain using unified module (multi-key + health tracking)
    const providerModels = buildStreamingProviderChain();

    if (providerModels.length === 0) {
      return Response.json({ error: "No AI provider configured. Add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY." }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);

    // Try each provider with tools (streaming) — smart per-key failover
    let lastError = null;

    for (const providerEntry of providerModels) {
      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 15,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
          tools,
        });

        console.log(`[Agent] ${providerEntry.name} stream started`);
        if (providerEntry._provider !== undefined) recordKeySuccess(providerEntry._provider, providerEntry._keyIndex);
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        lastError = providerError;
        const errMsg = providerError?.message || '';
        console.warn(`[Agent] ${providerEntry.name} failed:`, errMsg.substring(0, 200));
        if (providerEntry._provider !== undefined) recordKeyFailure(providerEntry._provider, providerEntry._keyIndex, providerError);
      }
    }

    // Fallback without tools
    console.warn("[Agent] All providers with tools failed, trying without tools...");
    for (const providerEntry of providerModels) {
      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 1,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
        });

        console.log(`[Agent] ${providerEntry.name} stream started without tools`);
        if (providerEntry._provider !== undefined) recordKeySuccess(providerEntry._provider, providerEntry._keyIndex);
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        console.warn(`[Agent] ${providerEntry.name} without tools also failed:`, providerError?.message?.substring(0, 120));
        if (providerEntry._provider !== undefined) recordKeyFailure(providerEntry._provider, providerEntry._keyIndex, providerError);
      }
    }

    console.error('Agent API Error: all providers failed');
    return Response.json({ error: lastError?.message || 'All AI providers failed. Please try again.' }, { status: 500 });
  } catch (err) {
    console.error("Agent API error:", err);
    return Response.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
