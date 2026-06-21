import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTOTP, generateBackupCodes, decryptSecret } from "@/lib/totp";
import crypto from "crypto";

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
 *
 * SECURITY FIXES:
 * - Always requires authenticated user via Authorization header
 * - Removed userId body parameter (was allowing unauthenticated access)
 * - Added TOTP replay protection (tracks last_used_time_step)
 * - Records 2FA verification server-side for middleware enforcement
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { code, setupVerification } = body;

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    // SECURITY: Always require authentication via Authorization header
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

    const targetUserId = user.id;

    // Get the account with TOTP secret (do NOT expose secret to client)
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("totp_secret, totp_enabled, totp_backup_codes, email, last_totp_time_step")
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
      const found = backupCodes.some(bc =>
        bc.length === code.length && crypto.timingSafeEqual(Buffer.from(bc), Buffer.from(code))
      );
      if (found) {
        // Remove the used backup code
        const updatedCodes = backupCodes.filter(c => c !== code);
        await supabase
          .from("accounts")
          .update({
            totp_backup_codes: updatedCodes,
            two_factor_verified_at: new Date().toISOString(),
          })
          .eq("id", targetUserId);

        return NextResponse.json({ verified: true, method: "backup_code" });
      }
      return NextResponse.json({ error: "Invalid backup code" }, { status: 400 });
    }

    // Verify TOTP code with replay protection
    // 🔒 FIX: window=2 (±60 seconds) for better clock skew tolerance
    const result = verifyTOTP(account.totp_secret, code, 2, account.last_totp_time_step);

    if (!result.valid) {
      // 🔒 DIAGNOSTIC: log enough to debug without exposing the secret
      const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
      console.warn("[2FA Verify] Failed", {
        userId: targetUserId.slice(0, 8),
        hasSecret: !!account.totp_secret,
        secretFormat: account.totp_secret?.startsWith("enc:v1:") ? "encrypted" : "plaintext",
        codeLength: code.length,
        currentTimeStep,
        lastUsedTimeStep: account.last_totp_time_step,
        // Don't log the actual code or secret — just metadata
      });
      return NextResponse.json({ error: "Invalid verification code. Make sure your device clock is accurate and try the latest code from your authenticator app." }, { status: 400 });
    }

    // Update the last used time step for replay protection
    const updateData = {
      last_totp_time_step: result.timeStep,
      two_factor_verified_at: new Date().toISOString(),
    };

    // If this is a setup verification, enable 2FA and generate backup codes
    if (setupVerification) {
      const backupCodes = generateBackupCodes(8);
      updateData.totp_enabled = true;
      updateData.totp_backup_codes = backupCodes;

      await supabase
        .from("accounts")
        .update(updateData)
        .eq("id", targetUserId);

      return NextResponse.json({
        verified: true,
        enabled: true,
        backupCodes,
      });
    }

    // For login verification, update replay protection + 2FA verified timestamp
    await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", targetUserId);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("[2FA Verify] Error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
