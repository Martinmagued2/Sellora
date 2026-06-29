/**
 * Unified Provider Chain Builder with Smart Per-Key Failover
 * 
 * This module is the SINGLE SOURCE OF TRUTH for building AI provider chains
 * across the entire app. All routes and modules should import from here.
 * 
 * Features:
 * - Multi-key support for ALL providers (Groq, NVIDIA, Google, OpenAI)
 * - Per-key rate limit tracking (in-memory, auto-expires after cooldown)
 * - Smart failover: if key 1 is rate-limited, skip it and try key 2
 * - Provider-agnostic: detects rate limits, auth errors, server errors
 * - Round-robin: rotates through keys to distribute load
 * 
 * Configuration formats (works for ANY provider):
 *   Comma-separated: GROQ_API_KEYS="key1,key2,key3"
 *   Numbered: GROQ_API_KEY + GROQ_API_KEY_2 + GROQ_API_KEY_3 + ...
 *   Single: GROQ_API_KEY (backward compatible)
 * 
 * Same pattern applies to:
 *   NVIDIA_API_KEYS or NVIDIA_API_KEY + NVIDIA_API_KEY_2 + ...
 *   GOOGLE_API_KEYS or GOOGLE_GENERATIVE_AI_API_KEY + GOOGLE_GENERATIVE_AI_API_KEY_2 + ...
 *   OPENAI_API_KEYS or OPENAI_API_KEY + OPENAI_API_KEY_2 + ...
 */

import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// ─── In-Memory Rate Limit / Error Tracker ───
// Tracks which keys are temporarily unhealthy so we skip them.
// Auto-expires after the cooldown period.

const keyHealthMap = new Map(); // key: "provider:keyIndex", value: { failCount, lastFailTime, rateLimitedUntil }

const RATE_LIMIT_COOLDOWN_MS = 60_000;  // 1 min cooldown after rate limit
const AUTH_ERROR_PERMANENT = true;        // Auth errors = key is invalid, skip permanently
const MAX_CONSECUTIVE_FAILS = 3;          // After 3 fails, skip key for cooldown

/**
 * Record a failure for a specific provider key.
 * This is used to track rate limits and skip unhealthy keys.
 */
export function recordKeyFailure(providerName, keyIndex, error) {
  const mapKey = `${providerName}:${keyIndex}`;
  const errMsg = (error?.message || "").toLowerCase();
  const now = Date.now();
  
  const existing = keyHealthMap.get(mapKey) || { failCount: 0, lastFailTime: 0, rateLimitedUntil: 0, authFailed: false };
  existing.failCount += 1;
  existing.lastFailTime = now;
  
  // Rate limit detected → cooldown for this key
  if (errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("too many requests") || errMsg.includes("quota")) {
    existing.rateLimitedUntil = now + RATE_LIMIT_COOLDOWN_MS;
    console.warn(`[ProviderChain] ⚠️ ${mapKey} rate-limited, cooling down until ${new Date(existing.rateLimitedUntil).toISOString()}`);
  }
  
  // Auth error → key is invalid, mark permanently
  if (errMsg.includes("invalid api key") || errMsg.includes("unauthorized") || errMsg.includes("authentication") || errMsg.includes("401") || errMsg.includes("403")) {
    existing.authFailed = true;
    console.warn(`[ProviderChain] 🔑 ${mapKey} auth failed — key is invalid`);
  }
  
  keyHealthMap.set(mapKey, existing);
}

/**
 * Record a success for a specific provider key.
 * Resets the failure counter.
 */
export function recordKeySuccess(providerName, keyIndex) {
  const mapKey = `${providerName}:${keyIndex}`;
  keyHealthMap.delete(mapKey); // Clear all failures
}

/**
 * Check if a specific provider key should be skipped.
 * Returns true if the key is rate-limited, auth-failed, or has too many consecutive fails.
 */
function isKeyUnhealthy(providerName, keyIndex) {
  const mapKey = `${providerName}:${keyIndex}`;
  const health = keyHealthMap.get(mapKey);
  if (!health) return false;
  
  // Auth failed permanently
  if (health.authFailed) return true;
  
  // Rate limited and still in cooldown
  if (health.rateLimitedUntil && Date.now() < health.rateLimitedUntil) return true;
  
  // Too many consecutive fails in the last 5 minutes
  if (health.failCount >= MAX_CONSECUTIVE_FAILS && Date.now() - health.lastFailTime < 300_000) return true;
  
  // Cooldown expired or failures are old — clear
  if (health.rateLimitedUntil && Date.now() >= health.rateLimitedUntil) {
    health.failCount = 0;
    health.rateLimitedUntil = 0;
    keyHealthMap.set(mapKey, health);
    return false;
  }
  
  return false;
}

/**
 * Get a health summary for debugging.
 */
export function getKeyHealthSummary() {
  const summary = {};
  for (const [key, health] of keyHealthMap.entries()) {
    summary[key] = {
      failCount: health.failCount,
      rateLimitedUntil: health.rateLimitedUntil ? new Date(health.rateLimitedUntil).toISOString() : null,
      authFailed: health.authFailed,
    };
  }
  return summary;
}

// ─── Multi-Key Collector ───

/**
 * Collect API keys from environment variables.
 * Supports: COMMA_SEPARATED_KEYS, PRIMARY_KEY + KEY_2 + KEY_3, or single key.
 * 
 * @param {string} singleKeyEnv - The primary env var name (e.g. "GROQ_API_KEY")
 * @param {string} multiKeyEnv - The comma-separated env var name (e.g. "GROQ_API_KEYS")
 * @returns {string[]} Array of API keys
 */
export function collectKeys(singleKeyEnv, multiKeyEnv) {
  const keys = new Set();

  // Format 1: Comma-separated list (easiest for Vercel)
  if (multiKeyEnv && process.env[multiKeyEnv]) {
    process.env[multiKeyEnv]
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .forEach(k => keys.add(k));
  }

  // Format 2: Numbered keys (KEY_2, KEY_3, ... KEY_20)
  if (singleKeyEnv) {
    const baseName = singleKeyEnv;
    for (let i = 2; i <= 20; i++) {
      const key = process.env[`${baseName}_${i}`];
      if (key && key.trim()) {
        keys.add(key.trim());
      }
    }

    // Format 3: Original single key (backward compatible)
    if (process.env[singleKeyEnv] && process.env[singleKeyEnv].trim()) {
      keys.add(process.env[singleKeyEnv].trim());
    }
  }

  return [...keys];
}

// ─── Provider Builders ───

/**
 * Build Groq providers with multi-key support.
 * Each key gets primary + fast model entries.
 * Skips unhealthy keys automatically.
 */
export function buildGroqProviders(opts = {}) {
  const { fastModel = true, routingOnly = false, lightweight = false } = opts;
  const keys = collectKeys("GROQ_API_KEY", "GROQ_API_KEYS");
  const providers = [];
  
  if (keys.length === 0) return providers;
  
  // Model selection based on use case:
  // - Default (Copilot): Llama 3.3 70B (smartest available on free tier) → Llama 3.1 8B (fallback)
  //   (Llama 4 Scout 17B deprecated by Groq 2026-06-25. Qwen3 32B hit quota
  //    limits on free tier — switched to Llama 3.3 70B which has higher
  //    free-tier rate limits and is still supported.)
  // - Lightweight (auto-replies): Llama 3.1 8B (fast, cheap) → Mixtral (fallback)
  // - Routing only: Llama 3.1 8B + Gemma 2 (cheapest, fastest)
  let primaryModels;
  if (routingOnly) {
    primaryModels = [{ id: "llama-3.1-8b-instant", name: "groq-llama8b" }, { id: "gemma2-9b-it", name: "groq-gemma2" }];
  } else if (lightweight) {
    // Auto-replies: fast & cheap to conserve rate limits for Copilot
    primaryModels = [{ id: "llama-3.1-8b-instant", name: "groq-llama8b" }, { id: "mixtral-8x7b-32768", name: "groq-mixtral" }];
  } else {
    // Copilot: Llama 3.3 70B is the best free-tier model on Groq.
    // Qwen3 32B and GPT-OSS have quota limits on the free tier that get
    // exhausted quickly. Llama 3.3 70B has generous free limits and is
    // very capable for agentic tool use.
    primaryModels = [
      { id: "llama-3.3-70b-versatile", name: "groq-llama70b" },
      { id: "llama-3.1-8b-instant", name: "groq-llama8b" },
    ];
  }
  
  const fastModels = fastModel && !routingOnly && !lightweight
    ? [{ id: "llama-3.1-8b-instant", name: "groq-llama8b" }, { id: "mixtral-8x7b-32768", name: "groq-mixtral" }]
    : [];

  keys.forEach((key, keyIndex) => {
    if (isKeyUnhealthy("groq", keyIndex)) {
      console.log(`[ProviderChain] Skipping unhealthy Groq key ${keyIndex + 1}/${keys.length}`);
      return;
    }
    
    const keyLabel = keys.length > 1 ? `-k${keyIndex + 1}` : "";
    
    try {
      const groqProvider = createGroq({ apiKey: key });
      
      for (const model of [...primaryModels, ...fastModels]) {
        providers.push({
          name: `${model.name}${keyLabel}`,
          model: groqProvider(model.id),
          _provider: "groq",
          _keyIndex: keyIndex,
        });
      }
    } catch (e) {
      console.error(`[ProviderChain] Groq key ${keyIndex + 1} setup failed:`, e?.message);
    }
  });

  if (providers.length > 0) {
    console.log(`[ProviderChain] Groq: ${providers.length} provider(s) from ${keys.length} key(s)`);
  }
  return providers;
}

/**
 * Build NVIDIA NIM providers with multi-key support.
 * Each key gets multiple model entries (Llama, Nemotron, DeepSeek, Mistral).
 */
export function buildNvidiaProviders() {
  const keys = collectKeys("NVIDIA_API_KEY", "NVIDIA_API_KEYS");
  const providers = [];

  if (keys.length === 0) return providers;

  const nvidiaModels = [
    { id: "deepseek-ai/deepseek-v4-flash", name: "nvidia-deepseek-v4" },
    { id: "meta/llama-3.3-70b-instruct", name: "nvidia-llama33" },
    { id: "nvidia/llama-3.1-nemotron-70b-instruct", name: "nvidia-nemotron" },
    { id: "mistralai/mistral-large-2-instruct", name: "nvidia-mistral" },
    { id: "deepseek-ai/deepseek-r1", name: "nvidia-deepseek" },
  ];

  keys.forEach((key, keyIndex) => {
    if (isKeyUnhealthy("nvidia", keyIndex)) {
      console.log(`[ProviderChain] Skipping unhealthy NVIDIA key ${keyIndex + 1}/${keys.length}`);
      return;
    }

    const keyLabel = keys.length > 1 ? `-k${keyIndex + 1}` : "";

    try {
      const nvidia = createOpenAI({
        apiKey: key,
        baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
        compatibility: "compatible",
      });

      for (const model of nvidiaModels) {
        providers.push({
          name: `${model.name}${keyLabel}`,
          model: nvidia(model.id),
          _provider: "nvidia",
          _keyIndex: keyIndex,
        });
      }
    } catch (e) {
      console.warn(`[ProviderChain] NVIDIA key ${keyIndex + 1} setup failed:`, e?.message);
    }
  });

  if (providers.length > 0) {
    console.log(`[ProviderChain] NVIDIA: ${providers.length} provider(s) from ${keys.length} key(s)`);
  }
  return providers;
}

/**
 * Build Google Gemini providers with multi-key support.
 * Each key gets flash + flash-lite model entries.
 */
export function buildGoogleProviders() {
  const keys = collectKeys("GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEYS");
  const providers = [];

  if (keys.length === 0) return providers;

  const googleModels = [
    { id: "gemini-2.0-flash", name: "google-flash" },
    { id: "gemini-2.0-flash-lite", name: "google-flash-lite" },
  ];

  keys.forEach((key, keyIndex) => {
    if (isKeyUnhealthy("google", keyIndex)) {
      console.log(`[ProviderChain] Skipping unhealthy Google key ${keyIndex + 1}/${keys.length}`);
      return;
    }

    const keyLabel = keys.length > 1 ? `-k${keyIndex + 1}` : "";

    try {
      const google = createGoogleGenerativeAI({ apiKey: key });

      for (const model of googleModels) {
        providers.push({
          name: `${model.name}${keyLabel}`,
          model: google(model.id),
          _provider: "google",
          _keyIndex: keyIndex,
        });
      }
    } catch (e) {
      console.warn(`[ProviderChain] Google key ${keyIndex + 1} setup failed:`, e?.message);
    }
  });

  if (providers.length > 0) {
    console.log(`[ProviderChain] Google: ${providers.length} provider(s) from ${keys.length} key(s)`);
  }
  return providers;
}

/**
 * Build OpenAI providers with multi-key support.
 * Each key gets gpt-4o-mini entry.
 */
export function buildOpenAIProviders() {
  const keys = collectKeys("OPENAI_API_KEY", "OPENAI_API_KEYS");
  const providers = [];

  if (keys.length === 0) return providers;

  keys.forEach((key, keyIndex) => {
    if (isKeyUnhealthy("openai", keyIndex)) {
      console.log(`[ProviderChain] Skipping unhealthy OpenAI key ${keyIndex + 1}/${keys.length}`);
      return;
    }

    const keyLabel = keys.length > 1 ? `-k${keyIndex + 1}` : "";

    try {
      const openai = createOpenAI({ apiKey: key });
      providers.push({
        name: `openai-gpt4o-mini${keyLabel}`,
        model: openai("gpt-4o-mini"),
        _provider: "openai",
        _keyIndex: keyIndex,
      });
    } catch (e) {
      console.warn(`[ProviderChain] OpenAI key ${keyIndex + 1} setup failed:`, e?.message);
    }
  });

  if (providers.length > 0) {
    console.log(`[ProviderChain] OpenAI: ${providers.length} provider(s) from ${keys.length} key(s)`);
  }
  return providers;
}

/**
 * Build VectorEngine providers (single key only — no multi-key env vars yet).
 */
export function buildVectorEngineProviders() {
  const providers = [];
  if (!process.env.VECTORENGINE_API_KEY) return providers;

  try {
    const customOpenAI = createOpenAI({
      apiKey: process.env.VECTORENGINE_API_KEY,
      baseURL: process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai/v1",
      compatibility: "compatible",
    });
    providers.push({
      name: "vectorengine",
      model: customOpenAI("gpt-5.5-pro"),
      _provider: "vectorengine",
      _keyIndex: 0,
    });
  } catch (e) {
    console.warn("[ProviderChain] VectorEngine setup failed:", e?.message);
  }

  return providers;
}

// ─── Full Chain Builders ───
// These build the complete fallback chain in optimal order.

/**
 * Build the COMPLETE provider fallback chain for AI reply generation.
 * Order: NVIDIA (DeepSeek V4) → Google → Groq → VectorEngine → OpenAI
 * Each provider may have multiple keys × multiple models.
 * 
 * @param {Object} opts
 * @param {boolean} opts.routingOnly - If true, use fast/cheap models only (for intent routing)
 * @returns {Array<{name: string, model: object, _provider: string, _keyIndex: number}>}
 */
export function buildFullProviderChain(opts = {}) {
  const { routingOnly = false } = opts;
  const providers = [];

  // 1. NVIDIA DeepSeek V4 Flash — primary (thinking mode + fast + high quality)
  providers.push(...buildNvidiaProviders());

  // 2. Google Gemini (generous free tier)
  providers.push(...buildGoogleProviders());

  // 3. Groq — lightweight mode for auto-replies (fast/cheap models)
  providers.push(...buildGroqProviders({ routingOnly, lightweight: !routingOnly }));

  // 4. VectorEngine (if available — premium, fast)
  providers.push(...buildVectorEngineProviders());

  // 5. OpenAI (paid, last resort)
  providers.push(...buildOpenAIProviders());

  console.log(`[ProviderChain] Built full chain (auto-reply): ${providers.length} provider(s) total`);
  return providers;
}

/**
 * Build provider chain specifically for lightweight routing/classification.
 * Uses fast/cheap models only to conserve rate limits on primary models.
 */
export function buildRoutingProviderChain() {
  return buildFullProviderChain({ routingOnly: true });
}

/**
 * Build the streaming provider chain for Copilot/Agent.
 *
 * Provider order is CRITICAL for agentic tool use:
 * 1. Google Gemini 2.0 Flash — best at multi-step tool use + synthesis
 * 2. Groq Llama 4 Scout — fast streaming but weaker at following up after tools
 * 3. NVIDIA NIM — strong models but slower streaming
 * 4. VectorEngine — premium
 * 5. OpenAI — last resort (paid)
 *
 * Previous order had Groq first — but Llama 4 Scout (17B) struggles with
 * multi-step agentic tasks: it calls a tool, gets the result, then stops
 * without synthesizing a final answer. Gemini 2.0 Flash reliably follows
 * up with a comprehensive text response after tool calls complete.
 */
export function buildStreamingProviderChain() {
  const providers = [];

  // 1. NVIDIA DeepSeek V4 Flash — primary (fast + thinking mode + great at tool use)
  providers.push(...buildNvidiaProviders());

  // 2. Google Gemini — fallback (best at multi-step tool use + synthesis)
  providers.push(...buildGoogleProviders());

  // 3. Groq (fast streaming, fallback)
  providers.push(...buildGroqProviders());

  // 4. VectorEngine (premium)
  providers.push(...buildVectorEngineProviders());

  // 5. OpenAI last
  providers.push(...buildOpenAIProviders());

  console.log(`[ProviderChain] Built streaming chain (copilot): ${providers.length} provider(s) total [${providers.map(p => p.name).slice(0, 4).join(', ')}...]`);
  return providers;
}

/**
 * Get a summary of all configured providers for debugging.
 */
export function getProviderChainSummary() {
  const groqKeys = collectKeys("GROQ_API_KEY", "GROQ_API_KEYS");
  const nvidiaKeys = collectKeys("NVIDIA_API_KEY", "NVIDIA_API_KEYS");
  const googleKeys = collectKeys("GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEYS");
  const openaiKeys = collectKeys("OPENAI_API_KEY", "OPENAI_API_KEYS");

  return {
    groq: { keys: groqKeys.length, keysPreview: groqKeys.map(k => k.substring(0, 6) + "..." + k.slice(-4)) },
    nvidia: { keys: nvidiaKeys.length, keysPreview: nvidiaKeys.map(k => k.substring(0, 6) + "..." + k.slice(-4)) },
    google: { keys: googleKeys.length, keysPreview: googleKeys.map(k => k.substring(0, 6) + "..." + k.slice(-4)) },
    openai: { keys: openaiKeys.length, keysPreview: openaiKeys.map(k => k.substring(0, 6) + "..." + k.slice(-4)) },
    vectorengine: process.env.VECTORENGINE_API_KEY ? "configured" : "not set",
    keyHealth: getKeyHealthSummary(),
  };
}
