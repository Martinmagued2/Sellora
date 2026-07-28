/**
 * Shared AI provider builder for standalone endpoints.
 *
 * Many standalone AI endpoints (dashboard-insights, memory-card, sales-coach,
 * etc.) need a single LLM provider for a one-shot generateText call. Rather
 * than each one reimplementing the provider selection logic, they all import
 * this helper.
 *
 * This ensures OpenRouter (the user's primary provider) is tried FIRST,
 * falling back to Groq → Google → OpenAI if OpenRouter isn't configured.
 *
 * Import the full chain builder for endpoints that need streaming or
 * multi-step tool calling — use buildStreamingProviderChain() from
 * @/lib/ai/provider-chain instead.
 */

import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Build a single AI provider for one-shot generateText calls.
 *
 * Priority order:
 *   1. OpenRouter (if OPENROUTER_API_KEY is set) — uses OPENROUTER_MODEL
 *      (default: "openai/gpt-oss-20b:free" — free tier, no cost)
 *   2. Groq (if GROQ_API_KEY is set) — uses llama-3.3-70b-versatile
 *   3. Google (if GOOGLE_GENERATIVE_AI_API_KEY is set) — uses gemini-1.5-flash
 *   4. OpenAI (if OPENAI_API_KEY is set) — uses gpt-4o-mini
 *
 * Returns the model object ready to pass to generateText({ model, ... }),
 * or null if no provider is configured.
 */
export function buildStandaloneProvider() {
  // 1. OpenRouter (highest priority — user's primary)
  if (process.env.OPENROUTER_API_KEY) {
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";
    const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    try {
      const openrouter = createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL,
        compatibility: "compatible",
        headers: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://www.sellorachat.com",
          "X-Title": "Sellora",
        },
      });
      return openrouter(model);
    } catch (e) {
      console.warn("[STANDALONE-PROVIDER] OpenRouter setup failed:", e?.message);
    }
  }

  // 2. Groq
  if (process.env.GROQ_API_KEY) {
    try {
      return createGroq({ apiKey: process.env.GROQ_API_KEY })("llama-3.3-70b-versatile");
    } catch (e) {
      console.warn("[STANDALONE-PROVIDER] Groq setup failed:", e?.message);
    }
  }

  // 3. Google
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })("gemini-1.5-flash");
    } catch (e) {
      console.warn("[STANDALONE-PROVIDER] Google setup failed:", e?.message);
    }
  }

  // 4. OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4o-mini");
    } catch (e) {
      console.warn("[STANDALONE-PROVIDER] OpenAI setup failed:", e?.message);
    }
  }

  return null;
}
