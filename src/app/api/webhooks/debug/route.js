/**
 * Webhook Debug Endpoint
 * GET /api/webhooks/debug
 *
 * Returns comprehensive diagnostics about why incoming messages
 * might not be working. Requires admin authentication.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

export async function GET(request) {
  // ── Admin authentication required ──
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = {
    timestamp: new Date().toISOString(),
    can_receive_incoming: false,
    issues: [],
    fix_instructions: [],
  };

  // ─── Step 1: Check environment variables ───
  const metaAppSecret = process.env.META_APP_SECRET;
  const metaVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  result.env_vars = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? "SET" : "MISSING",
    META_APP_SECRET: metaAppSecret ? "SET" : "MISSING",
    META_WEBHOOK_VERIFY_TOKEN: metaVerifyToken ? "SET" : "MISSING",
    GROQ_API_KEY: groqKey ? "SET" : "MISSING",
    GOOGLE_GENERATIVE_AI_API_KEY: googleKey ? "SET" : "MISSING",
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID || "MISSING",
  };

  if (!metaAppSecret) {
    result.issues.push({
      severity: "CRITICAL",
      issue: "META_APP_SECRET is not set in Vercel environment variables",
      impact: "All incoming webhooks are rejected. Meta sends messages but your server refuses them.",
    });
  }

  if (!metaVerifyToken) {
    result.issues.push({
      severity: "CRITICAL",
      issue: "META_WEBHOOK_VERIFY_TOKEN is not set in Vercel environment variables",
      impact: "You cannot register the webhook URL with Meta. Meta won't send you any events.",
    });
  }

  if (!serviceRoleKey) {
    result.issues.push({
      severity: "CRITICAL",
      issue: "SUPABASE_SERVICE_ROLE_KEY is not set",
      impact: "Webhook processor cannot write to the database.",
    });
  }

  // ─── Step 2: Check account configuration ───
  try {
    const supabase = getSupabase();
    const { data: accounts, error: acctErr } = await supabase
      .from("accounts")
      .select("id, email, business_name, instagram_page_id, instagram_connected, instagram_access_token, facebook_page_id, facebook_connected, facebook_access_token, ai_enabled, plan, role")
      .limit(10);

    if (acctErr) {
      result.issues.push({
        severity: "CRITICAL",
        issue: "Cannot query accounts table: " + acctErr.message,
      });
    } else {
      result.accounts = (accounts || []).map((acct) => ({
        id: acct.id,
        email: acct.email,
        business_name: acct.business_name,
        plan: acct.plan,
        ai_enabled: acct.ai_enabled,
        role: acct.role || "NOT SET",
        instagram: {
          connected: acct.instagram_connected,
          page_id: acct.instagram_page_id || "NOT SET",
          has_token: !!acct.instagram_access_token,
        },
        facebook: {
          connected: acct.facebook_connected,
          page_id: acct.facebook_page_id || "NOT SET",
          has_token: !!acct.facebook_access_token,
        },
      }));

      for (const acct of accounts || []) {
        if (acct.instagram_connected && !acct.instagram_page_id) {
          result.issues.push({
            severity: "HIGH",
            issue: `Account ${acct.email} is Instagram-connected but instagram_page_id is NULL`,
          });
        }
        if (acct.instagram_connected && !acct.instagram_access_token) {
          result.issues.push({
            severity: "HIGH",
            issue: `Account ${acct.email} is Instagram-connected but has no access token`,
          });
        }
        if (!acct.ai_enabled) {
          result.issues.push({
            severity: "MEDIUM",
            issue: `Account ${acct.email} has AI auto-reply disabled`,
          });
        }
      }
    }
  } catch (err) {
    result.issues.push({
      severity: "CRITICAL",
      issue: "Database connection error: " + err.message,
    });
  }

  // ─── Step 3: Check recent messages ───
  try {
    const supabase = getSupabase();

    const { data: recentIncoming } = await supabase
      .from("messages")
      .select("id, direction, content, created_at, is_ai, account_id")
      .eq("direction", "incoming")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentOutgoing } = await supabase
      .from("messages")
      .select("id, direction, content, created_at, is_ai, account_id")
      .eq("direction", "outgoing")
      .order("created_at", { ascending: false })
      .limit(5);

    result.recent_incoming_count = (recentIncoming || []).length;
    result.recent_outgoing_count = (recentOutgoing || []).length;
    result.last_incoming = recentIncoming?.[0] || null;
    result.last_outgoing = recentOutgoing?.[0] || null;

    if ((recentIncoming || []).length === 0 && (recentOutgoing || []).length > 0) {
      result.issues.push({
        severity: "CRITICAL",
        issue: "Outgoing messages exist but ZERO incoming messages — webhook pipeline is broken",
      });
    }
  } catch (err) {
    // Non-critical
  }

  // ─── Step 4: AI Provider check ───
  if (!groqKey && !googleKey) {
    result.issues.push({
      severity: "HIGH",
      issue: "No AI provider API key (neither GROQ_API_KEY nor GOOGLE_GENERATIVE_AI_API_KEY)",
    });
  }

  // ─── Final verdict ───
  const criticalIssues = result.issues.filter((i) => i.severity === "CRITICAL");
  result.can_receive_incoming = criticalIssues.length === 0;

  if (!result.can_receive_incoming) {
    result.fix_instructions = [
      "INCOMING MESSAGES ARE BROKEN. Fix these in order:",
      "",
      `1. ${metaAppSecret ? "OK" : "FIX"} Add META_APP_SECRET to Vercel env vars (Meta App Dashboard > Settings > Basic > App Secret)`,
      `2. ${metaVerifyToken ? "OK" : "FIX"} Add META_WEBHOOK_VERIFY_TOKEN to Vercel env vars (pick any secure string)`,
      `3. ${serviceRoleKey ? "OK" : "FIX"} Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars`,
      `4. ${(groqKey || googleKey) ? "OK" : "FIX"} Add GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to Vercel env vars`,
      "5. Redeploy on Vercel",
      "6. Go to Meta App Dashboard > Webhooks > Add Callback URL: https://sellora-ruby.vercel.app/api/webhook",
      "7. Use the META_WEBHOOK_VERIFY_TOKEN you set in step 2 as the Verify Token",
      "8. Subscribe to: messages, messaging_postbacks (for both Instagram and Messenger)",
      "9. Make sure your Page is selected at the bottom of the webhooks page",
    ];
  }

  return NextResponse.json(result, { status: 200 });
}
