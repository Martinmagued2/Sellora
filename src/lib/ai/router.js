import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Classifies the intent of the conversation to route to the correct agent.
 * Uses text generation with intent extraction (more reliable than structured outputs).
 * Provider chain: Groq (primary) → Google Gemini (fallback) → OpenAI (last resort)
 */
export async function routeMessage(message, conversationHistory = []) {
  try {
    // Only use recent history for context
    const recentContext = conversationHistory
      .slice(-3)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = `Classify the user's latest message into ONE of these categories:
- sales: asking about products, prices, wants to buy, or needs recommendations
- support: complaint, return/refund request, or help with an issue
- order_tracking: asking about order status or tracking
- general: greetings, generic questions, or ambiguous statements

Recent Context:
${recentContext}

Latest Message:
${message}

Reply with ONLY the category name (one word): sales, support, order_tracking, or general`;

    // Build provider fallback chain (no Cohere)
    const providers = [];

    // Try VectorEngine first
    if (process.env.VECTORENGINE_API_KEY) {
      try {
        const customOpenAI = createOpenAI({
          apiKey: process.env.VECTORENGINE_API_KEY,
          baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
          compatibility: "compatible",
        });
        providers.push({ name: 'vectorengine', model: customOpenAI("gpt-5.5-pro") });
      } catch (e) {
        console.warn("VectorEngine routing setup failed:", e?.message);
      }
    }

    // Try Groq next (primary)
    if (process.env.GROQ_API_KEY) {
      providers.push({ name: 'groq', model: groq("llama-3.3-70b-versatile") });
    }

    // Fallback to Google Gemini
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        });
        providers.push({ name: 'google', model: google("gemini-2.0-flash") });
      } catch (e) {
        console.warn("Google routing setup failed:", e?.message);
      }
    }

    // Fallback to OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const { openai } = await import("@ai-sdk/openai");
        providers.push({ name: 'openai', model: openai("gpt-4o-mini") });
      } catch (e) {
        console.warn("OpenAI routing setup failed:", e?.message);
      }
    }

    // Try each provider until one works
    for (const provider of providers) {
      try {
        const result = await generateText({
          model: provider.model,
          prompt: prompt,
          maxTokens: 10,
        });
        const intent = result.text.trim().toLowerCase().split('\n')[0];
        if (["sales", "support", "order_tracking", "general"].includes(intent)) {
          return intent;
        }
      } catch (providerError) {
        console.warn(`Routing provider ${provider.name} failed:`, providerError?.message);
      }
    }

    console.warn("No routing provider available, defaulting to sales");
    return "sales";
  } catch (error) {
    console.warn("Routing failed, defaulting to sales:", error?.message);
    return "sales"; // Default to sales if routing fails
  }
}
