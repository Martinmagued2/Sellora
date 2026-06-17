/** POST /api/whatsapp/profile — set persistent menu + ice breakers */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { setWhatsAppProfile } from "@/lib/whatsapp";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { commands, businessName, businessDescription } = await req.json();
    const admin = getAdminClient();
    const { data: account } = await admin.from("accounts")
      .select("whatsapp_phone_number_id, whatsapp_access_token, business_name")
      .eq("id", user.id).single();
    if (!account?.whatsapp_connected) return NextResponse.json({ error: "WhatsApp not connected" }, { status: 400 });

    const result = await setWhatsAppProfile({
      phoneNumberId: account.whatsapp_phone_number_id,
      accessToken: account.whatsapp_access_token,
      commands: commands || [
        { title: "Browse Products", description: "See our catalog" },
        { title: "Track My Order", description: "Check order status" },
        { title: "Talk to Human", description: "Reach an agent" },
      ],
      businessName: businessName || account.business_name,
      businessDescription,
    });

    return NextResponse.json({ success: true, result });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
