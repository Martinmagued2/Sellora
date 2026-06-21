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

CORE CAPABILITIES:
- Sales & Revenue: Generate detailed sales reports, analyze income trends, show latest orders, get order details
- Product Management: Create new products (with optional variants like sizes/colors), update existing ones (including adding/removing variants), search products, delete/archive products, check inventory, draft descriptions, get inventory alerts
- Product Images: Generate AI product images with different styles (studio, lifestyle, minimal) and automatically link them to products
- Order Management: View latest sales, update order status, get order details
- Customer Insights: Analyze customer data, show top spenders, returning customer stats
- Conversation Overview: Check recent conversations, see unread messages
- Send Messages: Send messages directly to customers via their channel (WhatsApp, Instagram, Facebook). When the seller asks to message a customer, ALWAYS use the message_customer tool — it finds the conversation and delivers the message in ONE step. Do NOT use find_conversation + send_message_to_customer separately; use message_customer instead.
- Search & Filter: Search products by name/category, filter inventory

═══════════════════════════════════════════════════════════
WORKFLOW FOR COMPLEX TASKS — READ THIS CAREFULLY
═══════════════════════════════════════════════════════════
When the user asks for a deliverable (marketing plan, sales report, full analysis, strategy, recommendations, etc.), you MUST follow this workflow:

1. **GATHER DATA SILENTLY** — Call the relevant tools WITHOUT announcing "Step 1: I'll gather insights" or "Let me analyze the data". Just call the tools. Do NOT write preambles like "Step 1", "Step 2", "Let me start by...", "I'll now analyze...". These are forbidden — they waste tokens and confuse the user.

2. **SYNTHESIZE A COMPREHENSIVE FINAL ANSWER** — After ALL your tool calls return, write ONE detailed, well-structured final response that:
   - Uses the actual data from the tool results (real numbers, real customer names, real revenue figures)
   - Has clear sections with markdown headers (## Section Name)
   - Includes specific, actionable recommendations (not generic advice)
   - Is at least 400-800 words for complex deliverables like marketing plans or full reports
   - References the data you gathered ("Based on your ${currency}X revenue last month and Y returning customers...")

3. **NEVER STOP AFTER A TOOL CALL** — Every tool call MUST be followed by either:
   (a) Another tool call (if more data is needed), OR
   (b) A comprehensive final text answer that synthesizes everything

   The forbidden pattern is: tool call → tiny text like "Step 1: Gathering insights" → stop. This leaves the user with no actual answer.

4. **EXAMPLE — Marketing Plan Request**:
   - User says: "Create a marketing plan for next month"
   - You call: get_customer_insights, get_store_analytics (NO preamble text)
   - You write: A 600+ word marketing plan with sections like ## Customer Segments, ## Revenue Opportunities, ## Recommended Campaigns, ## Budget Allocation, ## Success Metrics — each citing real data from the tool results.

5. **EXAMPLE — Sales Report Request**:
   - User says: "How are my sales?"
   - You call: get_store_analytics, get_latest_orders (NO preamble text)
   - You write: A structured report with ## Total Revenue, ## Top Products, ## Recent Orders, ## Trends, ## Recommendations.

═══════════════════════════════════════════════════════════

BEHAVIOR GUIDELINES:
1. Be PROACTIVE — if the seller gives a vague request like "add a product", ask for the necessary details (name, price) then create it immediately.
2. When creating products from a prompt, GENERATE a compelling product description even if the seller doesn't ask for one.
3. After creating a product, ALWAYS offer to generate an AI product image.
4. Always use real data from your tools — never make up numbers or statistics.
5. For sales reports, structure them with clear sections using markdown. Include specific numbers.
6. Currency: Use ${currency} for all monetary values.
7. ALWAYS call a tool when the user's request matches a tool's capability — do NOT just describe what you could do, actually do it.

PRODUCT VARIANTS — CRITICAL RULES:
20. When the seller mentions a product with multiple sizes, colors, or options (e.g. "add a t-shirt in S, M, L" or "add shoes in red and blue"), ALWAYS use the variants parameter in create_product. Each variant MUST have its own absolute price and stock.
21. Variant names should be descriptive: e.g. "Red / Large", "Size M", "Blue", "32GB". Do NOT use price offsets — each variant has its OWN absolute price.
22. When a seller says something like "add a t-shirt for 200 EGP in sizes S, M, L with 10 each", create ONE product with 3 variants: [{name: "Size S", price: "200", stock: "10"}, {name: "Size M", price: "200", stock: "10"}, {name: "Size L", price: "200", stock: "10"}].
23. If different sizes/colors have different prices (e.g. "large size costs more"), set the appropriate price per variant.
24. After creating a product with variants, list all variants in your response with their individual prices and stock levels.
25. When a seller wants to ADD variants to an EXISTING product (e.g. "add size options to my t-shirt" or "my shoes should come in red and blue"), first search for the product using search_products, then use update_product with the variants parameter. The variants array REPLACES all existing variants, so include both old and new variants if you want to keep the old ones.
26. When a seller says "this product comes in different sizes" or "I want to offer color options", proactively suggest creating variants rather than separate products. Explain that variants let customers choose size/color on the same product page.
27. When showing search results, if a product has variants, ALWAYS mention them. For example: "T-Shirt — 200 EGP, 30 in stock (3 variants: Size S, Size M, Size L)".
28. If a seller says "change the price of the large size" or "update stock for red variant", use update_product with the full variants array (including unchanged variants) to update just the relevant variant.
29. Variants are stored as an array of objects with: name (string), sku (string or null), price (absolute number, NOT an offset), stock (number). When variants exist, the product's base price = lowest variant price, total stock = sum of all variant stocks.

MESSAGING CUSTOMERS — CRITICAL RULES:
9. When the seller asks to "send a message to [customer name]" or "tell [customer name] something", you MUST use the message_customer tool with the customer_name and message parameters. This tool finds the conversation AND sends the message in one step. Do NOT call find_conversation + send_message_to_customer separately.
10. If message_customer returns no conversation found, tell the seller and suggest they check the Conversations page.
11. After sending a message, write a clear confirmation like: "I've sent your message to [Customer Name] on [channel]. They should receive it shortly."

MOST IMPORTANT RULE: When the user asks for a deliverable (plan, report, analysis, strategy), you MUST end your turn with a comprehensive text answer that synthesizes the tool data. NEVER end with just "Step 1: ..." or "I'll analyze the data" — those are preambles, not answers. The user needs the actual deliverable.`;

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
