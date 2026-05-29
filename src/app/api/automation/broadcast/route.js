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
 * POST /api/automation/broadcast
 * Send a bulk message to customers across channels.
 * Body: { audience, channel, message, template_name?, template_language? }
 */
export async function POST(req) {
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
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { audience, channel, message, template_name, template_language } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!channel) {
      return NextResponse.json({ error: "Channel is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch account info for channel credentials and business_name
    const { data: account } = await supabase
      .from("accounts")
      .select("id, business_name, instagram_connected, instagram_page_id, instagram_access_token, facebook_connected, facebook_page_id, facebook_access_token, whatsapp_connected, whatsapp_phone_number_id")
      .eq("id", user.id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Build customer query based on audience filter
    let customerQuery = supabase
      .from("customers")
      .select("id, name, channel, platform_id, phone")
      .eq("account_id", user.id);

    if (audience === "instagram") {
      customerQuery = customerQuery.eq("channel", "instagram");
    } else if (audience === "facebook") {
      customerQuery = customerQuery.eq("channel", "facebook");
    } else if (audience === "whatsapp") {
      customerQuery = customerQuery.eq("channel", "whatsapp");
    }
    // "all" or any other value => no filter

    const { data: customers, error: customersError } = await customerQuery;

    if (customersError) {
      return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({ success: true, sent: 0, failed: 0, message: "No matching customers found" });
    }

    let sent = 0;
    let failed = 0;

    // Resolve channel credentials
    const channelConfig = {
      instagram: {
        connected: account.instagram_connected || false,
        pageId: account.instagram_page_id || null,
        accessToken: account.instagram_access_token || null,
      },
      facebook: {
        connected: account.facebook_connected || false,
        pageId: account.facebook_page_id || null,
        accessToken: account.facebook_access_token || null,
      },
      whatsapp: {
        connected: account.whatsapp_connected || false,
        phoneNumberId: account.whatsapp_phone_number_id || null,
      },
    };

    const selectedChannel = channelConfig[channel];

    if (!selectedChannel?.connected) {
      return NextResponse.json({ error: `${channel} channel is not connected` }, { status: 400 });
    }

    // Send messages (limit to 100 per broadcast to avoid abuse)
    const recipients = customers.slice(0, 100);

    for (const customer of recipients) {
      const personalizedMessage = message
        .replace(/\{name\}/g, customer.name || "Customer")
        .replace(/\{business_name\}/g, account.business_name || "our store");

      let sendError = null;

      try {
        if (channel === "instagram" || channel === "facebook") {
          if (!selectedChannel.pageId || !selectedChannel.accessToken) {
            sendError = "Missing page credentials";
          } else if (!customer.platform_id) {
            sendError = "No platform ID for customer";
          } else {
            await sendMessage({
              recipientId: customer.platform_id,
              message: personalizedMessage,
              pageId: selectedChannel.pageId,
              accessToken: selectedChannel.accessToken,
            });
          }
        } else if (channel === "whatsapp") {
          const phone = customer.phone || customer.platform_id;
          if (!phone) {
            sendError = "No phone number for customer";
          } else {
            await sendWhatsAppMessage({
              to: phone,
              message: personalizedMessage,
              phoneNumberId: selectedChannel.phoneNumberId,
            });
          }
        }
      } catch (err) {
        sendError = err.message || "Send failed";
      }

      // Log the broadcast attempt
      await supabase.from("broadcast_logs").insert({
        account_id: user.id,
        channel,
        audience,
        customer_id: customer.id,
        message: personalizedMessage,
        status: sendError ? "failed" : "sent",
        error: sendError || null,
      }).then(({ error }) => {
        // Silently handle broadcast_logs insert errors (table may not exist yet)
        if (error) console.warn("Broadcast log insert failed:", error.message);
      });

      if (sendError) {
        failed++;
      } else {
        sent++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: recipients.length,
    });
  } catch (error) {
    console.error("Broadcast error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
