import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { parseWebhookMessage, sendWhatsAppMessage, markMessageAsRead } from "@/lib/whatsapp";
import { generateAIReply } from "@/lib/ai";
import { verifyMetaSignature } from "@/lib/channels/verify";
import { logSecurityEvent } from "@/lib/security-logger";

// Service role client for webhook processing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
 */
export async function POST(request) {
  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Verify the webhook signature securely
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

  const body = JSON.parse(rawBody);

  // Parse the incoming message
  const message = parseWebhookMessage(body);

  if (!message) {
    // Not a message event (could be status update, etc.)
    return NextResponse.json({ status: "ok" });
  }

  try {
    // Mark message as read immediately
    await markMessageAsRead({ messageId: message.messageId });

    // Find or create customer
    let { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", message.from)
      .single();

    if (!customer) {
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          phone: message.from,
          name: message.contactName || "Unknown",
          channel: "whatsapp",
        })
        .select()
        .single();

      customer = newCustomer;
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          customer_id: customer.id,
          channel: "whatsapp",
          status: "open",
        })
        .select()
        .single();

      conversation = newConv;
    }

    // Store the incoming message
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "incoming",
      content: message.text,
      type: message.type,
      whatsapp_message_id: message.messageId,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`[WHATSAPP_WEBHOOK] Replay detected for message ${message.messageId}. Ignoring.`);
        return NextResponse.json({ status: "ok" });
      }
      console.error("Failed to insert WhatsApp message:", insertError);
      throw insertError;
    }

    // Update conversation last_message_at
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    // --- AI Auto-Reply ---
    // Fetch AI settings for this account
    const { data: account } = await supabase
      .from("accounts")
      .select("ai_enabled, ai_personality, products:products(name, price, description)")
      .single(); // In a multi-tenant setup, filter by account_id

    if (account?.ai_enabled && message.text) {
      const aiReply = await generateAIReply({
        customerMessage: message.text,
        customerName: customer.name,
        personality: account.ai_personality,
        products: account.products || [],
      });

      if (aiReply) {
        // Send AI reply via WhatsApp
        await sendWhatsAppMessage({
          to: message.from,
          message: aiReply,
        });

        // Store AI reply in database
        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          direction: "outgoing",
          content: aiReply,
          type: "text",
          is_ai: true,
        });
      }
    }
  } catch (err) {
    console.error("Error processing WhatsApp message:", err);
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: "ok" });
}
