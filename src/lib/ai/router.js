import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Classifies the intent of the conversation to route to the correct agent.
 * Also detects sentiment (positive/neutral/negative/urgent) for escalation.
 * Uses text generation with intent + sentiment extraction.
 * Provider chain: Groq (primary) → Google Gemini (fallback) → OpenAI (last resort)
 */
export async function routeMessage(message, conversationHistory = []) {
  try {
    // Only use recent history for context
    const recentContext = conversationHistory
      .slice(-3)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = `Classify the user's latest message into:
1. Intent category (ONE of): sales, support, order_tracking, general
2. Sentiment (ONE of): positive, neutral, negative, urgent

Recent Context:
${recentContext}

Latest Message:
${message}

Reply with ONLY two words separated by a pipe, like: sales|neutral
Valid intents: sales, support, order_tracking, general
Valid sentiments: positive, neutral, negative, urgent
Use "urgent" sentiment for angry, very frustrated, or threatening messages.`;

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

    // NVIDIA NIM — free tier with top-tier models
    if (process.env.NVIDIA_API_KEY) {
      try {
        const nvidia = createOpenAI({
          apiKey: process.env.NVIDIA_API_KEY,
          baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
          compatibility: "compatible",
        });
        providers.push({ name: 'nvidia-llama33-70b', model: nvidia("meta/llama-3.3-70b-instruct") });
        providers.push({ name: 'nvidia-mistral-large', model: nvidia("mistralai/mistral-large-2-instruct") });
      } catch (e) {
        console.warn("NVIDIA routing setup failed:", e?.message);
      }
    }

    // Try each provider until one works
    for (const provider of providers) {
      try {
        const result = await generateText({
          model: provider.model,
          prompt: prompt,
          maxTokens: 15,
        });
        const response = result.text.trim().toLowerCase().split('\n')[0];
        const parts = response.split('|').map(s => s.trim());
        
        const intent = parts[0] || "sales";
        const sentiment = parts[1] || "neutral";

        if (["sales", "support", "order_tracking", "general"].includes(intent)) {
          return { intent, sentiment: ["positive", "neutral", "negative", "urgent"].includes(sentiment) ? sentiment : "neutral" };
        }
      } catch (providerError) {
        console.warn(`Routing provider ${provider.name} failed:`, providerError?.message);
      }
    }

    console.warn("No routing provider available, defaulting to sales");
    return { intent: "sales", sentiment: "neutral" };
  } catch (error) {
    console.warn("Routing failed, defaulting to sales:", error?.message);
    return { intent: "sales", sentiment: "neutral" };
  }
}

/**
 * Analyze sentiment of a message without full routing.
 * Lightweight version for cases where only sentiment is needed.
 */
export async function analyzeSentiment(message) {
  try {
    const result = await routeMessage(message);
    return { sentiment: result.sentiment || "neutral" };
  } catch {
    return { sentiment: "neutral" };
  }
}
