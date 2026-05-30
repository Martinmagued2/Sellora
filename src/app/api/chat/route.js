import { generateText, createUIMessageStream, createUIMessageStreamResponse } from "ai";
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
- 📊 Sales & Revenue: Generate detailed sales reports, analyze income trends, show latest orders, get order details
- 📦 Product Management: Create new products, update existing ones, search products, delete/archive products, check inventory, draft descriptions, get inventory alerts
- 🎨 Product Images: Generate AI product images with different styles (studio, lifestyle, minimal) and automatically link them to products
- 🛒 Order Management: View latest sales, update order status, get order details
- 👥 Customer Insights: Analyze customer data, show top spenders, returning customer stats
- 💬 Conversation Overview: Check recent conversations, see unread messages
- 🔍 Search & Filter: Search products by name/category, filter inventory

BEHAVIOR GUIDELINES:
1. Be PROACTIVE — if the seller gives a vague request like "add a product", ask for the necessary details (name, price) then create it immediately.
2. ALWAYS write a detailed, well-formatted text response AFTER every tool call. Never just call a tool and stop — you MUST explain the results to the user in detail.
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

CRITICAL RULE: After EVERY tool call, you MUST write a detailed text response explaining the results. Do NOT just return tool results silently. The user needs to READ your analysis. Write at least 3-5 sentences analyzing the data from every tool call. Use bullet points, bold text, and clear formatting.`;

    // Build provider model list with fallback chain
    // Each Groq model has its own rate limit, so we add multiple as fallbacks.
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

    if (providerModels.length === 0) {
      return Response.json({ error: 'AI is not configured. Please add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file.' }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);

    // ─── Use generateText for reliable error handling ───
    // generateText fully completes before returning, so rate limit errors
    // and other API errors are caught in try/catch and we can fall back
    // to the next provider. streamText does NOT support this because errors
    // surface mid-stream after the response headers are already sent.

    let lastError = null;
    let groqRateLimited = false; // Skip remaining Groq providers after rate limit

    // Attempt 1: Try each provider with tools
    for (const providerEntry of providerModels) {
      // If Groq was rate-limited, skip all remaining Groq providers
      if (groqRateLimited && providerEntry.name.startsWith('groq-')) {
        console.warn(`[Agent] Skipping ${providerEntry.name} because Groq rate limit was already hit`);
        continue;
      }

      try {
        const result = await generateText({
          model: providerEntry.model,
          maxSteps: 5,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
          tools,
        });

        console.log(`[Agent] ${providerEntry.name} succeeded (${result.steps.length} steps, text: ${result.text?.length || 0} chars)`);

        // Build the UI message stream from the generateText result.
        // Key: write each step's chunks in the correct order —
        // tool calls first, then tool results, then text for that step.
        // Each text section gets its own text-start/text-end pair.
        const stream = createUIMessageStream({
          execute: ({ writer }) => {
            for (const [stepIndex, step] of result.steps.entries()) {
              // 1. Write tool calls for this step
              for (const toolCall of step.toolCalls || []) {
                writer.write({
                  type: 'tool-input-start',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                });
                writer.write({
                  type: 'tool-input-available',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  input: toolCall.args,
                });
              }

              // 2. Write tool results for this step
              for (const toolResult of step.toolResults || []) {
                writer.write({
                  type: 'tool-output-available',
                  toolCallId: toolResult.toolCallId,
                  output: toolResult.result,
                });
              }

              // 3. Write step text (each step gets its own text-start/end pair)
              const stepText = step.text || "";
              const isLastStep = stepIndex === result.steps.length - 1;
              // For the last step, use result.text which is the canonical text
              const textToWrite = isLastStep ? (result.text || stepText) : stepText;

              if (textToWrite) {
                const textId = `txt-${stepIndex}-${Date.now()}`;
                writer.write({ type: 'text-start', id: textId });
                writer.write({ type: 'text-delta', id: textId, delta: textToWrite });
                writer.write({ type: 'text-end', id: textId });
              }
            }
          },
        });

        return createUIMessageStreamResponse({ stream });
      } catch (providerError) {
        lastError = providerError;
        const errMsg = providerError?.message || '';
        console.warn(`[Agent] ${providerEntry.name} failed:`, errMsg.substring(0, 200));

        // Detect Groq rate limit — mark all Groq providers as unavailable
        if (errMsg.includes('Rate limit') && providerEntry.name.startsWith('groq-')) {
          groqRateLimited = true;
          console.warn(`[Agent] Groq rate limit detected, skipping remaining Groq providers`);
        }
      }
    }

    // Attempt 2: Fallback - generate WITHOUT tools
    console.warn("[Agent] All providers with tools failed, trying without tools...");
    // Reset Groq rate limit flag for the without-tools attempt since daily limits may differ
    // Actually, if rate-limited with tools, it'll still be rate-limited without tools. Keep the flag.
    for (const providerEntry of providerModels) {
      // Skip Groq if rate-limited
      if (groqRateLimited && providerEntry.name.startsWith('groq-')) {
        continue;
      }

      try {
        const result = await generateText({
          model: providerEntry.model,
          maxSteps: 1,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
        });

        console.log(`[Agent] ${providerEntry.name} succeeded without tools (text: ${result.text?.length || 0} chars)`);

        const stream = createUIMessageStream({
          execute: ({ writer }) => {
            const textId = "txt-" + Date.now();
            writer.write({ type: 'text-start', id: textId });
            if (result.text) {
              writer.write({ type: 'text-delta', id: textId, delta: result.text });
            }
            writer.write({ type: 'text-end', id: textId });
          },
        });

        return createUIMessageStreamResponse({ stream });
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
