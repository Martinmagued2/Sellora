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
- Product Management: Create new products, update existing ones, search products, delete/archive products, check inventory, draft descriptions, get inventory alerts
- Product Images: Generate AI product images with different styles (studio, lifestyle, minimal) and automatically link them to products
- Order Management: View latest sales, update order status, get order details
- Customer Insights: Analyze customer data, show top spenders, returning customer stats
- Conversation Overview: Check recent conversations, see unread messages
- Send Messages: Send messages directly to customers via their channel (WhatsApp, Instagram, Facebook). When the seller asks to message a customer, ALWAYS use the message_customer tool — it finds the conversation and delivers the message in ONE step. Do NOT use find_conversation + send_message_to_customer separately; use message_customer instead.
- Search & Filter: Search products by name/category, filter inventory

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
          console.warn(`[Agent] Groq rate limit detected, skipping remaining Groq providers`);
        }
        // Detect Groq function calling failures — these are transient, try next provider
        if (errMsg.includes('Failed to call a function') || errMsg.includes('invalid_request_error')) {
          console.warn(`[Agent] ${providerEntry.name} had function calling error, trying next provider`);
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

    return Response.json({ error: lastError?.message || 'All AI providers failed. Please try again.' }, { status: 500 });
  } catch (error) {
    console.error("Agent API Error:", error);
    return Response.json({ error: error.message || "Something went wrong." }, { status: 500 });
  }
}
