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
      .select("id, ai_enabled, ai_personality, plan, business_name, country, auto_greeting, auto_greeting_message, whatsapp_greeting, whatsapp_phone_number_id, whatsapp_access_token")
      .eq("whatsapp_phone_number_id", message.phoneNumberId)
      .single();

    if (!account) {
      // Fallback: try to find account with whatsapp_connected = true
      const { data: accounts } = await getSupabase()
        .from("accounts")
        .select("id, whatsapp_phone_number_id, whatsapp_access_token")
        .select("id, ai_enabled, ai_personality, plan, business_name, country, auto_greeting, auto_greeting_message, whatsapp_greeting, whatsapp_phone_number_id, whatsapp_access_token")
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
    // Find or create customer
    let { data: customer } = await getSupabase()
      .from("customers")
      .select("*")
      .eq("account_id", account.id)
      .eq("phone", message.from)
      .single();

    const isNewCustomer = !customer;

    if (!customer) {
      const { data: newCustomer } = await getSupabase()
        .from("customers")
        .insert({
          account_id: account.id,
          phone: message.from,
          name: message.contactName || "Unknown",
          channel: "whatsapp",
          platform: "whatsapp",
          platform_id: message.from,
          first_seen_at: new Date().toISOString(),
          is_returning: false,
        })
        .select()
        .single();

      customer = newCustomer;
    } else {
      // Update last active
      await getSupabase()
        .from("customers")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", customer.id);
    }

    // Find or create conversation
    let { data: conversation } = await getSupabase()
      .from("conversations")
      .select("*")
      .eq("account_id", account.id)
      .eq("customer_id", customer.id)
      .eq("channel", "whatsapp")
      .in("status", ["new", "open", "in_progress", "waiting_customer"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      const { data: newConv } = await getSupabase()
        .from("conversations")
        .insert({
          account_id: account.id,
          customer_id: customer.id,
          channel: "whatsapp",
          status: "new",
          platform_thread_id: message.from,
        })
        .select()
        .single();

      conversation = newConv;
    }

    // Store the incoming message
    const { error: insertError } = await getSupabase().from("messages").insert({
      conversation_id: conversation.id,
      account_id: account.id,
      direction: "incoming",
      content: message.text,
      type: message.type,
      platform_message_id: message.messageId,
      is_ai: false,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`[WHATSAPP_WEBHOOK] Replay detected for message ${message.messageId}. Ignoring.`);
        return NextResponse.json({ status: "ok" });
      }
      console.error("Failed to insert WhatsApp message:", insertError);
      throw insertError;
    }

    // Update conversation last_message_at and unread_count
    const convUpdates = {
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
    };
    if (conversation.status === "waiting_customer") {
      convUpdates.status = "in_progress";
    }
    await getSupabase()
      .from("conversations")
      .update(convUpdates)
      .eq("id", conversation.id);

    // ─── Auto-Greeting: Send welcome message BEFORE AI reply for new customers ───
    if (account.auto_greeting && isNewCustomer && message.text) {
      try {
        // Use WhatsApp-specific greeting if available, otherwise fall back to default
        let greetingTemplate = account.auto_greeting_message || "Hi! Welcome to {business_name} 👋 How can I help you today?";
        if (account.whatsapp_greeting) {
          greetingTemplate = account.whatsapp_greeting;
        }

        const greetingMessage = greetingTemplate
          .replace(/\{business_name\}/g, account.business_name || "our store")
          .replace(/\{name\}/g, customer.name || "there");

        await sendWhatsAppMessage({
          to: message.from,
          message: greetingMessage,
          phoneNumberId: account.whatsapp_phone_number_id,
          accessToken: account.whatsapp_access_token,
        });

        // Store the greeting message
        await getSupabase().from("messages").insert({
          conversation_id: conversation.id,
          account_id: account.id,
          direction: "outgoing",
          content: greetingMessage,
          type: "text",
          is_ai: false,
        });

        // Track first response time
        if (!conversation.first_response_at) {
          await getSupabase()
            .from("conversations")
            .update({ first_response_at: new Date().toISOString() })
            .eq("id", conversation.id);
        }
      } catch (greetingErr) {
        console.error("WhatsApp auto-greeting failed (non-fatal):", greetingErr.message);
      }
    }

    // ─── AI Auto-Reply ───
    if (account.ai_enabled && message.text) {
      try {
        // Fetch recent conversation history for context
        const { data: recentMessages } = await getSupabase()
          .from("messages")
          .select("content, direction")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(8);

        const history = (recentMessages || []).reverse();

        const aiResult = await generateAIReply({
          accountId: account.id,
          customerId: customer.id,
          customerMessage: message.text,
          customerName: customer.name,
          personality: account.ai_personality,
          country: account.country,
          businessName: account.business_name,
          conversationHistory: history,
          plan: account.plan,
        });

        if (aiResult && aiResult.reply) {
          // Send AI reply via WhatsApp
          await sendWhatsAppMessage({
            to: message.from,
            message: aiResult.reply,
            phoneNumberId: account.whatsapp_phone_number_id,
            accessToken: account.whatsapp_access_token,
          });

          // Store AI reply in database
          await getSupabase().from("messages").insert({
            conversation_id: conversation.id,
            account_id: account.id,
            direction: "outgoing",
            content: aiResult.reply,
            type: "text",
            is_ai: true,
          });

          // Track first response time (if not already set by auto-greeting)
          if (!conversation.first_response_at) {
            await getSupabase()
              .from("conversations")
              .update({ first_response_at: new Date().toISOString() })
              .eq("id", conversation.id);
          }
        }
      } catch (aiErr) {
        console.error("WhatsApp AI auto-reply failed (non-fatal):", aiErr.message);
      }
    }
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
