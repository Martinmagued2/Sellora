/**
 * AI Debug Endpoint
 * POST /api/ai/debug
 * 
 * Tests the AI generation pipeline directly and returns detailed diagnostics.
 * Does NOT require Meta tokens — just tests the AI providers.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

export async function POST(req) {
  const results = {
    timestamp: new Date().toISOString(),
    env_check: {},
    provider_tests: [],
    ai_reply_test: null,
    errors: [],
  };

  // 1. Check environment variables
  results.env_check = {
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    VECTORENGINE_API_KEY: !!process.env.VECTORENGINE_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // 2. Test each AI provider individually
  // Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const startTime = Date.now();
      const result = await generateText({
        model: groq("llama-3.3-70b-versatile"),
        prompt: "Say 'Groq works!' in exactly 3 words.",
        maxTokens: 20,
      });
      results.provider_tests.push({
        provider: "groq",
        status: "success",
        latency_ms: Date.now() - startTime,
        response: result.text?.substring(0, 100),
      });
    } catch (err) {
      results.provider_tests.push({
        provider: "groq",
        status: "failed",
        error: err.message?.substring(0, 200),
      });
    }
  } else {
    results.provider_tests.push({ provider: "groq", status: "no_api_key" });
  }

  // Google Gemini
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const startTime = Date.now();
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
      const result = await generateText({
        model: google("gemini-2.0-flash"),
        prompt: "Say 'Gemini works!' in exactly 3 words.",
        maxTokens: 20,
      });
      results.provider_tests.push({
        provider: "google",
        status: "success",
        latency_ms: Date.now() - startTime,
        response: result.text?.substring(0, 100),
      });
    } catch (err) {
      results.provider_tests.push({
        provider: "google",
        status: "failed",
        error: err.message?.substring(0, 200),
      });
    }
  } else {
    results.provider_tests.push({ provider: "google", status: "no_api_key" });
  }

  // 3. Test the full generateAIReply function for the authenticated user
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
      results.ai_reply_test = { status: "skipped", reason: "Not authenticated" };
      return Response.json(results);
    }

    // Get account details
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: account, error: acctErr } = await adminClient
      .from("accounts")
      .select("id, business_name, country, ai_enabled, ai_personality, plan")
      .eq("id", user.id)
      .single();

    if (acctErr || !account) {
      results.ai_reply_test = { status: "failed", error: "Account not found: " + (acctErr?.message || "unknown") };
      return Response.json(results);
    }

    results.ai_reply_test = {
      account_id: account.id,
      business_name: account.business_name,
      ai_enabled: account.ai_enabled,
      plan: account.plan,
    };

    if (!account.ai_enabled) {
      results.ai_reply_test.status = "skipped";
      results.ai_reply_test.reason = "AI is disabled for this account";
      return Response.json(results);
    }

    // Check rate limits
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: aiCount } = await adminClient
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("email", account.id)
      .eq("action", "ai_auto_reply")
      .gte("created_at", oneDayAgo);

    const { getPlanLimits } = await import("@/lib/plan-limits");
    const planLimits = getPlanLimits(account.plan);
    const maxPerDay = planLimits.ai_replies_per_day;

    results.ai_reply_test.rate_limit = {
      used: aiCount || 0,
      limit: maxPerDay === -1 ? "unlimited" : maxPerDay,
      remaining: maxPerDay === -1 ? "unlimited" : Math.max(0, maxPerDay - (aiCount || 0)),
    };

    // Actually test generateAIReply
    const { generateAIReply } = await import("@/lib/ai");
    const startTime = Date.now();
    
    try {
      const aiResult = await generateAIReply({
        accountId: account.id,
        customerId: "00000000-0000-0000-0000-000000000000",
        customerMessage: "Hi, what products do you sell?",
        customerName: "Test Customer",
        personality: account.ai_personality,
        country: account.country,
        businessName: account.business_name,
        conversationHistory: [],
        plan: account.plan,
      });

      results.ai_reply_test.status = aiResult.reply ? "success" : "no_reply";
      results.ai_reply_test.latency_ms = Date.now() - startTime;
      results.ai_reply_test.reply_preview = aiResult.reply?.substring(0, 200);
      results.ai_reply_test.intent = aiResult.intent;
      results.ai_reply_test.sentiment = aiResult.sentiment;
      results.ai_reply_test.has_tool_calls = !!(aiResult.toolCalls && aiResult.toolCalls.length > 0);
    } catch (aiErr) {
      results.ai_reply_test.status = "failed";
      results.ai_reply_test.latency_ms = Date.now() - startTime;
      results.ai_reply_test.error = aiErr.message?.substring(0, 300);
      results.ai_reply_test.stack = aiErr.stack?.split('\n').slice(0, 5).join('\n');
    }

  } catch (err) {
    results.errors.push(err.message);
  }

  return Response.json(results);
}

// Also support GET for quick env check without auth
export async function GET() {
  return Response.json({
    timestamp: new Date().toISOString(),
    env_check: {
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      VECTORENGINE_API_KEY: !!process.env.VECTORENGINE_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    providers_available: [
      process.env.GROQ_API_KEY && "groq",
      process.env.GOOGLE_GENERATIVE_AI_API_KEY && "google",
      process.env.OPENAI_API_KEY && "openai",
      process.env.VECTORENGINE_API_KEY && "vectorengine",
    ].filter(Boolean),
  });
}
