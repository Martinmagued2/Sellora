import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage, sendProductCard } from "@/lib/channels/meta";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

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
      try {
        const cookieStore = await cookies();
        const supabaseAuth = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll(cookiesToSet) {
                try {
                  cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                  );
                } catch {
                  // Server Component context — ignore
                }
              },
            },
          }
        );

        const { data: { user }, error: sessionError } = await supabaseAuth.getUser();
        if (sessionError || !user) {
          return NextResponse.json({ error: "Authentication required. Log in to send messages." }, { status: 401 });
        }
        authenticatedUserId = user.id;
      } catch (e) {
        return NextResponse.json({ error: "Authentication required. Log in to send messages." }, { status: 401 });
      }

      // Verify the authenticated user owns this conversation
      if (authenticatedUserId !== conversation.account_id) {
        return NextResponse.json({ error: "You do not have access to this conversation" }, { status: 403 });
      }
    }

    // Secondary consistency check: if x-account-id is provided, it must match
    const headerAccountId = request.headers.get("x-account-id") || bodyAccountId;
    if (headerAccountId && headerAccountId !== conversation.account_id) {
      return NextResponse.json({ error: "You do not have access to this conversation" }, { status: 403 });
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

      const phoneNumber = customer?.phone || customer?.platform_id;
      if (!phoneNumber) {
        return NextResponse.json({ error: "Customer has no phone number for WhatsApp" }, { status: 400 });
      }

      // Send via WhatsApp Cloud API
      const sendResult = await sendWhatsAppMessage({
        to: phoneNumber,
        message: content,
        phoneNumberId: account.whatsapp_phone_number_id,
        accessToken: account.whatsapp_access_token,
      });

      // Save the outgoing message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        account_id,
        direction: "outgoing",
        content,
        type,
        is_ai: false,
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
