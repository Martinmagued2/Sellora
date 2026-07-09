/**
 * GET /api/debug/telegram-status
 * Checks if the Telegram bot is properly configured and the webhook is live.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account" }, { status: 404 });

    const db = admin();
    const { data: account } = await db
      .from("accounts")
      .select("id, telegram_bot_token, telegram_connected, telegram_bot_username, ai_enabled, plan")
      .eq("id", effectiveAccountId)
      .maybeSingle();

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const result = {
      account: {
        id: account.id,
        telegram_connected: account.telegram_connected,
        telegram_bot_username: account.telegram_bot_username,
        has_bot_token: !!account.telegram_bot_token,
        ai_enabled: account.ai_enabled,
        plan: account.plan,
      },
      webhook_url: account.telegram_bot_token
        ? `${process.env.NEXT_PUBLIC_APP_URL || "https://www.sellorachat.com"}/api/webhooks/telegram?token=${account.telegram_bot_token.slice(0, 10)}...`
        : null,
    };

    // Check if Telegram webhook is actually registered
    if (account.telegram_bot_token) {
      try {
        const TELEGRAM_API_BASE = "https://api.telegram.org";
        const res = await fetch(`${TELEGRAM_API_BASE}/bot${account.telegram_bot_token}/getWebhookInfo`);
        const data = await res.json();
        result.telegram_webhook_info = {
          ok: data.ok,
          url: data.result?.url || "NOT SET",
          has_custom_certificate: data.result?.has_custom_certificate || false,
          pending_update_count: data.result?.pending_update_count || 0,
          last_error_date: data.result?.last_error_date
            ? new Date(data.result.last_error_date * 1000).toISOString()
            : null,
          last_error_message: data.result?.last_error_message || null,
          max_connections: data.result?.max_connections || 40,
        };

        // Diagnosis
        const diagnosis = [];
        if (!data.result?.url) {
          diagnosis.push("❌ Webhook URL is NOT set on Telegram — reconnect the bot in Settings");
        } else if (!data.result.url.includes("sellorachat.com")) {
          diagnosis.push(`❌ Webhook URL points to old domain: ${data.result.url} — reconnect the bot`);
        } else {
          diagnosis.push("✅ Webhook URL is correctly set to sellorachat.com");
        }
        if (data.result?.pending_update_count > 0) {
          diagnosis.push(`⚠️ ${data.result.pending_update_count} pending updates not delivered`);
        }
        if (data.result?.last_error_message) {
          diagnosis.push(`❌ Last webhook error: ${data.result.last_error_message}`);
        }
        if (!account.ai_enabled) {
          diagnosis.push("❌ AI auto-reply is DISABLED for this account — enable it in Settings");
        }
        result.diagnosis = diagnosis;
      } catch (e) {
        result.telegram_webhook_info = { error: e.message };
        result.diagnosis = ["❌ Failed to check Telegram webhook — bot token may be invalid"];
      }
    } else {
      result.diagnosis = ["❌ No Telegram bot token found — connect the bot in Settings → Channels"];
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
