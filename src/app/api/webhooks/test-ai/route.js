/**
 * Test endpoint to simulate the full webhook → AI pipeline
 * GET /api/webhooks/test-ai?accountId=xxx
 * 
 * This simulates what happens when a customer sends a message,
 * going through the entire processIncomingMessage flow.
 */

import { createClient } from "@supabase/supabase-js";
import { generateAIReply, analyzeIntent } from "@/lib/ai";
import { getPlanLimits } from "@/lib/plan-limits";
import { verifyAdmin } from "@/lib/admin-auth";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(req) {
  // 🔒 CRITICAL: Require admin auth — endpoint leaks tokens & account data
  const { isAdmin } = await verifyAdmin(req);
  if (!isAdmin) {
    return Response.json({ error: "Unauthorized — admin access required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const testMessage = searchParams.get("message") || "Hi, what products do you sell?";

  if (!accountId) {
    return Response.json({ error: "accountId is required" }, { status: 400 });
  }

  const results = { steps: [], timestamp: new Date().toISOString() };
  const adminClient = getAdminClient();

  // Step 1: Account lookup (same as processor)
  const { data: account, error: acctErr } = await adminClient
    .from("accounts")
    .select("id, email, ai_enabled, ai_personality, plan, business_name, country, facebook_page_id, facebook_access_token, instagram_page_id, instagram_access_token")
    .eq("id", accountId)
    .single();

  if (acctErr || !account) {
    results.steps.push({ step: "account_lookup", status: "failed", error: acctErr?.message || "Not found" });
    return Response.json(results);
  }

  results.steps.push({ step: "account_lookup", status: "success", data: {
    email: account.email,
    ai_enabled: account.ai_enabled,
    plan: account.plan,
    business_name: account.business_name,
    has_fb_token: !!account.facebook_access_token,
    has_ig_token: !!account.instagram_access_token,
    fb_page_id: account.facebook_page_id,
  }});

  // Step 2: Rate limit check (same as processor)
  const planLimits = getPlanLimits(account.plan || "starter");
  const MAX_AI_PER_ACCOUNT_PER_DAY = planLimits.ai_replies_per_day;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let aiCount = 0;
  if (MAX_AI_PER_ACCOUNT_PER_DAY !== -1) {
    const { count } = await adminClient
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("email", accountId)
      .eq("action", "ai_auto_reply")
      .gte("created_at", oneDayAgo);
    aiCount = count || 0;
  }

  results.steps.push({ step: "rate_limit", status: "checked", data: {
    used: aiCount,
    limit: MAX_AI_PER_ACCOUNT_PER_DAY,
    would_block: MAX_AI_PER_ACCOUNT_PER_DAY !== -1 && aiCount >= MAX_AI_PER_ACCOUNT_PER_DAY,
  }});

  // Step 3: Check the AI enabled condition
  const aiWouldRun = account.ai_enabled && testMessage;
  results.steps.push({ step: "ai_condition", status: "checked", data: {
    ai_enabled: account.ai_enabled,
    has_text: !!testMessage,
    would_run: aiWouldRun,
  }});

  if (!aiWouldRun) {
    results.summary = { issue: account.ai_enabled ? "No text provided" : "AI is disabled" };
    return Response.json(results);
  }

  // Step 4: Analyze intent (same as processor step 4)
  try {
    const intentResult = await analyzeIntent(testMessage);
    results.steps.push({ step: "intent_analysis", status: "success", data: intentResult });
  } catch (err) {
    results.steps.push({ step: "intent_analysis", status: "failed", error: err.message });
  }

  // Step 5: Test generateAIReply (same as processor step 10)
  try {
    const { data: products } = await adminClient
      .from("products")
      .select("name, price, description, category")
      .eq("account_id", accountId)
      .eq("status", "active")
      .limit(50);

    results.steps.push({ step: "product_fetch", status: "success", data: { count: products?.length || 0 } });

    const aiStart = Date.now();
    const aiResult = await generateAIReply({
      accountId: account.id,
      customerId: "00000000-0000-0000-0000-000000000000",
      customerMessage: testMessage,
      customerName: "Test Customer",
      personality: account.ai_personality,
      country: account.country,
      businessName: account.business_name,
      conversationHistory: [],
      plan: account.plan,
    });

    results.steps.push({
      step: "generate_ai_reply",
      status: aiResult?.reply ? "success" : "no_reply",
      latency_ms: Date.now() - aiStart,
      data: {
        has_reply: !!aiResult?.reply,
        reply_preview: aiResult?.reply?.substring(0, 200),
        reply_length: aiResult?.reply?.length,
        intent: aiResult?.intent,
        sentiment: aiResult?.sentiment,
        has_tool_calls: !!(aiResult?.toolCalls?.length),
      },
    });

    // Step 6: Test Meta delivery check
    if (aiResult?.reply && account.facebook_access_token && account.facebook_page_id) {
      results.steps.push({ step: "meta_delivery_check", status: "ready", data: {
        has_fb_token: true,
        has_page_id: true,
        // 🔒 SECURITY: Do NOT expose token previews
        note: "Token exists, AI reply WOULD be delivered to Facebook",
      }});
    } else if (aiResult?.reply) {
      results.steps.push({ step: "meta_delivery_check", status: "blocked", data: {
        has_fb_token: !!account.facebook_access_token,
        has_page_id: !!account.facebook_page_id,
        note: "Missing token or page_id — AI reply would NOT be delivered to FB customer",
      }});
    }

  } catch (aiErr) {
    results.steps.push({
      step: "generate_ai_reply",
      status: "failed",
      error: aiErr.message,
      stack: aiErr.stack?.substring(0, 500),
    });
  }

  // Summary
  const aiStep = results.steps.find(s => s.step === "generate_ai_reply");
  results.summary = {
    ai_enabled: account.ai_enabled,
    ai_reply_works: aiStep?.status === "success",
    rate_limited: MAX_AI_PER_ACCOUNT_PER_DAY !== -1 && aiCount >= MAX_AI_PER_ACCOUNT_PER_DAY,
    likely_issue: aiStep?.status === "failed" ? "AI generation is failing: " + aiStep.error :
                  aiStep?.status === "no_reply" ? "AI returns empty reply" :
                  aiStep?.status === "success" ? "AI works fine — issue is likely in webhook not reaching the processor" : "Unknown",
  };

  return Response.json(results);
}
