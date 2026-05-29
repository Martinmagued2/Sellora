import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { parseWebhookMessage, markMessageAsRead } from "@/lib/whatsapp";
import { processIncomingMessage } from "@/lib/channels/processor";
import { verifyMetaSignature } from "@/lib/channels/verify";
import { logSecurityEvent } from "@/lib/security-logger";

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

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    // Webhook verified successfully
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — Handle incoming WhatsApp messages
 * Delegates to the shared channel processor for consistent behavior
 */
export async function POST(request) {
  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Verify the webhook signature securely (only if app secret is configured)
  if (process.env.WHATSAPP_APP_SECRET) {
    if (!verifyMetaSignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET)) {
      console.error("Invalid WhatsApp webhook signature");
      await logSecurityEvent({
        eventType: "invalid_hmac",
        ipAddress: ip,
        route: "/api/webhooks/whatsapp",
        details: { channel: "whatsapp" }
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = JSON.parse(rawBody);

  // Parse the incoming message
  const message = parseWebhookMessage(body);

  if (!message) {
    // Not a message event (could be status update, etc.)
    const statusUpdate = parseStatusUpdate(body);
    if (statusUpdate) {
      await handleStatusUpdate(statusUpdate);
    }
    return NextResponse.json({ status: "ok" });
  }

  try {
    // Mark message as read immediately
    if (process.env.WHATSAPP_ACCESS_TOKEN) {
      await markMessageAsRead({ messageId: message.messageId }).catch(() => {});
    }

    // Find the account that owns this WhatsApp phone number
    let { data: account } = await getSupabase()
      .from("accounts")
      .select("id, whatsapp_phone_number_id, whatsapp_access_token")
      .eq("whatsapp_phone_number_id", message.phoneNumberId)
      .single();

    if (!account) {
      // Fallback: try to find account with whatsapp_connected = true
      const { data: accounts } = await getSupabase()
        .from("accounts")
        .select("id, whatsapp_phone_number_id, whatsapp_access_token")
        .eq("whatsapp_connected", true)
        .limit(1);

      if (accounts && accounts.length > 0) {
        account = accounts[0];
      }
    }

    if (!account) {
      console.error("No account found for WhatsApp phone number ID:", message.phoneNumberId);
      return NextResponse.json({ status: "ok" });
    }

    // Use shared processor for the full pipeline:
    // Customer upsert → Conversation upsert → Intent/Sentiment → Message storage →
    // Webhook dispatch → Auto-tagging → Auto-greeting → FAQ auto-reply →
    // Keyword auto-reply → AI auto-reply
    await processIncomingMessage({
      senderId: message.from,
      senderName: message.contactName || null,
      senderProfilePic: null,
      text: message.text,
      mediaUrls: [],
      channel: "whatsapp",
      pageId: message.phoneNumberId,
      platformMessageId: message.messageId,
      accessToken: account.whatsapp_access_token,
    });
  } catch (err) {
    console.error("Error processing WhatsApp message:", err);
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

    // For campaign tracking, we could update campaign stats here
    // For now, just log it
    if (statusUpdate.status === "delivered" || statusUpdate.status === "read") {
      console.log(`[WHATSAPP] Message ${statusUpdate.messageId} status: ${statusUpdate.status}`);
    }
  } catch (err) {
    console.error("Error handling WhatsApp status update:", err);
  }
}
