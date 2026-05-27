import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createCopilotTools } from "@/lib/ai/copilot-tools";

// Helper to get model based on env
async function getModel() {
  // Prioritize Groq, fallback to others
  if (process.env.GROQ_API_KEY) {
    return groq("meta-llama/llama-4-scout-17b-16e-instruct");
  }
  
  const provider = process.env.AI_PROVIDER || "openai";
  const modelName = process.env.AI_MODEL || (provider === "openai" ? "gpt-4o-mini" : "gpt-4o-mini");
  
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
    const { openai } = await import("@ai-sdk/openai");
    return openai(modelName);
  }
  
  throw new Error("No AI provider configured (GROQ_API_KEY or OPENAI_API_KEY required)");
}

/**
 * Generic AI agent endpoint.
 * Accepts a POST request with `{ messages: [...] }` where each message has
 *   - role: "user" | "assistant"
 *   - content: string
 * Returns a streamed response using Gemini 1.5 Flash and the same tool set as the
 * Copilot. This can be used as a base for any custom agent.
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

    const model = await getModel();
    const tools = createCopilotTools(user.id);

    const result = await streamText({
      model,
      maxSteps: 5,
      temperature: 0.2,
      system: "You are a helpful AI assistant. Use the provided tools when appropriate.",
      messages: coreMessages,
      tools,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("Agent API error:", err);
    return Response.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
