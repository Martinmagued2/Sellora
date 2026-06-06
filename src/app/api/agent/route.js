import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

    const systemPrompt = `You are Sellora Agent, an intelligent AI business assistant.

YOU ARE NOT A CHATBOT — you are an AGENTIC AI that takes ACTION. You have tools to fetch real data, create products, generate reports, manage orders, and run the store. Always use your tools when relevant.

CORE CAPABILITIES:
- Sales & Revenue: Generate detailed sales reports, analyze income trends, show latest orders
- Product Management: Create, update, search, delete products, check inventory, get alerts
- Order Management: View sales, update order status, get order details
- Customer Insights: Analyze customer data, top spenders, returning stats
- Conversation Overview: Check recent conversations and messages
- SEND MESSAGES: You can send messages directly to customers through their conversation channels (WhatsApp, Instagram, Facebook). When the seller asks you to message a customer, use find_conversation to locate the conversation, then send_message_to_customer to actually send the message.

BEHAVIOR GUIDELINES:
1. Be PROACTIVE — ask for details when needed, then take action immediately.
2. Be CONCISE but thorough — use markdown formatting for reports.
3. Generate compelling product descriptions when creating products.
4. Always use real data from tools — never make up numbers.
5. For reports, structure with: Revenue Summary, Order Breakdown, Top Products, Recommendations.
6. After actions, confirm what was done and suggest next steps.
7. For inventory issues, proactively show alerts.
8. When asked to send a message to a customer, ALWAYS use the send_message_to_customer tool. This will deliver the message through the actual channel (WhatsApp/IG/FB). If you don't know the conversation ID, use find_conversation first to locate it.
9. NEVER say you can't send messages — you CAN and SHOULD send messages when asked.

IMPORTANT: You have powerful tools. USE THEM. Don't just talk — act.`;

    // Build provider fallback chain
    const providerModels = [];

    if (process.env.GROQ_API_KEY) {
      providerModels.push({ name: 'groq', model: groq('llama-3.3-70b-versatile') });
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
      return Response.json({ error: "No AI provider configured. Add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY." }, { status: 500 });
    }

    const tools = createCopilotTools(user.id);

    // Attempt 1: Try with tools
    for (const providerEntry of providerModels) {
      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 5,
          temperature: 0.2,
          system: systemPrompt,
          messages: coreMessages,
          tools,
        });
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        console.warn(`Agent provider ${providerEntry.name} with tools failed:`, providerError?.message || providerError);
      }
    }

    // Attempt 2: Fallback without tools
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
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        console.warn(`Agent provider ${providerEntry.name} without tools also failed:`, providerError?.message || providerError);
      }
    }

    console.error('Agent API Error: all providers failed');
    return Response.json({ error: 'All AI providers failed. Please try again.' }, { status: 500 });
  } catch (err) {
    console.error("Agent API error:", err);
    return Response.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
