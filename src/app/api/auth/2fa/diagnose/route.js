import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTOTP, calculateTOTP, decryptSecret } from "@/lib/totp";
import { getAuthUser } from "@/lib/auth-helper";

// GET /api/auth/2fa/diagnose
// Diagnostic endpoint for troubleshooting "always incorrect" TOTP codes.
// Accepts EITHER Bearer token OR cookie-based session auth (same as other routes).
// Returns what the server's TOTP calculation produces vs what the user should
// be entering — WITHOUT exposing the secret.

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
  const diag = { ts: new Date().toISOString() };

  try {
    // 🔒 Use getAuthUser which accepts BOTH Bearer token AND cookie session
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ ...diag, error: "Not authenticated — log in to the dashboard first" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("totp_secret, totp_enabled, last_totp_time_step, email")
      .eq("id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ ...diag, error: "Account not found", accountError }, { status: 404 });
    }

    diag.account = {
      hasSecret: !!account.totp_secret,
      secretFormat: account.totp_secret?.startsWith("enc:v1:") ? "encrypted" : "plaintext",
      secretLength: account.totp_secret?.length || 0,
      totpEnabled: account.totp_enabled,
      lastUsedTimeStep: account.last_totp_time_step,
    };

    if (!account.totp_secret) {
      return NextResponse.json({ ...diag, error: "No TOTP secret configured. Start setup first." });
    }

    // Try to decrypt the secret
    let decryptedSecret;
    try {
      decryptedSecret = decryptSecret(account.totp_secret);
      diag.decryption = { success: true, secretLength: decryptedSecret.length };
    } catch (e) {
      diag.decryption = { success: false, error: e.message };
      return NextResponse.json({ ...diag, error: "Decryption failed — TOTP_ENCRYPTION_KEY may have changed since setup" }, { status: 500 });
    }

    // Calculate the current TOTP code (the one the server EXPECTS)
    const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
    const currentCode = calculateTOTP(decryptedSecret, currentTimeStep);
    const prevCode = calculateTOTP(decryptedSecret, currentTimeStep - 1);
    const nextCode = calculateTOTP(decryptedSecret, currentTimeStep + 1);

    diag.serverTime = {
      iso: new Date().toISOString(),
      unixSeconds: Math.floor(Date.now() / 1000),
      currentTimestep: currentTimeStep,
      secondsIntoWindow: Math.floor(Date.now() / 1000) % 30,
      secondsUntilNextCode: 30 - (Math.floor(Date.now() / 1000) % 30),
    };

    diag.expectedCodes = {
      // These are the codes the server would ACCEPT right now (±2 window)
      // We show them so the user can compare with their authenticator app
      // DO NOT show these in production logs — they're valid TOTP codes
      current: currentCode,
      previous: prevCode,
      next: nextCode,
      note: "Compare these with what your authenticator app shows. If they match, your clock is fine. If they don't match, your authenticator app has a different secret or clock.",
    };

    diag.replayProtection = {
      lastUsedTimeStep: account.last_totp_time_step,
      wouldRejectCurrent: account.last_totp_time_step === currentTimeStep,
      wouldRejectPrevious: account.last_totp_time_step === currentTimeStep - 1,
      recommendation: account.last_totp_time_step === currentTimeStep
        ? "You just verified successfully. Wait 30 seconds for the next code before trying again."
        : "Replay protection is not blocking you.",
    };

    diag.troubleshooting = {
      decryptionOk: diag.decryption.success,
      secretLooksValid: decryptedSecret.length >= 16,
      clockSkew: Math.abs(diag.serverTime.unixSeconds - Math.floor(Date.now() / 1000)) < 5 ? "OK" : "SKEW DETECTED",
      recommendations: [
        "1. Compare the 'current' code above with your authenticator app",
        "2. If they DON'T match: your authenticator has a different secret. Re-scan the QR code.",
        "3. If they DO match but verify still fails: wait 30 seconds for a fresh code",
        "4. Make sure your device clock is set to automatic/network time",
        "5. Try entering the code on the verify-2fa page right after generating it",
      ],
    };

    return NextResponse.json(diag);
  } catch (err) {
    diag.error = err.message;
    return NextResponse.json(diag, { status: 500 });
  }
}
