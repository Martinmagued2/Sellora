/** POST /api/csat — send a CSAT survey after conversation close */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { sendInteractiveButtons } from "@/lib/whatsapp";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { conversationId } = await req.json();
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

    const admin = getAdminClient();
    const { data: conv } = await admin.from("conversations")
      .select("id, customer_id, channel, customers(name, phone), accounts(whatsapp_access_token, whatsapp_phone_number_id, business_name)")
      .eq("id", conversationId).eq("account_id", user.id).single();
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    // Insert survey record
    const { data: survey } = await admin.from("csat_surveys").insert({
      account_id: user.id, conversation_id: conversationId, customer_id: conv.customer_id,
    }).select("*").single();

    // Send CSAT via WhatsApp interactive buttons
    if (conv.channel === "whatsapp" && conv.customers?.phone && conv.accounts?.whatsapp_access_token) {
      try {
        await sendInteractiveButtons({
          to: conv.customers.phone,
          body: `How was your experience with ${conv.accounts?.business_name || "us"}?`,
          buttons: [
            { id: `csat_${survey.id}_5`, title: "⭐⭐⭐⭐⭐" },
            { id: `csat_${survey.id}_3`, title: "⭐⭐⭐" },
            { id: `csat_${survey.id}_1`, title: "⭐" },
          ],
          phoneNumberId: conv.accounts.whatsapp_phone_number_id,
          accessToken: conv.accounts.whatsapp_access_token,
          footer: "Tap to rate",
        });
      } catch (e) { console.warn("[CSAT] send failed:", e.message); }
    }
    return NextResponse.json({ success: true, surveyId: survey.id });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
