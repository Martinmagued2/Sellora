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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify the user token with Supabase
    const supabase = getSupabase();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
    }

    // Check if 2FA is already enabled
    const { data: account } = await supabase
      .from("accounts")
      .select("totp_enabled, email")
      .eq("id", user.id)
      .single();

    if (account?.totp_enabled) {
      return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
    }

    // Generate TOTP secret
    const secret = generateSecret();
    const email = account?.email || user.email || "user";
    const otpauthUrl = buildOtpauthUrl(secret, email);

    // Store the secret ENCRYPTED (not yet enabled)
    // It will be enabled only after successful verification
    const encryptedSecret = encryptSecret(secret);
    await supabase
      .from("accounts")
      .update({ totp_secret: encryptedSecret })
      .eq("id", user.id);

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
