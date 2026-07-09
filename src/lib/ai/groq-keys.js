/**
 * Multi-Key Groq Provider Support
 * 
 * Supports multiple Groq API keys for:
 * - Higher throughput: distribute requests across keys
 * - Rate limit resilience: auto-failover when one key is throttled
 * - Cost distribution: spread usage across free tier accounts
 * 
 * Configuration (set on Vercel or in .env.local):
 *   Option A: GROQ_API_KEYS="key1,key2,key3"  (comma-separated, recommended)
 *   Option B: GROQ_API_KEY + GROQ_API_KEY_2 + GROQ_API_KEY_3 + ... (numbered)
 *   Option C: GROQ_API_KEY only (backward compatible, single key)
 * 
 * All options can be mixed — keys are collected from all sources.
 */

import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";

// Available Groq models to rotate through
const GROQ_MODELS = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", tier: "free" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", tier: "free" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", tier: "free" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", tier: "free" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", tier: "free" },
];

/**
 * Collect all Groq API keys from environment variables.
 * Supports three formats (can be mixed):
 *   1. GROQ_API_KEYS="key1,key2,key3"
 *   2. GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ...
 *   3. GROQ_API_KEY (single key, backward compatible)
 * 
 * @returns {string[]} Array of Groq API keys (deduplicated)
 */
export function collectGroqKeys() {
  const keys = new Set();

  // Format 1: Comma-separated list (easiest for Vercel env vars)
  if (process.env.GROQ_API_KEYS) {
    process.env.GROQ_API_KEYS
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .forEach(k => keys.add(k));
  }

  // Format 2: Numbered keys (GROQ_API_KEY_2, GROQ_API_KEY_3, etc.)
  for (let i = 2; i <= 20; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key && key.trim()) {
      keys.add(key.trim());
    }
  }

  // Format 3: Original single key (backward compatible, added last so it's not duplicated)
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    keys.add(process.env.GROQ_API_KEY.trim());
  }

  return [...keys];
}

/**
 * Build an array of Groq provider entries for the fallback chain.
 * Each key gets its own provider entry, so if one key hits rate limits,
 * the next key is tried automatically.
 * 
 * Strategy per key: primary model (Llama 3.3 70B) + fast fallback model (Llama 3.1 8B)
 * 
 * @param {string} primaryModel - The primary Groq model ID (default: llama-3.3-70b-versatile)
 * @param {string} fastModel - The fast/cheap Groq model ID (default: llama-3.1-8b-instant)
 * @returns {Array<{name: string, model: object}>} Provider entries for the chain
 */
export function buildGroqProviders(primaryModel = "meta-llama/llama-4-scout-17b-16e-instruct", fastModel = "llama-3.1-8b-instant") {
  const keys = collectGroqKeys();
  const providers = [];

  if (keys.length === 0) {
    return providers;
  }

  console.log(`[Groq] Found ${keys.length} API key(s) — building multi-key provider chain`);

  keys.forEach((key, index) => {
    const keyLabel = keys.length > 1 ? ` (key ${index + 1}/${keys.length})` : "";
    
    // Primary model with this key
    try {
      const groqProvider = createGroq({ apiKey: key });
      providers.push({
        name: `groq-${primaryModel}${keyLabel}`,
        model: groqProvider(primaryModel),
        _groqKeyIndex: index,
      });
    } catch (e) {
      console.warn(`[Groq] Failed to create primary provider for key ${index + 1}:`, e?.message);
    }

    // Fast/cheap model with this key (different model = different rate limit bucket)
    if (fastModel !== primaryModel) {
      try {
        const groqProvider = createGroq({ apiKey: key });
        providers.push({
          name: `groq-${fastModel}${keyLabel}`,
          model: groqProvider(fastModel),
          _groqKeyIndex: index,
          _isFastModel: true,
        });
      } catch (e) {
        console.warn(`[Groq] Failed to create fast provider for key ${index + 1}:`, e?.message);
      }
    }
  });

  console.log(`[Groq] Built ${providers.length} provider entries from ${keys.length} key(s)`);
  return providers;
}

/**
 * Build Groq providers specifically for lightweight tasks like routing.
 * Uses fast/cheap models only to conserve rate limits on primary models.
 * 
 * @returns {Array<{name: string, model: object}>} Provider entries for routing
 */
export function buildGroqRoutingProviders() {
  const keys = collectGroqKeys();
  const providers = [];

  if (keys.length === 0) {
    return providers;
  }

  // For routing, use the fast models only (saves primary model rate limits for actual replies)
  const routingModels = [
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
    { id: "gemma2-9b-it", name: "Gemma 2 9B" },
  ];

  keys.forEach((key, keyIndex) => {
    routingModels.forEach((model) => {
      try {
        const groqProvider = createGroq({ apiKey: key });
        providers.push({
          name: `groq-route-${model.name}${keys.length > 1 ? ` (key ${keyIndex + 1})` : ""}`,
          model: groqProvider(model.id),
          _groqKeyIndex: keyIndex,
        });
      } catch (e) {
        console.warn(`[Groq] Failed to create routing provider:`, e?.message);
      }
    });
  });

  return providers;
}

/**
 * Get a summary of Groq configuration for debugging.
 * Masks the API keys for security.
 */
export function getGroqConfigSummary() {
  const keys = collectGroqKeys();
  return {
    totalKeys: keys.length,
    keys: keys.map((k, i) => ({
      index: i + 1,
      prefix: k.substring(0, 6) + "..." + k.substring(k.length - 4),
      length: k.length,
    })),
    models: GROQ_MODELS.map(m => m.id),
  };
}
