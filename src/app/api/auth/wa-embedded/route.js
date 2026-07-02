/**
 * WhatsApp Embedded Signup — returns the config for the frontend SDK
 * GET /api/auth/wa-embedded
 *
 * Returns the Meta App ID + config needed to launch the
 * WhatsApp Embedded Signup popup from the frontend.
 *
 * The frontend JavaScript (in ChannelsTab) calls:
 *   window.Facebook.login() with the config returned here.
 *
 * After the user completes the popup, Meta sends a response
 * with the WABA ID + Phone Number ID. The frontend then calls
 * POST /api/auth/wa-embedded to save the credentials.
 *
 * PREREQUISITES (one-time setup by Sellora owner):
 * 1. In Meta Developer → your app → WhatsApp → Configuration:
 *    - Enable "Embedded Signup"
 *    - Add your domain to "Allowed Domains"
 * 2. Add the Facebook SDK to the page:
 *    <script src="https://connect.facebook.net/en_US/sdk.js"></script>
 * 3. Set env var: NEXT_PUBLIC_META_APP_ID
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: "META_APP_ID not configured. Set NEXT_PUBLIC_META_APP_ID in Vercel." }, { status: 500 });
    }

    return NextResponse.json({
      appId,
      configId: process.env.META_WA_CONFIG_ID || "", // Optional: WhatsApp Embedded Signup config ID
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "https://sellorachat.com"}/dashboard/settings?tab=channels`,
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/auth/wa-embedded — save WhatsApp credentials from Embedded Signup
 *
 * Body: { wabaId, phoneNumberId, accessToken }
 *
 * After the Embedded Signup popup completes, the frontend sends
 * the received credentials here to save to the user's account.
 */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { wabaId, phoneNumberId, accessToken } = await req.json();

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: "phoneNumberId and accessToken required" }, { status: 400 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await admin.from("accounts").update({
      whatsapp_connected: true,
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_access_token: accessToken,
      whatsapp_business_account_id: wabaId || null,
    }).eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[WA-EMBEDDED] save error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
