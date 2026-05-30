/**
 * Webhook Diagnostic Endpoint
 * GET /api/webhooks/status
 *
 * Returns the current webhook configuration status and helps debug
 * why incoming messages might not be working.
 *
 * Checks:
 * 1. Environment variables (META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, etc.)
 * 2. Database accounts table (instagram_page_id, facebook_page_id, tokens)
 * 3. Recent messages in the database
 * 4. Webhook URL format
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    env_vars: {},
    accounts: [],
    recent_messages: [],
    issues: [],
    webhook_urls: {},
  };

  // ─── 1. Check Environment Variables ───
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING",
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID || "MISSING",
    META_APP_SECRET: process.env.META_APP_SECRET ? "SET" : "MISSING",
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN ? "SET" : "MISSING",
    GROQ_API_KEY: process.env.GROQ_API_KEY ? "SET" : "MISSING",
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "SET" : "MISSING",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "SET" : "MISSING",
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ? "SET" : "MISSING",
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET ? "SET" : "MISSING",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "SET" : "MISSING",
  };

  diagnostics.env_vars = envVars;

  // ─── 2. Check Critical Issues ───
  if (!process.env.META_APP_SECRET) {
    diagnostics.issues.push({
      severity: "CRITICAL",
      issue: "META_APP_SECRET is not set",
      impact: "All incoming webhooks will be rejected (401). Meta cannot verify the signature.",
      fix: "Add META_APP_SECRET to your Vercel environment variables. Find it in Meta App Dashboard > Settings > Basic > App Secret.",
    });
  }

  if (!process.env.META_WEBHOOK_VERIFY_TOKEN) {
    diagnostics.issues.push({
      severity: "CRITICAL",
      issue: "META_WEBHOOK_VERIFY_TOKEN is not set",
      impact: "Webhook verification will fail. Meta cannot subscribe to your webhook.",
      fix: "Add META_WEBHOOK_VERIFY_TOKEN to your Vercel environment variables. Use any string you want (e.g., 'sellora_verify_2024').",
    });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    diagnostics.issues.push({
      severity: "CRITICAL",
      issue: "SUPABASE_SERVICE_ROLE_KEY is not set",
      impact: "Webhook processor cannot access the database.",
      fix: "Add SUPABASE_SERVICE_ROLE_KEY to your Vercel environment variables.",
    });
  }

  // ─── 3. Check Database Accounts ───
  try {
    const supabase = getSupabase();

    const { data: accounts, error: accountsError } = await supabase
      .from("accounts")
      .select(
        "id, business_name, instagram_page_id, instagram_connected, instagram_access_token, facebook_page_id, facebook_connected, facebook_access_token, ai_enabled, auto_greeting, plan"
      )
      .limit(10);

    if (accountsError) {
      diagnostics.issues.push({
        severity: "CRITICAL",
        issue: "Cannot query accounts table: " + accountsError.message,
        impact: "Webhook cannot look up accounts for incoming messages.",
        fix: "Check Supabase connection and accounts table schema.",
      });
    } else {
      diagnostics.accounts = (accounts || []).map((acct) => ({
        id: acct.id,
        business_name: acct.business_name,
        plan: acct.plan,
        ai_enabled: acct.ai_enabled,
        auto_greeting: acct.auto_greeting,
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

      // Check for common account issues
      for (const acct of accounts || []) {
        if (acct.instagram_connected && !acct.instagram_page_id) {
          diagnostics.issues.push({
            severity: "HIGH",
            issue: `Account "${acct.business_name}" is Instagram-connected but instagram_page_id is NULL`,
            impact: "Instagram webhook messages cannot be routed to this account.",
            fix: "Re-connect Instagram in Settings to set the page ID.",
          });
        }
        if (acct.instagram_connected && !acct.instagram_access_token) {
          diagnostics.issues.push({
            severity: "HIGH",
            issue: `Account "${acct.business_name}" is Instagram-connected but has no access token`,
            impact: "Cannot send replies or fetch user profiles for Instagram messages.",
            fix: "Re-connect Instagram in Settings to refresh the token.",
          });
        }
        if (acct.facebook_connected && !acct.facebook_page_id) {
          diagnostics.issues.push({
            severity: "HIGH",
            issue: `Account "${acct.business_name}" is Facebook-connected but facebook_page_id is NULL`,
            impact: "Facebook webhook messages cannot be routed to this account.",
            fix: "Re-connect Facebook in Settings to set the page ID.",
          });
        }
      }
    }

    // ─── 4. Check Recent Messages ───
    const { data: recentMessages, error: msgError } = await supabase
      .from("messages")
      .select("id, direction, content, created_at, is_ai, intent, sentiment")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!msgError && recentMessages) {
      diagnostics.recent_messages = recentMessages.map((m) => ({
        id: m.id.substring(0, 8) + "...",
        direction: m.direction,
        content: m.content?.substring(0, 60) + "...",
        created_at: m.created_at,
        is_ai: m.is_ai,
        intent: m.intent,
        sentiment: m.sentiment,
      }));
    }

    // ─── 5. Check Recent Conversations ───
    const { data: recentConvs } = await supabase
      .from("conversations")
      .select("id, channel, status, last_message_at, unread_count")
      .order("last_message_at", { ascending: false })
      .limit(5);

    diagnostics.recent_conversations = recentConvs || [];

  } catch (dbErr) {
    diagnostics.issues.push({
      severity: "CRITICAL",
      issue: "Database connection error: " + dbErr.message,
      impact: "Cannot query any data from Supabase.",
      fix: "Check SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.",
    });
  }

  // ─── 6. Webhook URL Info ───
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sellora-ruby.vercel.app";
  diagnostics.webhook_urls = {
    unified: `${appUrl}/api/webhook`,
    instagram: `${appUrl}/api/webhooks/instagram`,
    facebook: `${appUrl}/api/webhooks/facebook`,
    whatsapp: `${appUrl}/api/webhooks/whatsapp`,
    recommendation: `Use the UNIFIED URL (${appUrl}/api/webhook) in your Meta App Dashboard for both Instagram and Messenger products.`,
  };

  // ─── 7. Meta App Setup Instructions ───
  diagnostics.meta_setup_instructions = {
    step1: "Go to Meta App Dashboard: https://developers.facebook.com/apps/1334725352095579/",
    step2: "For Instagram: Go to Instagram > Webhooks, set Callback URL to: " + appUrl + "/api/webhook",
    step3: "For Messenger: Go to Messenger > Webhooks, set Callback URL to: " + appUrl + "/api/webhook",
    step4: "Use your META_WEBHOOK_VERIFY_TOKEN as the Verify Token",
    step5: "Subscribe to these events: messages, messaging_postbacks",
    step6: "Make sure your Page is subscribed: Instagram > Webhooks > select your Page",
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
