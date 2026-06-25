/**
 * AI Status Endpoint — NO AUTH REQUIRED
 * 
 * GET /api/ai/status
 * 
 * Quickly diagnose why AI might not be working:
 * - Which env vars are SET vs MISSING
 * - Which providers are in the chain
 * - Whether a test API call succeeds
 * 
 * This endpoint is intentionally public so you can check
 * AI health without logging in. It does NOT expose actual
 * API key values — only whether they are set.
 */

import { collectKeys, buildStreamingProviderChain, buildFullProviderChain, getProviderChainSummary } from "@/lib/ai/provider-chain";

export async function GET() {
  const timestamp = new Date().toISOString();
  
  // ─── 1. Environment Variable Check ───
  const envCheck = {
    // Groq
    GROQ_API_KEY: boolStr(process.env.GROQ_API_KEY),
    GROQ_API_KEY_2: boolStr(process.env.GROQ_API_KEY_2),
    GROQ_API_KEY_3: boolStr(process.env.GROQ_API_KEY_3),
    GROQ_API_KEY_4: boolStr(process.env.GROQ_API_KEY_4),
    GROQ_API_KEY_5: boolStr(process.env.GROQ_API_KEY_5),
    GROQ_API_KEYS: boolStr(process.env.GROQ_API_KEYS),
    
    // Google
    GOOGLE_GENERATIVE_AI_API_KEY: boolStr(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    GOOGLE_API_KEYS: boolStr(process.env.GOOGLE_API_KEYS),
    
    // NVIDIA
    NVIDIA_API_KEY: boolStr(process.env.NVIDIA_API_KEY),
    NVIDIA_API_KEYS: boolStr(process.env.NVIDIA_API_KEYS),
    
    // OpenAI
    OPENAI_API_KEY: boolStr(process.env.OPENAI_API_KEY),
    OPENAI_API_KEYS: boolStr(process.env.OPENAI_API_KEYS),
    
    // VectorEngine
    VECTORENGINE_API_KEY: boolStr(process.env.VECTORENGINE_API_KEY),
    
    // Supabase (required for /api/chat auth)
    NEXT_PUBLIC_SUPABASE_URL: boolStr(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: boolStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: boolStr(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  // ─── 2. Multi-Key Collection Check ───
  const groqKeys = collectKeys("GROQ_API_KEY", "GROQ_API_KEYS");
  const nvidiaKeys = collectKeys("NVIDIA_API_KEY", "NVIDIA_API_KEYS");
  const googleKeys = collectKeys("GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEYS");
  const openaiKeys = collectKeys("OPENAI_API_KEY", "OPENAI_API_KEYS");

  const keySummary = {
    groq: { totalKeys: groqKeys.length, previews: groqKeys.map(k => maskKey(k)) },
    nvidia: { totalKeys: nvidiaKeys.length, previews: nvidiaKeys.map(k => maskKey(k)) },
    google: { totalKeys: googleKeys.length, previews: googleKeys.map(k => maskKey(k)) },
    openai: { totalKeys: openaiKeys.length, previews: openaiKeys.map(k => maskKey(k)) },
    vectorengine: process.env.VECTORENGINE_API_KEY ? "1 key" : "none",
  };

  // ─── 3. Provider Chain Check ───
  const streamingChain = buildStreamingProviderChain();
  const fullChain = buildFullProviderChain();

  const providerChain = {
    streaming: {
      total: streamingChain.length,
      providers: streamingChain.map(p => ({ name: p.name, provider: p._provider, keyIndex: p._keyIndex })),
    },
    full: {
      total: fullChain.length,
      providers: fullChain.map(p => ({ name: p.name, provider: p._provider, keyIndex: p._keyIndex })),
    },
  };

  // ─── 4. Health Summary ───
  const healthSummary = getProviderChainSummary();

  // ─── 5. Quick Groq Test (if key exists) ───
  let groqTest = null;
  if (groqKeys.length > 0) {
    try {
      const { generateText } = await import("ai");
      const { createGroq } = await import("@ai-sdk/groq");
      const groqProvider = createGroq();
      const startTime = Date.now();
      const result = await generateText({
        model: groqProvider("qwen-qwq-32b"),
        prompt: "Say OK",
        maxTokens: 5,
      });
      groqTest = {
        status: "success",
        latency_ms: Date.now() - startTime,
        response: result.text?.substring(0, 50),
      };
    } catch (err) {
      groqTest = {
        status: "failed",
        error: err.message?.substring(0, 300),
        errorType: classifyError(err.message),
      };
    }
  } else {
    groqTest = { status: "no_key", message: "No Groq API key found in environment" };
  }

  // ─── 6. Quick Google Test (if key exists) ───
  let googleTest = null;
  if (googleKeys.length > 0) {
    try {
      const { generateText } = await import("ai");
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({ apiKey: googleKeys[0] });
      const startTime = Date.now();
      const result = await generateText({
        model: google("gemini-2.0-flash-lite"),
        prompt: "Say OK",
        maxTokens: 5,
      });
      googleTest = {
        status: "success",
        latency_ms: Date.now() - startTime,
        response: result.text?.substring(0, 50),
      };
    } catch (err) {
      googleTest = {
        status: "failed",
        error: err.message?.substring(0, 300),
        errorType: classifyError(err.message),
      };
    }
  } else {
    googleTest = { status: "no_key" };
  }

  // ─── 7. Diagnosis ───
  const diagnosis = [];
  
  if (groqKeys.length === 0 && googleKeys.length === 0 && nvidiaKeys.length === 0 && openaiKeys.length === 0 && !process.env.VECTORENGINE_API_KEY) {
    diagnosis.push("CRITICAL: No AI provider keys are configured at all. The AI will never work.");
    diagnosis.push("Fix: Add at least GROQ_API_KEY to your Vercel environment variables.");
  }
  
  if (groqKeys.length === 0) {
    diagnosis.push("WARNING: No Groq keys found. Streaming chat (Copilot) will use other providers or fail.");
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    diagnosis.push("CRITICAL: Supabase env vars missing. /api/chat will return 401 (auth fails before reaching AI).");
    diagnosis.push("Fix: Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel env vars.");
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    diagnosis.push("WARNING: SUPABASE_SERVICE_ROLE_KEY missing. Account/plan lookups will fail in /api/chat.");
  }
  
  if (streamingChain.length === 0) {
    diagnosis.push("CRITICAL: Streaming provider chain is empty. Copilot will return 'AI is not configured'.");
  }
  
  if (groqTest?.status === "failed" && groqTest.errorType === "auth") {
    diagnosis.push("CRITICAL: Groq API key is invalid or revoked. Check your keys in the Groq console.");
  }
  
  if (groqTest?.status === "failed" && groqTest.errorType === "rate_limit") {
    diagnosis.push("WARNING: Groq rate limit hit. AI will work again after the cooldown.");
  }

  if (groqTest?.status === "success") {
    diagnosis.push("OK: Groq is working correctly.");
  }

  return Response.json({
    timestamp,
    env_check: envCheck,
    key_summary: keySummary,
    provider_chain: providerChain,
    health: healthSummary,
    tests: {
      groq: groqTest,
      google: googleTest,
    },
    diagnosis,
  }, { status: diagnosis.some(d => d.startsWith("CRITICAL")) ? 503 : 200 });
}

// ─── Helpers ───

function boolStr(val) {
  if (!val) return "MISSING";
  if (typeof val === "string" && val.trim() === "") return "MISSING";
  return "SET";
}

function maskKey(key) {
  if (!key || key.length < 10) return "***too_short***";
  return key.substring(0, 6) + "..." + key.slice(-4);
}

function classifyError(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("rate limit") || m.includes("429") || m.includes("too many requests") || m.includes("quota")) return "rate_limit";
  if (m.includes("invalid api key") || m.includes("unauthorized") || m.includes("authentication") || m.includes("401") || m.includes("403")) return "auth";
  if (m.includes("overloaded") || m.includes("503") || m.includes("500")) return "server";
  return "unknown";
}
