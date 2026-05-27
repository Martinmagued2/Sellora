import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Classifies the intent of the conversation to route to the correct agent.
 * Uses text generation with intent extraction (more reliable than structured outputs).
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

    // Try VectorEngine first
    if (process.env.VECTORENGINE_API_KEY) {
      try {
        const customOpenAI = createOpenAI({
          apiKey: process.env.VECTORENGINE_API_KEY,
          baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
          compatibility: "compatible",
        });
        const result = await generateText({
          model: customOpenAI("gpt-5.5-pro"),
          prompt: prompt,
          maxTokens: 10,
        });
        const intent = result.text.trim().toLowerCase().split('\n')[0];
        if (["sales", "support", "order_tracking", "general"].includes(intent)) {
          return intent;
        }
      } catch (e) {
        console.warn("VectorEngine routing failed:", e?.message);
      }
    }

    // Try Groq next
    if (process.env.GROQ_API_KEY) {
      try {
        const result = await generateText({
          model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
          prompt: prompt,
          maxTokens: 10,
        });
        const intent = result.text.trim().toLowerCase().split('\n')[0];
        if (["sales", "support", "order_tracking", "general"].includes(intent)) {
          return intent;
        }
      } catch (groqError) {
        console.warn("Groq routing failed:", groqError?.message);
      }
    }

    // Fallback to Google Gemini
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        });
        const result = await generateText({
          model: google("gemini-1.5-pro"),
          prompt: prompt,
          maxTokens: 10,
        });
        const intent = result.text.trim().toLowerCase().split('\n')[0];
        if (["sales", "support", "order_tracking", "general"].includes(intent)) {
          return intent;
        }
      } catch (googleError) {
        console.warn("Google routing failed:", googleError?.message);
      }
    }

    // Fallback to OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const { openai } = await import("@ai-sdk/openai");
        const result = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: prompt,
          maxTokens: 10,
        });
        const intent = result.text.trim().toLowerCase().split('\n')[0];
        if (["sales", "support", "order_tracking", "general"].includes(intent)) {
          return intent;
        }
      } catch (openaiError) {
        console.warn("OpenAI routing failed:", openaiError?.message);
      }
    }

    console.warn("No routing provider available, defaulting to sales");
    return "sales";
  } catch (error) {
    console.warn("Routing failed, defaulting to sales:", error?.message);
    return "sales"; // Default to sales if routing fails
  }
}
