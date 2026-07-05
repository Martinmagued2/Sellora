import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage, sendProductCard } from "@/lib/channels/meta";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";
import { canAccessAccount } from "@/lib/team-auth";

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
 * Sends a message from Sellora to the customer's inbox.
 * Supports Instagram, Facebook, and WhatsApp channels.
 *
 * Body: { conversationId, content, type?, product?, channel? }
 *   - type: "text" (default) | "product_card"
 *   - product: { name, price, currency?, description?, image_urls?, id? } (required if type="product_card")
 *   - channel: override channel detection (optional)
 */
export async function POST(request) {
  try {
    const { conversationId, content, type = "text", product = null, channel: channelOverride, accountId: bodyAccountId } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: "Missing conversationId or content" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Get the conversation with customer and account info
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, channel, account_id, customer:customers(id, platform_id, phone)")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // SECURITY: Verify the requester owns this conversation's account
    // Primary auth: Supabase session (JWT). Fallback: admin key for server-to-server.
    let authenticatedUserId = null;
    let isAdminCall = false;

    // Check admin key first (server-to-server fallback)
    const adminKey = request.headers.get("x-admin-key");
    if (adminKey && process.env.ADMIN_SECRET_KEY) {
      const bufA = Buffer.from(adminKey, "utf8");
      const bufB = Buffer.from(process.env.ADMIN_SECRET_KEY, "utf8");
      if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
        isAdminCall = true;
      }
    }

    // If not an admin call, verify Supabase session
    if (!isAdminCall) {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
          },
        }
      );

      const { data: { user }, error: sessionError } = await supabaseAuth.auth.getUser();
      if (sessionError || !user) {
        console.error("[MSG-SEND] Auth failed:", sessionError?.message || "No user in session");
        return NextResponse.json({ error: "Authentication required. Log in to send messages." }, { status: 401 });
      }
      authenticatedUserId = user.id;

      // Verify the authenticated user owns this conversation OR is a team member
      // of the owner's account.
      const hasAccess = await canAccessAccount(user, conversation.account_id);
      if (!hasAccess) {
        return NextResponse.json({ error: "You do not have access to this conversation" }, { status: 403 });
      }
    }

    // Secondary consistency check: if x-account-id is provided, the user must
    // have access to that account (owner OR team member). This replaces the old
    // strict-equality check that broke team members (whose auth.uid != owner's
    // account_id but who SHOULD be allowed to send on the owner's behalf).
    const headerAccountId = request.headers.get("x-account-id") || bodyAccountId;
    if (headerAccountId && headerAccountId !== conversation.account_id) {
      // The provided account id doesn't match the conversation's owner — but
      // maybe the user is the owner of the provided account OR a team member of
      // the conversation's account. Either way, canAccessAccount already
      // verified access above, so we just need to make sure the header account
      // is one the user can access.
      if (authenticatedUserId && headerAccountId !== authenticatedUserId) {
        const canAccessHeader = await canAccessAccount({ id: authenticatedUserId }, headerAccountId);
        if (!canAccessHeader) {
          return NextResponse.json({ error: "You do not have access to this conversation" }, { status: 403 });
        }
      }
    }

    const effectiveChannel = channelOverride || conversation.channel;
    const { account_id, customer } = conversation;
    const recipientId = customer?.platform_id;

    // ─── WhatsApp Channel ───
    if (effectiveChannel === "whatsapp") {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("whatsapp_access_token, whatsapp_phone_number_id, whatsapp_connected")
        .eq("id", account_id)
        .single();

      if (accountError || !account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      if (!account.whatsapp_connected || !account.whatsapp_access_token) {
        return NextResponse.json({ error: "WhatsApp not connected" }, { status: 400 });
      }

      // For WhatsApp, prefer platform_id (it's the canonical phone number from the
      // webhook, always digits-only). Fall back to customer.phone if platform_id
      // is missing — but normalize it by stripping all non-digit characters
      // (WhatsApp rejects "+20 123 456" → must be "20123456").
      let phoneNumber = customer?.platform_id || customer?.phone;
      if (!phoneNumber) {
        return NextResponse.json({ error: "Customer has no phone number for WhatsApp" }, { status: 400 });
      }
      // Normalize: strip everything except digits
      phoneNumber = String(phoneNumber).replace(/[^\d]/g, "");
      if (phoneNumber.length < 7) {
        return NextResponse.json({ error: `Customer phone number is too short after normalization: "${phoneNumber}"` }, { status: 400 });
      }

      console.log(`[MSG-SEND] WhatsApp send to: ${phoneNumber} (from platform_id=${customer?.platform_id}, phone=${customer?.phone})`);

      // Send via WhatsApp Cloud API
      let sendResult;
      try {
        sendResult = await sendWhatsAppMessage({
          to: phoneNumber,
          message: content,
          phoneNumberId: account.whatsapp_phone_number_id,
          accessToken: account.whatsapp_access_token,
        });
      } catch (waErr) {
        console.error("[MSG-SEND] WhatsApp API error:", waErr.message);
        return NextResponse.json({
          error: `WhatsApp API error: ${waErr.message}`,
          details: { phoneNumber, phoneNumberId: account.whatsapp_phone_number_id }
        }, { status: 500 });
      }

      // Save the outgoing message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        account_id,
        direction: "outgoing",
        content,
        type,
        is_ai: false,
        platform_message_id: sendResult?.messages?.[0]?.id || null,
      });

      if (insertError) {
        console.error("[MSG-SEND] Failed to save WhatsApp message:", insertError);
      }

      // Update conversation
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          status: "waiting_customer",
        })
        .eq("id", conversationId);

      return NextResponse.json({
        success: true,
        messageId: sendResult?.messages?.[0]?.id,
      });
    }

    // ─── Telegram Channel ───
    if (effectiveChannel === "telegram") {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("telegram_bot_token, telegram_connected")
        .eq("id", account_id)
        .single();

      if (accountError || !account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      if (!account.telegram_connected || !account.telegram_bot_token) {
        return NextResponse.json({ error: "Telegram not connected" }, { status: 400 });
      }

      // For Telegram, platform_id is the chat_id (a number).
      // Telegram chat_ids are integers — normalize by stripping non-digits.
      let chatId = customer?.platform_id;
      if (!chatId) {
        return NextResponse.json({ error: "Customer has no Telegram chat ID" }, { status: 400 });
      }
      chatId = String(chatId).replace(/[^\d-]/g, ""); // keep digits + minus sign (negative for groups)

      const { sendTelegramMessage } = await import("@/lib/telegram");

      let sendResult;
      try {
        console.log(`[MSG-SEND] Telegram send to chatId: ${chatId}`);
        sendResult = await sendTelegramMessage({
          botToken: account.telegram_bot_token,
          chatId,
          text: content,
        });
      } catch (tgErr) {
        console.error("[MSG-SEND] Telegram API error:", tgErr.message);
        return NextResponse.json({
          error: `Telegram API error: ${tgErr.message}`,
          details: { chatId, channel: "telegram" }
        }, { status: 500 });
      }

      // Save the outgoing message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        account_id,
        direction: "outgoing",
        content,
        type,
        is_ai: false,
        platform_message_id: sendResult?.result?.message_id?.toString() || null,
      });

      if (insertError) {
        console.error("[MSG-SEND] Failed to save Telegram message:", insertError);
      }

      // Update conversation
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          status: "waiting_customer",
        })
        .eq("id", conversationId);

      return NextResponse.json({
        success: true,
        messageId: sendResult?.result?.message_id?.toString(),
      });
    }

    // ─── Email Channel ───
    if (effectiveChannel === "email") {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("email_inbound_address")
        .eq("id", account_id)
        .single();

      if (accountError || !account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      // For Email, platform_id stores the customer's email address
      const customerEmail = customer?.platform_id || customer?.email;
      if (!customerEmail || !customerEmail.includes("@")) {
        return NextResponse.json({ error: "Customer has no valid email address" }, { status: 400 });
      }

      const { sendCustomEmail, isEmailConfigured } = await import("@/lib/email");
      if (!isEmailConfigured()) {
        return NextResponse.json({ error: "Email not configured (RESEND_API_KEY missing)" }, { status: 400 });
      }

      let sendResult;
      try {
        console.log(`[MSG-SEND] Email send to: ${customerEmail}`);
        sendResult = await sendCustomEmail({
          to: customerEmail,
          subject: "Re: Your message",
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <p style="font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap;">${content}</p>
          </div>`,
          replyTo: account.email_inbound_address,
          templateName: "manual_email_reply",
          accountId: account_id,
        });
      } catch (emailErr) {
        console.error("[MSG-SEND] Email API error:", emailErr.message);
        return NextResponse.json({
          error: `Email API error: ${emailErr.message}`,
          details: { to: customerEmail, channel: "email" }
        }, { status: 500 });
      }

      // Save the outgoing message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        account_id,
        direction: "outgoing",
        content,
        type,
        is_ai: false,
        platform_message_id: sendResult?.messageId || null,
      });

      if (insertError) {
        console.error("[MSG-SEND] Failed to save email message:", insertError);
      }

      // Update conversation
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          status: "waiting_customer",
        })
        .eq("id", conversationId);

      return NextResponse.json({
        success: true,
        messageId: sendResult?.messageId,
      });
    }

    // ─── Instagram / Facebook Channel ───
    if (!recipientId) {
      console.error("[MSG-SEND] No platform_id for customer in conversation", conversationId);
      return NextResponse.json({ error: "Customer has no platform ID" }, { status: 400 });
    }

    // Get the account's access token for this channel
    const tokenColumn = effectiveChannel === "instagram" ? "instagram_access_token" : "facebook_access_token";
    const pageIdColumn = effectiveChannel === "instagram" ? "instagram_page_id" : "facebook_page_id";

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
      console.warn(`[MSG-SEND] No ${effectiveChannel} token/page configured for account ${account_id}`);
      return NextResponse.json({ error: `${effectiveChannel} not connected` }, { status: 400 });
    }

    // Send the message to Meta
    let sendResult;

    try {
      if (type === "product_card" && product) {
        console.log(`[MSG-SEND] Sending product card to ${effectiveChannel} recipient ${recipientId} via page ${pageId}`);
        sendResult = await sendProductCard({
          recipientId,
          product,
          pageId,
          accessToken,
        });
      } else {
        console.log(`[MSG-SEND] Sending text to ${effectiveChannel} recipient ${recipientId} via page ${pageId}`);
        sendResult = await sendMessage({
          recipientId,
          message: content,
          pageId,
          accessToken,
        });
      }
    } catch (metaErr) {
      console.error(`[MSG-SEND] ${effectiveChannel} API error:`, metaErr.message);
      return NextResponse.json({
        error: `${effectiveChannel} API error: ${metaErr.message}`,
        details: { recipientId, pageId, channel: effectiveChannel }
      }, { status: 500 });
    }

    console.log(`[MSG-SEND] Meta API response:`, JSON.stringify(sendResult));

    // Save the outgoing message to the database
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      account_id,
      direction: "outgoing",
      content,
      type,
      is_ai: false,
      platform_message_id: sendResult?.message_id || null,
    });

    if (insertError) {
      console.error("[MSG-SEND] Failed to save message:", insertError);
    }

    // Update conversation
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
