import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";
import { getPlanLimits } from "@/lib/plan-limits";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    // ─── Pre-flight validation (before streaming starts) ───
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

    const { data: account } = await adminClient
      .from("accounts")
      .select("plan, business_name, country, currency")
      .eq("id", user.id)
      .single();

    const planLimits = getPlanLimits(account?.plan || "starter");
    const maxMsgs = planLimits.copilot_msgs_per_day;

    if (maxMsgs === 0) {
      return Response.json({ error: "Sellora Agent is not available on your current plan. Please upgrade." }, { status: 403 });
    }

    if (maxMsgs !== -1 && process.env.NODE_ENV === "production") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("email", user.email)
        .eq("action", "copilot_msg")
        .gte("created_at", oneDayAgo);

      if (count >= maxMsgs) {
        return Response.json({ error: "Daily Agent limit reached. Upgrade for more." }, { status: 429 });
      }
    }

    if (process.env.NODE_ENV === "production") {
      await adminClient.from("rate_limits").insert({
        email: user.email,
        action: "copilot_msg",
      });
    }

    // ─── Parse messages from useChat format to core messages ───
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
- Order Management: View latest sales, update order status, get order details
- Customer Insights: Analyze customer data, show top spenders, returning customer stats
- Conversation Overview: Check recent conversations, see unread messages
- Search & Filter: Search products by name/category, filter inventory

BEHAVIOR GUIDELINES:
1. Be PROACTIVE — if the seller gives a vague request like "add a product", ask for the necessary details (name, price) then create it immediately.
2. ALWAYS write a detailed, well-formatted text response AFTER every tool call. Never just call a tool and stop — you MUST explain the results to the user in detail.
3. When creating products from a prompt, GENERATE a compelling product description even if the seller doesn't ask for one.
4. Always use real data from your tools — never make up numbers or statistics.
5. For sales reports, structure them with clear sections: Revenue Summary, Order Breakdown, Top Products, Payment Methods, and Recommendations. Include specific numbers and percentages.
6. Currency: Use ${currency} for all monetary values.
7. When the seller asks "how are my sales?" or "give me a report", use get_sales_report for detailed analysis, not just get_store_analytics.
8. After performing an action (like creating a product), confirm what was done in detail, then mention they can click the action button to navigate to the relevant page.
9. When asked to update an order, confirm the order details before updating the status.
10. For inventory issues, use get_inventory_alerts to show out-of-stock and low-stock products proactively. List each affected product by name.
11. ALWAYS call a tool when the user's request matches a tool's capability — do NOT just describe what you could do, actually do it.
12. For customer insights, break down the data: total customers, returning vs new, top spenders with amounts, channel distribution — make it actionable.

CRITICAL RULE: After EVERY tool call, you MUST write a detailed text response explaining the results. Do NOT just return tool results silently. The user needs to READ your analysis. Write at least 3-5 sentences analyzing the data from every tool call. Use bullet points, bold text, and clear formatting.`;

    // ─── Build provider model list with fallback chain ───
    const providerModels = [];

    if (process.env.GROQ_API_KEY) {
      providerModels.push({ name: 'groq', model: groq('llama-3.3-70b-versatile') });
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
      providerModels.push({ name: 'google', model: google('gemini-2.0-flash') });
    }

    if (process.env.OPENAI_API_KEY) {
      const { openai } = await import('@ai-sdk/openai');
      providerModels.push({ name: 'openai', model: openai('gpt-4o-mini') });
    }

    if (providerModels.length === 0) {
      return Response.json({ error: 'AI is not configured. Please add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file.' }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);

    // ─── streamText with fallback ───
    // streamText produces the correct stream format that useChat natively understands.
    // If the primary provider fails, we fall back to the next one.

    for (const providerEntry of providerModels) {
      try {
        const result = streamText({
          model: providerEntry.model,
          maxSteps: 5,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
          tools,
          onStepFinish: ({ toolResults }) => {
            if (toolResults) {
              for (const tr of toolResults) {
                console.log(`[Agent] Tool ${tr.toolName} completed via ${providerEntry.name}`);
              }
            }
          },
        });

        // Return the stream directly — useChat will handle it natively
        return result.toDataStreamResponse();
      } catch (providerError) {
        console.warn(`[Agent] Provider ${providerEntry.name} failed:`, providerError?.message || providerError);
        // Try next provider
        continue;
      }
    }

    // All providers failed with tools — try WITHOUT tools as last resort
    console.warn("[Agent] All providers with tools failed, trying without tools...");
    for (const providerEntry of providerModels) {
      try {
        const result = streamText({
          model: providerEntry.model,
          maxSteps: 1,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
        });

        return result.toDataStreamResponse();
      } catch (providerError) {
        console.warn(`[Agent] Provider ${providerEntry.name} without tools also failed:`, providerError?.message || providerError);
      }
    }

    return Response.json({ error: 'All AI providers failed. Please try again.' }, { status: 500 });
  } catch (error) {
    console.error("Agent API Error:", error);
    return Response.json({ error: error.message || "Something went wrong." }, { status: 500 });
  }
}
