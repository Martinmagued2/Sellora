import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";

/**
 * Sellora Agent API endpoint (alternative route).
 * Accepts a POST request with `{ messages: [...] }` and returns a streamed
 * response using available AI providers and the full agent tool set.
 * This mirrors /api/chat but is available as /api/agent for flexibility.
 */
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

    // Fetch account info for personalization
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: account } = await adminClient
      .from("accounts")
      .select("business_name, currency")
      .eq("id", user.id)
      .single();

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

BEHAVIOR GUIDELINES:
1. Be PROACTIVE — if the seller gives a vague request like "add a product", ask for the necessary details (name, price) then create it immediately.
2. ALWAYS write a detailed, well-formatted text response AFTER every tool call. Never just call a tool and stop — you MUST explain the results to the user in detail. This is critical — the user MUST see your text reply.
3. When creating products from a prompt, GENERATE a compelling product description even if the seller doesn't ask for one.
4. After creating a product, ALWAYS offer to generate an AI product image.
5. Always use real data from your tools — never make up numbers or statistics.
6. For sales reports, structure them with clear sections using markdown. Include specific numbers.
7. Currency: Use ${currency} for all monetary values.
8. ALWAYS call a tool when the user's request matches a tool's capability — do NOT just describe what you could do, actually do it.

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

CRITICAL RULE: After EVERY tool call, you MUST write a detailed text response explaining the results. Do NOT just return tool results silently. The user needs to READ your analysis. Write at least 3-5 sentences analyzing the data from every tool call.

MOST IMPORTANT: You MUST ALWAYS generate a text response. Even if you call tools, you must also write explanatory text that the user can read. Never return only tool results without a text explanation.`;

    // Build provider fallback chain
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

    if (process.env.NVIDIA_API_KEY) {
      const nvidia = createOpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
        compatibility: 'compatible',
      });
      providerModels.push({ name: 'nvidia-llama33-70b', model: nvidia('meta/llama-3.3-70b-instruct') });
      providerModels.push({ name: 'nvidia-nemotron-70b', model: nvidia('nvidia/llama-3.1-nemotron-70b-instruct') });
    }

    if (providerModels.length === 0) {
      return Response.json({ error: "No AI provider configured. Add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY." }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);

    // Try each provider with tools (streaming)
    let groqRateLimited = false;
    let lastError = null;

    for (const providerEntry of providerModels) {
      if (groqRateLimited && providerEntry.name.startsWith('groq-')) {
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

        console.log(`[Agent] ${providerEntry.name} stream started`);
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        lastError = providerError;
        const errMsg = providerError?.message || '';
        console.warn(`[Agent] ${providerEntry.name} failed:`, errMsg.substring(0, 200));

        if (errMsg.includes('Rate limit') && providerEntry.name.startsWith('groq-')) {
          groqRateLimited = true;
        }
      }
    }

    // Fallback without tools
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
        console.warn(`[Agent] ${providerEntry.name} without tools also failed:`, providerError?.message?.substring(0, 120));
      }
    }

    console.error('Agent API Error: all providers failed');
    return Response.json({ error: lastError?.message || 'All AI providers failed. Please try again.' }, { status: 500 });
  } catch (err) {
    console.error("Agent API error:", err);
    return Response.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
