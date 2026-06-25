import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { parseWebhookMessage, markMessageAsRead } from "@/lib/whatsapp";
import { processIncomingMessage } from "@/lib/channels/processor";
import { verifyMetaSignature } from "@/lib/channels/verify";
import { logSecurityEvent } from "@/lib/security-logger";
import { notify } from "@/lib/notifications";
import crypto from 'crypto';

// Service role client for webhook processing (lazy-initialized)
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
 * GET — WhatsApp webhook verification
 * Meta sends a GET request to verify the webhook URL
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // 🔒 SECURITY: Timing-safe comparison to prevent timing attacks
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expectedToken) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
        console.log("[WA-WEBHOOK] Verification successful");
        return new Response(challenge, { status: 200 });
      }
    } catch (e) {
      // Length mismatch — fall through to failure
    }
  }

  console.warn("[WA-WEBHOOK] Verification failed");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — Handle incoming WhatsApp messages
 *
 * Uses the shared processor for the complete pipeline:
 *   Customer upsert → Conversation upsert → Intent/Sentiment → Message storage →
 *   Webhook dispatch → Auto-tagging → Auto-greeting → FAQ auto-reply →
 *   Keyword auto-reply → AI auto-reply
 */
export async function POST(request) {
  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Verify the webhook signature securely — REQUIRE app secret in production
  if (!process.env.WHATSAPP_APP_SECRET) {
    console.error("[WA-WEBHOOK] CRITICAL: WHATSAPP_APP_SECRET not configured. Rejecting request for security.");
    return NextResponse.json({ error: "Webhook not properly configured" }, { status: 500 });
  }
  if (!verifyMetaSignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET)) {
    console.error("[WA-WEBHOOK] Invalid WhatsApp webhook signature");
    await logSecurityEvent({
      eventType: "invalid_hmac",
      ipAddress: ip,
      route: "/api/webhooks/whatsapp",
      details: { channel: "whatsapp" },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error("[WA-WEBHOOK] Failed to parse JSON:", e.message);
    return NextResponse.json({ status: "ok" });
  }

  // Check for status updates first (delivered, read receipts)
  const statusUpdate = parseStatusUpdate(body);
  if (statusUpdate) {
    await handleStatusUpdate(statusUpdate);
    return NextResponse.json({ status: "ok" });
  }

  // Parse the incoming message
  const message = parseWebhookMessage(body);

  if (!message) {
    // Not a message event — acknowledge it
    return NextResponse.json({ status: "ok" });
  }

  console.log(`[WA-WEBHOOK] Message from ${message.from}: "${message.text?.substring(0, 50)}..."`);

  try {
    // Mark message as read immediately (best-effort)
    if (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_PHONE_NUMBER_ID) {
      await markMessageAsRead({ messageId: message.messageId }).catch(() => {});
    }

    // Look up the account that owns this WhatsApp phone number
    // This is critical so the processor doesn't fail to find the account
    let accountId = null;
    let waAccessToken = null;
    try {
      const { data: waAccount } = await getSupabase()
        .from("accounts")
        .select("id, whatsapp_access_token")
        .eq("whatsapp_phone_number_id", message.phoneNumberId)
        .limit(1)
        .single();
      if (waAccount) {
        accountId = waAccount.id;
        waAccessToken = waAccount.whatsapp_access_token;
      } else {
        console.warn(`[WA-WEBHOOK] No account found for whatsapp_phone_number_id: ${message.phoneNumberId}`);
      }
    } catch (acctErr) {
      console.warn(`[WA-WEBHOOK] Account lookup failed:`, acctErr.message);
    }

    // Process through the shared pipeline — handles EVERYTHING:
    // account lookup, customer upsert, conversation, message storage,
    // auto-greeting, FAQ, keyword auto-reply, and AI auto-reply
    //
    // 🔧 FIX: If the message has media (image/audio/video), download it
    // from WhatsApp and upload to Supabase Storage so it's accessible.
    let mediaUrls = [];
    let mediaType = null;
    if (message.mediaId && waAccessToken) {
      try {
        const { downloadWhatsAppMedia } = await import("@/lib/whatsapp");
        const { buffer, mimeType } = await downloadWhatsAppMedia({
          mediaId: message.mediaId,
          accessToken: waAccessToken,
        });

        // Upload to Supabase Storage
        const ext = mimeType.split("/")[1] || "bin";
        const fileName = `inbound/${accountId}/${Date.now()}-${message.messageId}.${ext}`;
        const { data: uploadData, error: uploadError } = await getSupabase()
          .storage.from("message-media")
          .upload(fileName, buffer, { contentType: mimeType, upsert: false });

        if (!uploadError) {
          const { data: urlData } = getSupabase().storage.from("message-media").getPublicUrl(fileName);
          mediaUrls = [urlData.publicUrl];
          mediaType = message.mediaType;
        }
      } catch (mediaErr) {
        console.warn("[WA-WEBHOOK] Media download failed:", mediaErr.message);
      }
    }

    // 🔧 FIX: Set customer typing indicator BEFORE storing the message.
    // This makes the typing bubble appear briefly, then transitions to the
    // actual message when it's stored (real-time INSERT on messages table).
    // Meta doesn't send typing webhooks, so we simulate it:
    // set typing=true 1.5s before the message appears.
    if (accountId) {
      try {
        // Find the conversation for this customer
        const { data: customer } = await getSupabase().from("customers")
          .select("id").eq("phone", message.from).eq("account_id", accountId).maybeSingle();

        if (customer) {
          const { data: conv } = await getSupabase().from("conversations")
            .select("id").eq("customer_id", customer.id).eq("account_id", accountId)
            .order("last_message_at", { ascending: false }).limit(1).maybeSingle();

          if (conv) {
            // Set typing indicator
            await getSupabase().from("typing_indicators").upsert({
              account_id: accountId,
              conversation_id: conv.id,
              is_customer: true,
              is_team_member: false,
              created_at: new Date().toISOString(),
            }, { onConflict: 'conversation_id,is_customer' });
          }
        }
      } catch (e) {}
    }

    // Small delay so the typing bubble is visible before the message appears
    await new Promise(resolve => setTimeout(resolve, 800));

    await processIncomingMessage({
      senderId: message.from,
      senderName: message.contactName || null,
      senderProfilePic: null,
      text: message.text,
      mediaUrls,
      mediaType,
      channel: "whatsapp",
      pageId: message.phoneNumberId,
      platformMessageId: message.messageId,
      accessToken: waAccessToken,
      accountId: accountId,
    });

    console.log(`[WA-WEBHOOK] Successfully processed message from ${message.from}`);

    // 🔧 FIX: Clear customer typing indicator (message has arrived)
    if (accountId) {
      try {
        await getSupabase().from("typing_indicators")
          .delete()
          .eq("account_id", accountId)
          .eq("is_customer", true);
      } catch (e) {}
    }

    // 🔔 Fire notification (best-effort, non-blocking) — only if we found an account
    if (accountId) {
      const customerName = message.contactName || message.from || "Unknown";
      const messagePreview = (message.text || "").slice(0, 100);
      notify(accountId, {
        category: "messages",
        type: "new_message",
        title: `New WhatsApp message from ${customerName}`,
        message: messagePreview,
        priority: "normal",
        actionUrl: "/dashboard/conversations",
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[WA-WEBHOOK] Error processing WhatsApp message:", err.message);
    console.error("[WA-WEBHOOK] Stack:", err.stack);
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: "ok" });
}

/**
 * Parse WhatsApp message status updates (delivered, read, etc.)
 */
function parseStatusUpdate(body) {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.statuses?.[0]) return null;

  const status = value.statuses[0];
  return {
    messageId: status.id,
    status: status.status, // 'sent', 'delivered', 'read'
    timestamp: status.timestamp,
    phoneNumberId: value.metadata?.phone_number_id,
  };
}

/**
 * Handle message status updates for campaign tracking
 */
async function handleStatusUpdate(statusUpdate) {
  try {
    if (!statusUpdate.messageId) return;

    const supabase = getSupabase();

    // Update the message delivery status
    if (statusUpdate.status === "delivered" || statusUpdate.status === "read") {
      const updates = {};
      if (statusUpdate.status === "delivered") {
        updates.delivery_status = "delivered";
        updates.delivered_at = new Date().toISOString();
      } else if (statusUpdate.status === "read") {
        updates.delivery_status = "read";
        updates.read_at = new Date().toISOString();
      }

      // Try to update by platform_message_id
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("messages")
          .update(updates)
          .eq("platform_message_id", statusUpdate.messageId);
      }

      console.log(`[WA-WEBHOOK] Message ${statusUpdate.messageId} status: ${statusUpdate.status}`);
    }
  } catch (err) {
    console.error("[WA-WEBHOOK] Error handling status update:", err.message);
  }
}
