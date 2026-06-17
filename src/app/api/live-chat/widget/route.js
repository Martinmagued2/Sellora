/** GET /api/live-chat/widget — public endpoint that returns widget config for embedding */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");
    if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

    const admin = getAdminClient();
    const { data: account } = await admin.from("accounts")
      .select("id, business_name, logo_url, ai_personality").eq("id", accountId).single();
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    return NextResponse.json({
      businessName: account.business_name,
      logoUrl: account.logo_url,
      welcomeMessage: "Hi! How can we help you today?",
      personality: account.ai_personality,
    });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

/** POST /api/live-chat/widget — receive a message from the embedded widget (public) */
export async function POST(req) {
  try {
    const { account_id, visitor_id, message, customer_name, customer_email } = await req.json();
    if (!account_id || !message) return NextResponse.json({ error: "account_id and message required" }, { status: 400 });

    const admin = getAdminClient();

    // Find or create a live chat session
    let session;
    if (visitor_id) {
      const { data: existing } = await admin.from("live_chat_sessions")
        .select("*").eq("account_id", account_id).eq("visitor_id", visitor_id).eq("status", "open").maybeSingle();
      session = existing;
    }

    if (!session) {
      // Create new session + customer
      const { data: customer } = await admin.from("customers").insert({
        account_id, name: customer_name || "Website Visitor", email: customer_email, channel: "manual",
      }).select("*").single();

      const { data: conv } = await admin.from("conversations").insert({
        account_id: account_id, customer_id: customer.id, channel: "manual", status: "new",
      }).select("*").single();

      const { data: newSession } = await admin.from("live_chat_sessions").insert({
        account_id, customer_id: customer.id, customer_name, customer_email, visitor_id: visitor_id || crypto.randomUUID(),
        status: "open", last_message_at: new Date().toISOString(),
      }).select("*").single();
      session = { ...newSession, conversation_id: conv.id, customer_id: customer.id };
    } else {
      await admin.from("live_chat_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", session.id);
    }

    // Store the message
    await admin.from("messages").insert({
      conversation_id: session.conversation_id || session.id,
      account_id, direction: "incoming", content: message, type: "text", is_ai: false,
    });

    return NextResponse.json({ success: true, sessionId: session.id, visitorId: session.visitor_id });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
