import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTOTP } from "@/lib/totp";

// Lazy Supabase admin client (server-side only)
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

/**
 * POST /api/auth/2fa/disable
 *
 * Disables 2FA after verifying the current TOTP code.
 * SECURITY: Backup codes can NO LONGER be used to disable 2FA.
 * Backup codes are only for login verification, not for security-setting changes.
 * A user must provide their current TOTP code from the authenticator app.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    // SECURITY: Reject backup codes for disabling 2FA
    if (code.includes("-") && code.length === 9) {
      return NextResponse.json({
        error: "Backup codes cannot be used to disable 2FA. Please use a code from your authenticator app.",
      }, { status: 400 });
    }

    // Get the user from the Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = getSupabase();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
    }

    // Get the account with TOTP secret
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("totp_secret, totp_enabled, last_totp_time_step")
      .eq("id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!account.totp_enabled) {
      return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
    }

    if (!account.totp_secret) {
      return NextResponse.json({ error: "No TOTP secret found" }, { status: 400 });
    }

    // Verify TOTP code with replay protection
    const result = verifyTOTP(account.totp_secret, code, 1, account.last_totp_time_step);

    if (!result.valid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Disable 2FA - clear all TOTP data
    await supabase
      .from("accounts")
      .update({
        totp_enabled: false,
        totp_secret: null,
        totp_backup_codes: [],
        last_totp_time_step: null,
        two_factor_verified_at: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ disabled: true });
  } catch (err) {
    console.error("[2FA Disable] Error:", err);
    return NextResponse.json({ error: "Failed to disable 2FA" }, { status: 500 });
  }
}
