import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSecret, buildOtpauthUrl, encryptSecret } from "@/lib/totp";

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
 * POST /api/auth/2fa/setup
 *
 * Generates a TOTP secret and returns otpauth URL for QR code generation.
 * The secret is stored encrypted — it won't be activated until verified.
 * SECURITY: The secret is NOT sent to any external API (no Google Charts).
 *           The client uses qrcode.react to render the QR code locally.
 */
export async function POST(request) {
  try {
    // Get the user from the Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Not authenticated — please log in again" }, { status: 401 });
    }

    // Verify the user token with Supabase
    const supabase = getSupabase();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication — please log in again" }, { status: 401 });
    }

    // Check if 2FA is already enabled
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("totp_enabled, email")
      .eq("id", user.id)
      .single();

    if (accountError) {
      console.error("[2FA Setup] Failed to fetch account:", accountError.message);
      return NextResponse.json({ error: "Failed to fetch account settings. Please try again." }, { status: 500 });
    }

    if (account?.totp_enabled) {
      return NextResponse.json({ error: "2FA is already enabled on your account" }, { status: 400 });
    }

    // Generate TOTP secret
    const secret = generateSecret();
    const email = account?.email || user.email || "user";
    const otpauthUrl = buildOtpauthUrl(secret, email);

    // Store the secret ENCRYPTED (not yet enabled)
    // It will be enabled only after successful verification
    let encryptedSecret;
    try {
      encryptedSecret = encryptSecret(secret);
    } catch (encErr) {
      console.error("[2FA Setup] Encryption failed:", encErr.message);
      return NextResponse.json({
        error: "2FA setup failed — encryption key not configured. Please contact support or set TOTP_ENCRYPTION_KEY.",
      }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ totp_secret: encryptedSecret })
      .eq("id", user.id);

    if (updateError) {
      console.error("[2FA Setup] Failed to store secret:", updateError.message);
      // If the column doesn't exist, give a helpful error
      if (updateError.message.includes("column") || updateError.message.includes("does not exist")) {
        return NextResponse.json({
          error: "2FA is not yet supported for your account. Database migration required.",
        }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to save 2FA secret: " + updateError.message }, { status: 500 });
    }

    // Return the secret and otpauth URL for client-side QR rendering.
    // NOTE: The secret is returned to the authenticated user so they can
    // manually enter it in their authenticator app. It is NOT sent to
    // any external API. The client should use qrcode.react to render the QR.
    return NextResponse.json({
      secret,
      otpauthUrl,
      // No more Google Charts URL — client renders QR locally
    });
  } catch (err) {
    console.error("[2FA Setup] Error:", err);
    return NextResponse.json({ error: "Failed to setup 2FA" }, { status: 500 });
  }
}
