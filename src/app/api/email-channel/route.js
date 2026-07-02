/**
 * GET/POST /api/email-channel — Email channel settings
 *
 * The email_channel_address column was missing historically; migration 059
 * adds it. We also fall back to email_inbound_address for backward compat.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient)
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _adminClient;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = getAdminClient();
    const { data: account } = await admin
      .from("accounts")
      .select("email_channel_enabled, email_channel_address, email_inbound_address")
      .eq("id", user.id)
      .single();
    // Normalize: prefer email_inbound_address, fall back to email_channel_address
    return NextResponse.json({
      email: {
        ...account,
        email_channel_address: account?.email_inbound_address || account?.email_channel_address || null,
      },
    });
  } catch (e) {
    console.error("[email-channel GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { email_address } = await req.json();

    if (!email_address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_address)) {
      return NextResponse.json({ error: "Valid email_address required" }, { status: 400 });
    }

    const admin = getAdminClient();
    // Write to BOTH columns for backward compat.
    await admin
      .from("accounts")
      .update({
        email_channel_enabled: true,
        email_channel_address: email_address,
        email_inbound_address: email_address,
      })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      note: "Email channel enabled. Inbound emails forwarded to this address will be processed by /api/webhooks/email.",
      email_address,
    });
  } catch (e) {
    console.error("[email-channel POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = getAdminClient();
    await admin
      .from("accounts")
      .update({
        email_channel_enabled: false,
        email_channel_address: null,
        email_inbound_address: null,
      })
      .eq("id", user.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[email-channel DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
