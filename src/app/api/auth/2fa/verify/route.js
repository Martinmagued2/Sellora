import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTOTP, generateBackupCodes } from "@/lib/totp";

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
 * POST /api/auth/2fa/verify
 *
 * Verifies a TOTP code. Used for:
 * 1. Setup verification (enabling 2FA for the first time)
 * 2. Login verification (authenticating with 2FA after login)
 * 3. Backup code verification
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { code, setupVerification, userId } = body;

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Determine the user
    let targetUserId = userId;

    if (!targetUserId) {
      // Try to get from auth header
      const authHeader = request.headers.get("authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
        }
        targetUserId = user.id;
      } else {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
    }

    // Get the account with TOTP secret
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("totp_secret, totp_enabled, totp_backup_codes, email")
      .eq("id", targetUserId)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // For login verification, 2FA must already be enabled
    if (!setupVerification && !account.totp_enabled) {
      return NextResponse.json({ error: "2FA is not enabled on this account" }, { status: 400 });
    }

    // For setup verification, we need the secret (not yet enabled)
    if (setupVerification && !account.totp_secret) {
      return NextResponse.json({ error: "No TOTP secret found. Start setup first." }, { status: 400 });
    }

    if (!account.totp_secret) {
      return NextResponse.json({ error: "No TOTP secret configured" }, { status: 400 });
    }

    // Check if it's a backup code (8-char format: XXXX-XXXX)
    if (code.includes("-") && code.length === 9) {
      const backupCodes = account.totp_backup_codes || [];
      if (backupCodes.includes(code)) {
        // Remove the used backup code
        const updatedCodes = backupCodes.filter(c => c !== code);
        await supabase
          .from("accounts")
          .update({ totp_backup_codes: updatedCodes })
          .eq("id", targetUserId);

        return NextResponse.json({ verified: true, method: "backup_code" });
      }
      return NextResponse.json({ error: "Invalid backup code" }, { status: 400 });
    }

    // Verify TOTP code
    const isValid = verifyTOTP(account.totp_secret, code);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // If this is a setup verification, enable 2FA and generate backup codes
    if (setupVerification) {
      const backupCodes = generateBackupCodes(8);

      await supabase
        .from("accounts")
        .update({
          totp_enabled: true,
          totp_backup_codes: backupCodes,
        })
        .eq("id", targetUserId);

      return NextResponse.json({
        verified: true,
        enabled: true,
        backupCodes,
      });
    }

    // For login verification, just return success
    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("[2FA Verify] Error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
