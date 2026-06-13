/**
 * AI Debug Endpoint
 * GET /api/ai/debug?accountId=xxx  — Tests AI for a specific account (no auth needed)
 * POST /api/ai/debug               — Tests AI for the authenticated user
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { verifyAdmin } from "@/lib/admin-auth";
import { collectKeys, getProviderChainSummary, buildFullProviderChain } from "@/lib/ai/provider-chain";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(req) {
  // 🔒 CRITICAL: Require admin auth — GET with accountId leaks tokens & config
  const { isAdmin } = await verifyAdmin(req);
  if (!isAdmin) {
    return Response.json({ error: "Unauthorized — admin access required" }, { status: 401 });
  }

  const results = {
    timestamp: new Date().toISOString(),
    env_check: {
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      GROQ_API_KEY_2: !!process.env.GROQ_API_KEY_2,
      GROQ_API_KEY_3: !!process.env.GROQ_API_KEY_3,
      GROQ_API_KEYS: !!process.env.GROQ_API_KEYS,
      NVIDIA_API_KEY: !!process.env.NVIDIA_API_KEY,
      NVIDIA_API_KEY_2: !!process.env.NVIDIA_API_KEY_2,
      NVIDIA_API_KEYS: !!process.env.NVIDIA_API_KEYS,
      GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      GOOGLE_API_KEYS: !!process.env.GOOGLE_API_KEYS,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_API_KEYS: !!process.env.OPENAI_API_KEYS,
      VECTORENGINE_API_KEY: !!process.env.VECTORENGINE_API_KEY,
    },
    multi_key_summary: getProviderChainSummary(),
    provider_chain: buildFullProviderChain().map(p => ({ name: p.name, provider: p._provider, keyIndex: p._keyIndex })),
    providers_available: [
      process.env.GROQ_API_KEY && "groq",
      process.env.GOOGLE_GENERATIVE_AI_API_KEY && "google",
      process.env.OPENAI_API_KEY && "openai",
      process.env.VECTORENGINE_API_KEY && "vectorengine",
    ].filter(Boolean),
  };

  // If accountId is provided, do full diagnostic for that account
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  if (accountId) {
    results.full_diagnostic = await runFullDiagnostic(accountId);
  }

  return Response.json(results);
}

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

  // 3. Test the full generateAIReply function
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

    results.ai_reply_test = await runFullDiagnostic(user.id);
  } catch (err) {
    results.errors.push(err.message);
  }

  return Response.json(results);
}

async function runFullDiagnostic(accountId) {
  const adminClient = getAdminClient();
  const diag = { steps: [] };

  // Step 1: Account lookup
  const { data: account, error: acctErr } = await adminClient
    .from("accounts")
    .select("id, email, business_name, country, ai_enabled, ai_personality, plan")
    .eq("id", accountId)
    .single();

  if (acctErr || !account) {
    diag.steps.push({ step: "account_lookup", status: "failed", error: acctErr?.message || "Account not found" });
    return diag;
  }
  diag.steps.push({ step: "account_lookup", status: "success", data: { 
    email: account.email, plan: account.plan, ai_enabled: account.ai_enabled, business_name: account.business_name 
  }});

  // Step 2: Rate limit check
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: aiAutoReplyCount } = await adminClient
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("email", accountId)
    .eq("action", "ai_auto_reply")
    .gte("created_at", oneDayAgo);

  const { count: aiSimulateCount } = await adminClient
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("email", account.email)
    .eq("action", "ai_simulate")
    .gte("created_at", oneDayAgo);

  const { count: copilotCount } = await adminClient
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("email", account.email)
    .eq("action", "copilot_msg")
    .gte("created_at", oneDayAgo);

  const { getPlanLimits } = await import("@/lib/plan-limits");
  const planLimits = getPlanLimits(account.plan);

  diag.steps.push({ step: "rate_limits", status: "checked", data: {
    ai_auto_reply: { used: aiAutoReplyCount || 0, limit: planLimits.ai_replies_per_day === -1 ? "unlimited" : planLimits.ai_replies_per_day },
    ai_simulate: { used: aiSimulateCount || 0, limit: planLimits.ai_simulate_per_day === -1 ? "unlimited" : planLimits.ai_simulate_per_day },
    copilot: { used: copilotCount || 0, limit: planLimits.copilot_msgs_per_day === -1 ? "unlimited" : planLimits.copilot_msgs_per_day },
  }});

  // Step 3: Test intent routing
  const { routeMessage } = await import("@/lib/ai/router");
  const routingStart = Date.now();
  try {
    const routingResult = await routeMessage("Hi, I want to buy a product", []);
    diag.steps.push({ step: "intent_routing", status: "success", latency_ms: Date.now() - routingStart, data: routingResult });
  } catch (err) {
    diag.steps.push({ step: "intent_routing", status: "failed", error: err.message?.substring(0, 200) });
  }

  // Step 4: Test generateAIReply
  const { generateAIReply } = await import("@/lib/ai");
  const aiStart = Date.now();
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

    diag.steps.push({
      step: "generate_ai_reply",
      status: aiResult.reply ? "success" : "no_reply",
      latency_ms: Date.now() - aiStart,
      data: {
        reply_preview: aiResult.reply?.substring(0, 300),
        intent: aiResult.intent,
        sentiment: aiResult.sentiment,
        has_tool_calls: !!(aiResult.toolCalls && aiResult.toolCalls.length > 0),
        tool_calls_count: aiResult.toolCalls?.length || 0,
      },
    });
  } catch (aiErr) {
    diag.steps.push({
      step: "generate_ai_reply",
      status: "failed",
      latency_ms: Date.now() - aiStart,
      error: aiErr.message?.substring(0, 500),
      stack: aiErr.stack?.split('\n').slice(0, 8).join('\n'),
    });
  }

  // Step 5: Check products exist for AI context
  const { count: productCount } = await adminClient
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("status", "active");

  diag.steps.push({ step: "product_catalog", status: "checked", data: { active_products: productCount || 0 } });

  // Step 6: Check business policies
  const { count: policyCount } = await adminClient
    .from("business_policies")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("is_active", true);

  diag.steps.push({ step: "business_policies", status: "checked", data: { active_policies: policyCount || 0 } });

  // Step 7: Check FAQs
  const { count: faqCount } = await adminClient
    .from("faqs")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("is_active", true);

  diag.steps.push({ step: "faqs", status: "checked", data: { active_faqs: faqCount || 0 } });

  // Step 8: Test Meta API delivery (get tokens and try a lightweight API call)
  try {
    const { data: accountTokens } = await adminClient
      .from("accounts")
      .select("instagram_access_token, instagram_page_id, instagram_connected, facebook_access_token, facebook_page_id, facebook_connected")
      .eq("id", accountId)
      .single();

    if (accountTokens) {
      const metaStatus = {
        instagram: {
          connected: accountTokens.instagram_connected,
          has_page_id: !!accountTokens.instagram_page_id,
          has_token: !!accountTokens.instagram_access_token,
          // 🔒 SECURITY: Do NOT expose token previews
        },
        facebook: {
          connected: accountTokens.facebook_connected,
          has_page_id: !!accountTokens.facebook_page_id,
          has_token: !!accountTokens.facebook_access_token,
          // 🔒 SECURITY: Do NOT expose token previews
        },
      };

      // Test Instagram token validity by calling the Graph API
      if (accountTokens.instagram_access_token && accountTokens.instagram_page_id) {
        try {
          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${accountTokens.instagram_page_id}?fields=id,name&access_token=${accountTokens.instagram_access_token}`,
            { signal: AbortSignal.timeout(5000) }
          );
          const metaData = await metaRes.json();
          metaStatus.instagram.token_valid = metaRes.ok;
          metaStatus.instagram.api_response = metaRes.ok ? { id: metaData.id, name: metaData.name } : { error: metaData.error?.message?.substring(0, 200) };
        } catch (metaErr) {
          metaStatus.instagram.token_valid = false;
          metaStatus.instagram.api_error = metaErr.message?.substring(0, 100);
        }
      }

      // Test Facebook token validity
      if (accountTokens.facebook_access_token && accountTokens.facebook_page_id) {
        try {
          const fbRes = await fetch(
            `https://graph.facebook.com/v21.0/${accountTokens.facebook_page_id}?fields=id,name&access_token=${accountTokens.facebook_access_token}`,
            { signal: AbortSignal.timeout(5000) }
          );
          const fbData = await fbRes.json();
          metaStatus.facebook.token_valid = fbRes.ok;
          metaStatus.facebook.api_response = fbRes.ok ? { id: fbData.id, name: fbData.name } : { error: fbData.error?.message?.substring(0, 200) };
        } catch (fbErr) {
          metaStatus.facebook.token_valid = false;
          metaStatus.facebook.api_error = fbErr.message?.substring(0, 100);
        }
      }

      diag.steps.push({ step: "meta_delivery", status: "checked", data: metaStatus });
    }
  } catch (tokenErr) {
    diag.steps.push({ step: "meta_delivery", status: "failed", error: tokenErr.message });
  }

  // Summary
  const rateLimitStep = diag.steps.find(s => s.step === "rate_limits");
  const aiReplyStep = diag.steps.find(s => s.step === "generate_ai_reply");
  
  diag.summary = {
    ai_enabled: account.ai_enabled,
    ai_reply_works: aiReplyStep?.status === "success",
    rate_limited: rateLimitStep?.data?.ai_auto_reply?.used >= (planLimits.ai_replies_per_day === -1 ? Infinity : planLimits.ai_replies_per_day),
    groq_available: !!process.env.GROQ_API_KEY,
    google_available: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    google_quota_exceeded: false, // Will be updated if Google fails
  };

  return diag;
}
