import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";
import { getPlanLimits } from "@/lib/plan-limits";
import { createClient } from "@supabase/supabase-js";

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

    const body = await req.json();

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
- Search & Filter: Search products by name/category, filter inventory

DASHBOARD NAVIGATION GUIDE:
You know exactly where everything is in the Sellora dashboard. When the seller asks "where can I find X?" or "how do I change Y?", answer directly with the exact location. Be specific — mention the page and the tab/section.

**Settings Page** (/dashboard/settings) has 11 tabs:
- **Profile tab** → Business name, logo, country, currency, contact info
- **Channels tab** → Connect/manage WhatsApp, Instagram, Facebook pages
- **Auto-Replies tab** → Configure automatic reply rules for customer messages
- **Policies tab** → Shipping policy, return policy, privacy policy
- **FAQs tab** → Add/edit FAQ entries that the AI uses to answer customer questions
- **Quick Replies tab** → Saved response templates (with /shortcut triggers in chat)
- **Automation tab** → Auto-greeting, order status updates, follow-up messages
- **Webhooks tab** → Register outbound webhooks for events (order.created, etc.)
- **Team tab** → Invite team members, manage roles
- **Notifications tab** → Configure email and push notification preferences
- **Security tab** → Enable/disable 2FA (TOTP), change password, backup codes

**Other Dashboard Pages:**
- /dashboard → Home overview with KPIs, AI activity, quick actions
- /dashboard/conversations → Unified inbox for all channels (WhatsApp, Instagram, Facebook). Type / in the message box for quick replies.
- /dashboard/orders → Order management — list, filter, update status
- /dashboard/products → Product catalog — add, edit, delete products, variants, images
- /dashboard/customers → Customer database with tags, purchase history
- /dashboard/campaigns → Broadcast messaging campaigns
- /dashboard/coupons → Create and manage discount codes
- /dashboard/analytics → Sales reports, customer analytics, AI performance, funnel
- /dashboard/automation → Configure auto-greeting, order notifications, follow-ups
- /dashboard/ai-personality → Customize AI agent name, personality, tone, escalation rules
- /dashboard/abandoned-carts → Detected abandoned carts with reminder sending
- /dashboard/segments → Dynamic customer segmentation
- /dashboard/billing → Subscription plan, Stripe billing portal
- /dashboard/whatsapp-catalog → Sync products to WhatsApp Commerce catalog
- /dashboard/shipping → Shipment tracking with AfterShip
- /dashboard/webhooks → Outbound webhook management and delivery logs
- /dashboard/stores → Multi-store management and switching
- /dashboard/notifications → In-app notification center

**Common "Where is...?" Quick Reference:**
- "Where is 2FA / two-factor?" → Settings → Security tab (/dashboard/settings?tab=security)
- "Where do I change my password?" → Settings → Security tab (/dashboard/settings?tab=security)
- "Where do I connect WhatsApp/Instagram/Facebook?" → Settings → Channels tab (/dashboard/settings?tab=channels)
- "Where do I change AI personality or name?" → AI Personality page (/dashboard/ai-personality)
- "Where do I add FAQs for the AI?" → Settings → FAQs tab (/dashboard/settings?tab=faqs)
- "Where do I set up auto-replies?" → Settings → Auto-Replies tab (/dashboard/settings?tab=autoreplies)
- "Where do I manage quick replies?" → Settings → Quick Replies tab (/dashboard/settings?tab=quickreplies)
- "Where do I set up automation?" → Automation page (/dashboard/automation) or Settings → Automation tab
- "Where do I change business name or currency?" → Settings → Profile tab (/dashboard/settings?tab=profile)
- "Where do I add team members?" → Settings → Team tab (/dashboard/settings?tab=team)
- "Where do I find my coupons?" → Coupons page (/dashboard/coupons)
- "Where do I see abandoned carts?" → Abandoned Carts page (/dashboard/abandoned-carts)
- "Where do I manage webhooks?" → Webhooks page (/dashboard/webhooks) or Settings → Webhooks tab
- "Where do I change my plan or billing?" → Billing page (/dashboard/billing)
- "Where do I set up shipping?" → Shipping page (/dashboard/shipping)
- "Where do I manage customer segments?" → Segments page (/dashboard/segments)
- "Where do I find order tracking?" → Orders page (/dashboard/orders) for management, Shipping page (/dashboard/shipping) for shipment tracking
- "Where do I see analytics or reports?" → Analytics page (/dashboard/analytics)
- "Where do I send a broadcast?" → Campaigns page (/dashboard/campaigns)
- "Where do I sync WhatsApp catalog?" → WhatsApp Catalog page (/dashboard/whatsapp-catalog)
- "Where do I manage notifications?" → Settings → Notifications tab or /dashboard/notifications
- "Where do I set return/shipping policy?" → Settings → Policies tab (/dashboard/settings?tab=policies)
- "Where do I see conversations or messages?" → Conversations page (/dashboard/conversations)

BEHAVIOR GUIDELINES:
1. Be PROACTIVE — if the seller gives a vague request like "add a product", ask for the necessary details (name, price) then create it immediately.
2. ALWAYS write a detailed, well-formatted text response AFTER every tool call. Never just call a tool and stop — you MUST explain the results to the user in detail. This is critical — the user MUST see your text reply.
3. When creating products from a prompt, GENERATE a compelling product description even if the seller doesn't ask for one.
4. After creating a product, ALWAYS offer to generate an AI product image. Say something like "Would you like me to generate a product image for this?" If they say yes, call generate_product_image with the product ID and name. If they included style preferences (lifestyle, minimal), use those.
5. When the seller asks to "add a product with image" or "create product and generate image", create the product FIRST, then immediately call generate_product_image with the returned product ID.
6. Always use real data from your tools — never make up numbers or statistics.
7. For sales reports, structure them with clear sections using markdown: **Revenue Summary**, **Order Breakdown**, **Top Products**, **Payment Methods**, and **Recommendations**. Include specific numbers and percentages.
8. Currency: Use ${currency} for all monetary values.
9. When the seller asks "how are my sales?" or "give me a report", use get_sales_report for detailed analysis, not just get_store_analytics.
10. After performing an action (like creating a product), confirm what was done in detail, then mention they can click the action button to navigate to the relevant page.
11. When asked to update an order, confirm the order details before updating the status.
12. For inventory issues, use get_inventory_alerts to show out-of-stock and low-stock products proactively. List each affected product by name.
13. ALWAYS call a tool when the user's request matches a tool's capability — do NOT just describe what you could do, actually do it.
14. For customer insights, break down the data: total customers, returning vs new, top spenders with amounts, channel distribution — make it actionable.
15. When generating product images, if the user doesn't specify a style, use "studio" (clean white background) as default. Describe the generated image to the user and confirm it was linked to the product.
16. When the seller asks to create a coupon or discount code, use the create_coupon tool. If they say "20% off", set type to "percentage" and value to "20". If they say "50 EGP off", set type to "fixed" and value to "50". If they say "free shipping", set type to "free_shipping" and value to "0". After creating a coupon, confirm the code, discount, and any conditions.
17. When updating a product by name (e.g. "update the Red T-shirt stock to 42"), use the update_product tool with the product_name parameter instead of product_id. The tool will automatically find the product by name. Do NOT make up a UUID — use product_name for name-based lookups.
18. When the seller asks "where can I find X?" or "how do I change Y?" or "where is X setting?", use the DASHBOARD NAVIGATION GUIDE above. Give a direct, specific answer with the exact page and tab. If the seller says "take me there" or "yes, go there" or "open it", use the navigate_to tool with the correct path and a descriptive label. Do NOT try to call goto_url or any other non-existent tool — only use navigate_to for navigation.

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
16. When the seller asks to "send a message to [customer name]" or "tell [customer name] something" or "remind [customer name]", you MUST use the message_customer tool with the customer_name and message parameters. This tool finds the conversation AND sends the message in one step. Do NOT call find_conversation + send_message_to_customer separately.
17. If message_customer returns no conversation found, tell the seller and suggest they check the Conversations page.
18. If message_customer returns an error (e.g., channel not connected), clearly tell the seller what went wrong and suggest they reconnect the channel in Settings.
19. After sending a message, write a clear confirmation like: "I've sent your message to [Customer Name] on [channel]. They should receive it shortly."

CRITICAL RULE: After EVERY tool call, you MUST write a detailed text response explaining the results. Do NOT just return tool results silently. The user needs to READ your analysis. Write at least 3-5 sentences analyzing the data from every tool call. Use bullet points, bold text, and clear formatting.

MOST IMPORTANT: You MUST ALWAYS generate a text response. Even if you call tools, you must also write explanatory text that the user can read. Never return only tool results without a text explanation.`;

    // Build provider model list with fallback chain
    const providerModels = [];

    if (process.env.GROQ_API_KEY) {
      providerModels.push({ name: 'groq-llama70b', model: groq('llama-3.3-70b-versatile') });
      providerModels.push({ name: 'groq-llama8b', model: groq('llama-3.1-8b-instant') });
      providerModels.push({ name: 'groq-mixtral', model: groq('mixtral-8x7b-32768') });
    }

    if (process.env.VECTORENGINE_API_KEY) {
      const customOpenAI = createOpenAI({
        apiKey: process.env.VECTORENGINE_API_KEY,
        baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
        compatibility: "compatible",
      });
      providerModels.push({ name: 'vectorengine', model: customOpenAI('gpt-5.5-pro') });
    }

    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
      providerModels.push({ name: 'google-flash', model: google('gemini-2.0-flash') });
      providerModels.push({ name: 'google-flash-lite', model: google('gemini-2.0-flash-lite') });
    }

    if (process.env.OPENAI_API_KEY) {
      const { openai } = await import('@ai-sdk/openai');
      providerModels.push({ name: 'openai', model: openai('gpt-4o-mini') });
    }

    // NVIDIA NIM
    if (process.env.NVIDIA_API_KEY) {
      const nvidia = createOpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
        compatibility: 'compatible',
      });
      providerModels.push({ name: 'nvidia-llama33-70b', model: nvidia('meta/llama-3.3-70b-instruct') });
      providerModels.push({ name: 'nvidia-nemotron-70b', model: nvidia('nvidia/llama-3.1-nemotron-70b-instruct') });
      providerModels.push({ name: 'nvidia-deepseek-r1', model: nvidia('deepseek-ai/deepseek-r1') });
      providerModels.push({ name: 'nvidia-mistral-large', model: nvidia('mistralai/mistral-large-2-instruct') });
    }

    if (providerModels.length === 0) {
      return Response.json({ error: 'AI is not configured. Please add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file.' }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);

    // ─── Use streamText for proper streaming with useChat ───
    // streamText produces the correct stream format that the useChat hook
    // can parse, including both tool calls AND text responses.
    // Error handling: If streamText fails at the start (rate limit, auth error),
    // it throws before we return the response, so we can fall back to the next provider.
    // Mid-stream errors cannot be caught (same trade-off as /api/agent/route.js),
    // but initial errors (most common) are handled properly.

    let groqRateLimited = false;
    let lastError = null;
    let lastErrorType = 'unknown'; // Track error type for better messages

    // Attempt 1: Try each provider with tools (streaming)
    for (const providerEntry of providerModels) {
      if (groqRateLimited && providerEntry.name.startsWith('groq-')) {
        console.warn(`[Agent] Skipping ${providerEntry.name} because Groq rate limit was already hit`);
        continue;
      }

      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 5,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
          tools,
        });

        console.log(`[Agent] ${providerEntry.name} stream started successfully`);
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        lastError = providerError;
        const errMsg = providerError?.message || '';
        console.warn(`[Agent] ${providerEntry.name} failed:`, errMsg.substring(0, 200));

        // Detect Groq rate limit — mark all Groq providers as unavailable
        if (errMsg.includes('Rate limit') && providerEntry.name.startsWith('groq-')) {
          groqRateLimited = true;
          lastErrorType = 'rate_limit';
          console.warn(`[Agent] Groq rate limit detected, skipping remaining Groq providers`);
        }
        // Detect Groq function calling failures — these are transient, try next provider
        if (errMsg.includes('Failed to call a function') || errMsg.includes('invalid_request_error')) {
          lastErrorType = 'function_error';
          console.warn(`[Agent] ${providerEntry.name} had function calling error, trying next provider`);
        }
        // Detect auth errors
        if (errMsg.includes('Invalid API Key') || errMsg.includes('Unauthorized') || errMsg.includes('authentication')) {
          lastErrorType = 'auth_error';
        }
        // Detect server errors / overload
        if (errMsg.includes('overloaded') || errMsg.includes('503') || errMsg.includes('500')) {
          lastErrorType = 'server_error';
        }
      }
    }

    // Attempt 2: Fallback — stream WITHOUT tools
    console.warn("[Agent] All providers with tools failed, trying without tools...");
    for (const providerEntry of providerModels) {
      if (groqRateLimited && providerEntry.name.startsWith('groq-')) {
        continue;
      }

      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 1,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
        });

        console.log(`[Agent] ${providerEntry.name} stream started without tools`);
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        console.warn(`[Agent] ${providerEntry.name} without tools also failed:`, providerError?.message?.substring(0, 120) || providerError);
      }
    }

    // Return a user-friendly error message based on the error type
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
