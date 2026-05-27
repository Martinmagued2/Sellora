import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";

/**
 * Generic AI agent endpoint.
 * Accepts a POST request with `{ messages: [...] }` where each message has
 *   - role: "user" | "assistant"
 *   - content: string
 * Returns a streamed response using available AI providers and the same tool set as the
 * Copilot. This can be used as a base for any custom agent.
 * Provider chain: Groq (primary) → Google Gemini (fallback)
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
      return { role: msg.role, content: msg.content ?? "" };
    });

    // Build provider fallback chain (no Cohere)
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
    let lastError = null;

    for (const providerEntry of providerModels) {
      try {
        const result = await streamText({
          model: providerEntry.model,
          maxSteps: 5,
          temperature: 0.2,
          system: "You are a helpful AI assistant. Use the provided tools when appropriate.",
          messages: coreMessages,
          tools,
        });
        return result.toUIMessageStreamResponse();
      } catch (providerError) {
        lastError = providerError;
        console.warn(`Agent provider ${providerEntry.name} failed:`, providerError?.message || providerError);
      }
    }

    console.error('Agent API Error: all providers failed', lastError);
    return Response.json({ error: lastError?.message || 'Something went wrong with all AI providers.' }, { status: 500 });
  } catch (err) {
    console.error("Agent API error:", err);
    return Response.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
