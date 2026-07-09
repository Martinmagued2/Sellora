import { generateText } from "ai";
import { buildRoutingProviderChain, recordKeyFailure, recordKeySuccess } from "./provider-chain";

/**
 * Classifies the intent of the conversation to route to the correct agent.
 * Also detects sentiment (positive/neutral/negative/urgent) for escalation.
 * Uses text generation with intent + sentiment extraction.
 * 
 * Provider chain uses the unified provider-chain module with:
 * - Multi-key support for ALL providers
 * - Smart per-key failover (rate limit detection, auth error tracking)
 * - Fast/cheap models only (to conserve rate limits on primary models)
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

    // Build provider chain using the unified module (multi-key + health tracking)
    const providers = buildRoutingProviderChain();

    // Try each provider until one works — track success/failure per key
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
          // ✅ Success — mark key as healthy
          if (provider._provider !== undefined) recordKeySuccess(provider._provider, provider._keyIndex);
          return { intent, sentiment: ["positive", "neutral", "negative", "urgent"].includes(sentiment) ? sentiment : "neutral" };
        }
      } catch (providerError) {
        console.warn(`Routing provider ${provider.name} failed:`, providerError?.message);
        // ❌ Failure — record it for smart failover
        if (provider._provider !== undefined) recordKeyFailure(provider._provider, provider._keyIndex, providerError);
      }
    }

    // ─── ZAI SDK Fallback for routing ───
    // If no Vercel AI SDK providers worked, try the ZAI SDK directly
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      let zai;
      try {
        zai = await ZAI.create();
      } catch {
        const { getZAIConfig } = await import("./z-ai-config.js");
        const zaiConfig = getZAIConfig();
        if (zaiConfig?.baseUrl && zaiConfig?.apiKey) {
          zai = new ZAI({ baseUrl: zaiConfig.baseUrl, apiKey: zaiConfig.apiKey });
        }
      }
      if (zai) {
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "user", content: prompt },
          ],
          max_tokens: 15,
        });
        const response = (completion.choices?.[0]?.message?.content || "").trim().toLowerCase().split('\n')[0];
        const parts = response.split('|').map(s => s.trim());
        const intent = parts[0] || "sales";
        const sentiment = parts[1] || "neutral";
        if (["sales", "support", "order_tracking", "general"].includes(intent)) {
          console.log("[Router] ZAI SDK routing succeeded:", intent, sentiment);
          return { intent, sentiment: ["positive", "neutral", "negative", "urgent"].includes(sentiment) ? sentiment : "neutral" };
        }
      }
    } catch (zaiErr) {
      console.warn("[Router] ZAI SDK fallback failed:", zaiErr?.message);
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
