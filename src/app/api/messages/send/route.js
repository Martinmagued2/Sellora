import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/channels/meta";

const META_API_URL = "https://graph.facebook.com/v21.0";

// Server-side admin client (bypasses RLS)
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
 * POST /api/messages/send
 *
 * Sends a message from Sellora to the customer's Facebook/Instagram inbox.
 * Called when an agent types a reply in the Conversations page.
 *
 * Body: { conversationId, content }
 */
export async function POST(request) {
  try {
    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: "Missing conversationId or content" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Get the conversation with customer and account info
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, channel, account_id, customer:customers(id, platform_id)")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { channel, account_id, customer } = conversation;
    const recipientId = customer?.platform_id;

    if (!recipientId) {
      console.error("[MSG-SEND] No platform_id for customer in conversation", conversationId);
      return NextResponse.json({ error: "Customer has no platform ID" }, { status: 400 });
    }

    // 2. Get the account's access token for this channel
    const tokenColumn = channel === "instagram" ? "instagram_access_token" : "facebook_access_token";
    const pageIdColumn = channel === "instagram" ? "instagram_page_id" : "facebook_page_id";

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select(`${tokenColumn}, ${pageIdColumn}`)
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const accessToken = account[tokenColumn];
    const pageId = account[pageIdColumn];

    if (!accessToken || !pageId) {
      console.warn(`[MSG-SEND] No ${channel} token/page configured for account ${account_id}`);
      return NextResponse.json({ error: `${channel} not connected` }, { status: 400 });
    }

    // 3. Send the message to Meta
    console.log(`[MSG-SEND] Sending to ${channel} recipient ${recipientId} via page ${pageId}`);

    const sendResult = await sendMessage({
      recipientId,
      message: content,
      pageId,
      accessToken,
    });

    console.log(`[MSG-SEND] Meta API response:`, JSON.stringify(sendResult));

    // 4. Save the outgoing message to the database
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "outgoing",
      content,
      type: "text",
      is_ai: false,
      platform_message_id: sendResult?.message_id || null,
    });

    if (insertError) {
      console.error("[MSG-SEND] Failed to save message:", insertError);
      // Message was sent to Meta but not saved — still return success
    }

    // 5. Update conversation
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "waiting_customer",
      })
      .eq("id", conversationId);

    return NextResponse.json({
      success: true,
      messageId: sendResult?.message_id,
    });

  } catch (err) {
    console.error("[MSG-SEND] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
