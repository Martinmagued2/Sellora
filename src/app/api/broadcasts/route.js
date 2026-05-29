import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendMessage } from "@/lib/channels/meta";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// Service role client (lazy-initialized)
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
 * POST /api/broadcasts
 *
 * Send a quick broadcast message to multiple conversations at once.
 * Unlike campaigns (which target customer segments), broadcasts target
 * specific conversations directly.
 *
 * Body: { conversationIds: string[], message: string, channel?: string }
 *   - conversationIds: array of conversation UUIDs to broadcast to
 *   - message: the message text (supports {name} and {business_name} placeholders)
 *   - channel: optional channel override ("whatsapp" | "instagram" | "facebook")
 *
 * Returns: { success: true, sent: number, failed: number, results: [...] }
 */
export async function POST(req) {
  try {
    // ── Auth ──
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

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Validate body ──
    const body = await req.json();
    const { conversationIds, message, channel: channelOverride } = body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: "conversationIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (channelOverride && !["whatsapp", "instagram", "facebook"].includes(channelOverride)) {
      return NextResponse.json(
        { error: "channel must be one of: whatsapp, instagram, facebook" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // ── Fetch all conversations with customer info ──
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select(
        `
        id,
        channel,
        account_id,
        customer:customers(id, name, phone, platform_id, channel)
        `
      )
      .in("id", conversationIds)
      .eq("account_id", user.id);

    if (convError) {
      console.error("[BROADCAST] Failed to fetch conversations:", convError);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json(
        { error: "No valid conversations found for your account" },
        { status: 404 }
      );
    }

    // Build a lookup for quick access
    const convMap = new Map(conversations.map((c) => [c.id, c]));

    // Track which conversation IDs were not found
    const notFoundIds = conversationIds.filter((id) => !convMap.has(id));

    // ── Fetch the account info (for tokens & business_name) ──
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select(
        `
        id,
        business_name,
        instagram_access_token,
        instagram_page_id,
        facebook_access_token,
        facebook_page_id,
        whatsapp_phone_number_id,
        whatsapp_access_token,
        whatsapp_connected
        `
      )
      .eq("id", user.id)
      .single();

    if (accountError || !account) {
      console.error("[BROADCAST] Failed to fetch account:", accountError);
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const businessName = account.business_name || "our store";

    // ── Send to each conversation ──
    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (const convId of conversationIds) {
      const conversation = convMap.get(convId);

      // Conversation not found or doesn't belong to this account
      if (!conversation) {
        failedCount++;
        results.push({
          conversationId: convId,
          status: "failed",
          error: "Conversation not found or not owned by your account",
        });
        continue;
      }

      const customer = conversation.customer;
      const effectiveChannel = channelOverride || conversation.channel;

      if (!effectiveChannel) {
        failedCount++;
        results.push({
          conversationId: convId,
          status: "failed",
          error: "Could not determine channel for this conversation",
        });
        continue;
      }

      try {
        // ── Personalize message ──
        const personalizedMessage = message
          .replace(/\{name\}/g, customer?.name || "Customer")
          .replace(/\{business_name\}/g, businessName);

        let platformMessageId = null;

        // ── WhatsApp Channel ──
        if (effectiveChannel === "whatsapp") {
          if (!account.whatsapp_connected || !account.whatsapp_access_token) {
            throw new Error("WhatsApp is not connected for your account");
          }

          const phoneNumber = customer?.phone;
          if (!phoneNumber) {
            throw new Error("Customer has no phone number for WhatsApp");
          }

          const sendResult = await sendWhatsAppMessage({
            to: phoneNumber,
            message: personalizedMessage,
            phoneNumberId: account.whatsapp_phone_number_id,
          });

          platformMessageId = sendResult?.messages?.[0]?.id || null;
        }
        // ── Instagram / Facebook Channel ──
        else if (effectiveChannel === "instagram" || effectiveChannel === "facebook") {
          const recipientId = customer?.platform_id;
          if (!recipientId) {
            throw new Error(`Customer has no platform ID for ${effectiveChannel}`);
          }

          const accessToken =
            effectiveChannel === "instagram"
              ? account.instagram_access_token
              : account.facebook_access_token;

          const pageId =
            effectiveChannel === "instagram"
              ? account.instagram_page_id
              : account.facebook_page_id;

          if (!accessToken || !pageId) {
            throw new Error(`${effectiveChannel} is not connected for your account`);
          }

          const sendResult = await sendMessage({
            recipientId,
            message: personalizedMessage,
            pageId,
            accessToken,
          });

          platformMessageId = sendResult?.message_id || null;
        } else {
          throw new Error(`Unsupported channel: ${effectiveChannel}`);
        }

        // ── Store the outgoing message ──
        const { error: insertError } = await supabase.from("messages").insert({
          conversation_id: convId,
          direction: "outgoing",
          content: personalizedMessage,
          type: "text",
          is_ai: false,
          platform_message_id: platformMessageId,
        });

        if (insertError) {
          console.error(
            `[BROADCAST] Failed to save message for conversation ${convId}:`,
            insertError
          );
          // Don't fail the broadcast — the message was sent successfully
        }

        // ── Log in broadcast_logs ──
        const { error: logError } = await supabase.from("broadcast_logs").insert({
          account_id: user.id,
          conversation_id: convId,
          customer_id: customer?.id || null,
          channel: effectiveChannel,
          status: "sent",
          platform_message_id: platformMessageId,
        });

        if (logError) {
          console.error(
            `[BROADCAST] Failed to log broadcast for conversation ${convId}:`,
            logError
          );
        }

        // ── Update conversation last_message_at ──
        const { error: updateError } = await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            status: "waiting_customer",
          })
          .eq("id", convId);

        if (updateError) {
          console.error(
            `[BROADCAST] Failed to update conversation ${convId}:`,
            updateError
          );
        }

        sentCount++;
        results.push({
          conversationId: convId,
          status: "sent",
          channel: effectiveChannel,
          platformMessageId,
        });
      } catch (err) {
        console.error(
          `[BROADCAST] Failed for conversation ${convId}:`,
          err.message
        );

        failedCount++;

        // Log the failure in broadcast_logs
        try {
          await supabase.from("broadcast_logs").insert({
            account_id: user.id,
            conversation_id: convId,
            customer_id: customer?.id || null,
            channel: effectiveChannel,
            status: "failed",
            error_message: err.message,
          });
        } catch (logErr) {
          console.error(
            `[BROADCAST] Failed to log broadcast failure for ${convId}:`,
            logErr
          );
        }

        results.push({
          conversationId: convId,
          status: "failed",
          channel: effectiveChannel,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: conversationIds.length,
      notFound: notFoundIds.length,
      results,
    });
  } catch (error) {
    console.error("[BROADCAST] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/broadcasts
 *
 * Get broadcast logs for the authenticated account.
 *
 * Query params:
 *   - limit: number of logs to return (default 50, max 200)
 *   - offset: number of logs to skip (default 0)
 *
 * Returns: { success: true, logs: [...], total: number }
 */
export async function GET(req) {
  try {
    // ── Auth ──
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

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);

    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50", 10), 1),
      200
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10),
      0
    );

    // ── Get total count ──
    const { count, error: countError } = await supabase
      .from("broadcast_logs")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.id);

    if (countError) {
      console.error("[BROADCAST] Failed to count logs:", countError);
      return NextResponse.json(
        { error: "Failed to fetch broadcast logs" },
        { status: 500 }
      );
    }

    // ── Get paginated logs with related info ──
    const { data: logs, error: logsError } = await supabase
      .from("broadcast_logs")
      .select(
        `
        id,
        channel,
        status,
        platform_message_id,
        error_message,
        created_at,
        customer:customers(id, name, phone),
        conversation:conversations(id, channel)
        `
      )
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsError) {
      console.error("[BROADCAST] Failed to fetch logs:", logsError);
      return NextResponse.json(
        { error: "Failed to fetch broadcast logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[BROADCAST] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
