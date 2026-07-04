/** GET/POST /api/email-channel — scaffold for email channel integration */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = getAdminClient();
    const { data: account } = await admin.from("accounts")
      .select("email_channel_enabled, email_channel_address").eq("id", user.id).single();
    return NextResponse.json({ email: account || {} });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { email_address } = await req.json();

    const admin = getAdminClient();
    await admin.from("accounts").update({
      email_channel_enabled: true,
      email_channel_address: email_address,
    }).eq("id", user.id);

    return NextResponse.json({
      success: true,
      note: "Email channel scaffold. Full implementation requires IMAP polling + SMTP sending. The email_address has been saved.",
      next_steps: [
        "1. Set up email forwarding from your support email to a Sellora inbox",
        "2. Or configure IMAP polling (requires IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD env vars)",
        "3. Outgoing replies use the existing Resend integration (RESEND_API_KEY)",
      ],
    });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
