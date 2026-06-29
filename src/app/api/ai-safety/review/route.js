/**
 * AI Safety — Pending AI Reply Review API
 *
 * GET  /api/ai-safety/review                    — list pending AI replies
 * GET  /api/ai-safety/review?conversation_id=X  — list pending replies for a conversation
 * POST /api/ai-safety/review                     — approve or reject a pending AI reply
 *
 * When the account has ai_preview_mode ON (or a reply was held due to low
 * confidence), the AI reply is stored in the messages table with
 * approval_status='pending' instead of being sent to the customer.
 *
 * This endpoint lets the owner review, approve (delivers the message via the
 * configured channel), or reject (discards) those pending replies.
 *
 * POST body:
 *   { messageId, action: "approve" | "reject", editedContent? }
 *     - action="approve": sends the message via WhatsApp/Meta/Telegram,
 *       marks approval_status='approved', delivery_status='sent'/'delivered'.
 *       If editedContent is provided, the stored message content is updated
 *       before sending (lets the owner tweak the AI's wording).
 *     - action="reject": marks approval_status='rejected', delivery_status='failed'.
 *       The message row is kept (for audit) but never sent.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { sendMessage } from "@/lib/channels/meta";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendTelegramMessage } from "@/lib/telegram";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

/**
 * Send the (possibly edited) AI reply via the configured channel.
 * Returns { success: boolean, messageId?: string, error?: string }.
 */
async function deliverReply({ channel, account, customer, content, conversationId }) {
  try {
    if (channel === "whatsapp") {
      const to = customer?.phone || customer?.platform_id;
      if (!to) return { success: false, error: "Customer has no phone number" };
      if (!account.whatsapp_access_token) return { success: false, error: "WhatsApp not connected" };
      const result = await sendWhatsAppMessage({
        to,
        message: content,
        phoneNumberId: account.whatsapp_phone_number_id,
        accessToken: account.whatsapp_access_token,
      });
      return { success: true, messageId: result?.messages?.[0]?.id };
    }

    if (channel === "telegram") {
      const chatId = customer?.platform_id;
      if (!chatId) return { success: false, error: "Customer has no Telegram chat ID" };
      if (!account.telegram_bot_token) return { success: false, error: "Telegram not connected" };
      const result = await sendTelegramMessage({
        botToken: account.telegram_bot_token,
        chatId,
        text: content,
      });
      return { success: true, messageId: result?.result?.message_id?.toString() };
    }

    // instagram, facebook, (email handled separately below)
    if (channel === "email") {
      const { sendCustomEmail, isEmailConfigured } = await import("@/lib/email");
      if (!isEmailConfigured()) return { success: false, error: "Email not configured" };
      const to = customer?.platform_id;
      if (!to || !to.includes("@")) return { success: false, error: "Customer has no email" };
      await sendCustomEmail({
        to,
        subject: "Re: Your message",
        text: content,
        replyTo: account.email_inbound_address,
      });
      return { success: true };
    }

    // Meta (instagram / facebook)
    const recipientId = customer?.platform_id;
    if (!recipientId) return { success: false, error: "Customer has no platform ID" };
    if (!account.facebook_access_token && !account.instagram_access_token) {
      return { success: false, error: `${channel} not connected` };
    }
    const pageId = channel === "instagram" ? account.instagram_page_id : account.facebook_page_id;
    const accessToken = channel === "instagram" ? account.instagram_access_token : account.facebook_access_token;
    await sendMessage({ recipientId, message: content, pageId, accessToken });
    return { success: true };
  } catch (err) {
    console.error("[AI-SAFETY-REVIEW] delivery error:", err);
    return { success: false, error: err.message };
  }
}

// GET — list pending AI replies for the authenticated account
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversation_id");
    const admin = getAdminClient();

    let query = admin
      .from("messages")
      .select(`
        id,
        conversation_id,
        account_id,
        content,
        created_at,
        sentiment,
        tool_calls,
        conversation:conversations (
          id,
          channel,
          priority,
          sla_deadline,
          status,
          customer:customers ( id, name, phone, platform_id, channel )
        )
      `)
      .eq("account_id", user.id)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pendingReplies: data || [] });
  } catch (err) {
    console.error("[AI-SAFETY-REVIEW] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — approve or reject a pending AI reply
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { messageId, action, editedContent } = await req.json();
    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const admin = getAdminClient();

    // 1. Fetch the pending message + conversation + customer + account
    const { data: message, error: msgErr } = await admin
      .from("messages")
      .select(`
        id,
        conversation_id,
        account_id,
        content,
        approval_status,
        delivery_status,
        conversation:conversations (
          id,
          channel,
          account_id,
          customer:customers ( id, name, phone, platform_id, channel )
        )
      `)
      .eq("id", messageId)
      .eq("account_id", user.id)
      .maybeSingle();

    if (msgErr || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (message.approval_status !== "pending") {
      return NextResponse.json(
        { error: `Message is already ${message.approval_status}` },
        { status: 400 }
      );
    }

    // ─── REJECT ───
    // Mark the message as rejected. We keep the row (for audit) but the
    // customer never sees it. delivery_status stays 'pending'/'failed' since
    // it was never sent.
    if (action === "reject") {
      const { error: rejectErr } = await admin
        .from("messages")
        .update({
          approval_status: "rejected",
          delivery_status: "failed",
        })
        .eq("id", messageId);

      if (rejectErr) {
        return NextResponse.json({ error: rejectErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "rejected",
        messageId,
      });
    }

    // ─── APPROVE ───
    // Optionally apply the owner's edits, then deliver the message via the
    // configured channel, then mark the message as approved + delivered.
    const finalContent = (editedContent && editedContent.trim())
      ? editedContent.trim()
      : message.content;

    // Fetch account credentials for delivery
    const { data: account, error: acctErr } = await admin
      .from("accounts")
      .select(`
        id,
        whatsapp_access_token,
        whatsapp_phone_number_id,
        whatsapp_connected,
        instagram_access_token,
        instagram_page_id,
        facebook_access_token,
        facebook_page_id,
        telegram_bot_token,
        telegram_connected,
        email_channel_enabled,
        email_inbound_address
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (acctErr || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Normalize the joined data (supabase returns arrays for has-one joins
    // when using the parenthesized select syntax in some versions)
    const conversation = Array.isArray(message.conversation)
      ? message.conversation[0]
      : message.conversation;
    const customer = Array.isArray(conversation?.customer)
      ? conversation.customer[0]
      : conversation?.customer;
    const channel = conversation?.channel;

    const delivery = await deliverReply({
      channel,
      account,
      customer,
      content: finalContent,
      conversationId: message.conversation_id,
    });

    // Update the message row regardless of delivery outcome —
    // if delivery failed, the owner can retry from the conversations page.
    const updatePayload = {
      approval_status: "approved",
      content: finalContent,
      delivery_status: delivery.success ? "delivered" : "failed",
    };

    const { error: updateErr } = await admin
      .from("messages")
      .update(updatePayload)
      .eq("id", messageId);

    if (updateErr) {
      console.error("[AI-SAFETY-REVIEW] approve update error:", updateErr);
    }

    // Bump conversation last_message_at + status
    if (delivery.success) {
      try {
        await admin
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            status: "waiting_customer",
          })
          .eq("id", message.conversation_id);
      } catch (e) { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      action: "approved",
      messageId,
      delivered: delivery.success,
      messageId_platform: delivery.messageId || null,
      delivery_error: delivery.success ? null : delivery.error,
    });
  } catch (err) {
    console.error("[AI-SAFETY-REVIEW] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
