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
 * POST /api/campaigns/send
 * Sends a campaign message to all matching customers with individual broadcast logging
 * Body: { campaignId }
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

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Fetch the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("account_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // 2. Update campaign status to active
    await supabase
      .from("campaigns")
      .update({ status: "active" })
      .eq("id", campaignId);

    // 3. Build audience query based on filter
    const filter = campaign.audience_filter || {};
    const campaignChannel = campaign.channel || filter.channel || "all";

    let query = supabase
      .from("customers")
      .select("id, name, phone, channel, platform_id, tags, total_spent, total_orders")
      .eq("account_id", user.id);

    // Filter by channel
    if (campaignChannel !== "all") {
      query = query.eq("channel", campaignChannel);
    }
    // Also check audience_filter.channel for backward compat
    if (filter.channel && filter.channel !== "all" && campaignChannel === "all") {
      query = query.eq("channel", filter.channel);
    }

    // Filter by tag (VIP, new, returning)
    if (filter.tag && filter.tag !== "all") {
      query = query.contains("tags", [filter.tag]);
    }

    // Filter by minimum spent amount
    if (filter.min_spent && filter.min_spent > 0) {
      query = query.gte("total_spent", filter.min_spent);
    }

    // Filter by audience type
    if (filter.type && filter.type !== "all") {
      if (filter.type === "vip") query = query.contains("tags", ["VIP"]);
      if (filter.type === "returning") query = query.eq("is_returning", true);
      if (filter.type === "new") query = query.eq("is_returning", false);
    }

    const { data: customers, error: customersError } = await query;

    if (customersError) {
      console.error("Failed to fetch customers for campaign:", customersError);
      return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      await supabase
        .from("campaigns")
        .update({ status: "completed", sent_count: 0 })
        .eq("id", campaignId);
      return NextResponse.json({ success: true, sent: 0, message: "No matching customers found" });
    }

    // 4. Get account info for channel tokens and personalization
    const { data: account } = await supabase
      .from("accounts")
      .select("id, business_name, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_connected")
      .eq("id", user.id)
      .single();

    // 5. Delete existing broadcast logs for this campaign (if re-sending)
    await supabase
      .from("broadcast_logs")
      .delete()
      .eq("campaign_id", campaignId);

    // 6. Create broadcast log entries (pending) for all target customers
    const broadcastLogEntries = customers.map((customer) => ({
      account_id: user.id,
      campaign_id: campaignId,
      customer_id: customer.id,
      status: "pending",
      channel: customer.channel || campaignChannel !== "all" ? campaignChannel : "instagram",
    }));

    await supabase
      .from("broadcast_logs")
      .insert(broadcastLogEntries);

    // 7. Send messages to each customer and update broadcast logs
    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    for (const customer of customers) {
      try {
        // Personalize message with {name}, {business_name}, {order_number}
        const personalizedMessage = campaign.message_template
          .replace(/\{name\}/g, customer.name || "Customer")
          .replace(/\{business_name\}/g, account?.business_name || "our store");

        const customerChannel = customer.channel || campaignChannel !== "all" ? campaignChannel : "instagram";
        let platformMessageId = null;

        if (customerChannel === "whatsapp" && account?.whatsapp_connected && account?.whatsapp_access_token) {
          // Send via WhatsApp
          if (customer.phone) {
            const result = await sendWhatsAppMessage({
              to: customer.phone,
              message: personalizedMessage,
              phoneNumberId: account.whatsapp_phone_number_id,
              accessToken: account.whatsapp_access_token,
            });
            platformMessageId = result?.messages?.[0]?.id || null;
            deliveredCount++;
          } else {
            failedCount++;
            await updateBroadcastLog(supabase, campaignId, customer.id, "failed", "No phone number for WhatsApp");
            continue;
          }
        } else if ((customerChannel === "instagram" || customerChannel === "facebook") && customer.platform_id) {
          // Send via Meta API
          const accessToken = customerChannel === "instagram"
            ? account?.instagram_access_token
            : account?.facebook_access_token;
          const pageId = customerChannel === "instagram"
            ? account?.instagram_page_id
            : account?.facebook_page_id;

          if (accessToken && pageId) {
            const result = await sendMessage({
              recipientId: customer.platform_id,
              message: personalizedMessage,
              pageId,
              accessToken,
            });
            platformMessageId = result?.message_id || null;
            deliveredCount++;
          } else {
            failedCount++;
            await updateBroadcastLog(supabase, campaignId, customer.id, "failed", `No ${customerChannel} access token`);
            continue;
          }
        } else {
          // No channel available
          failedCount++;
          await updateBroadcastLog(supabase, campaignId, customer.id, "failed", `No channel available for ${customerChannel}`);
          continue;
        }

        sentCount++;

        // Update broadcast log to 'sent'
        await updateBroadcastLog(supabase, campaignId, customer.id, "sent", null, platformMessageId);

        // Update customer last_contacted_at
        await supabase
          .from("customers")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", customer.id);

      } catch (err) {
        console.error(`Failed to send campaign message to customer ${customer.id}:`, err.message);
        failedCount++;
        await updateBroadcastLog(supabase, campaignId, customer.id, "failed", err.message);
      }
    }

    // 8. Update campaign stats
    await supabase
      .from("campaigns")
      .update({
        status: "completed",
        sent_count: sentCount,
        delivered_count: deliveredCount,
      })
      .eq("id", campaignId);

    return NextResponse.json({
      success: true,
      sent: sentCount,
      delivered: deliveredCount,
      failed: failedCount,
      total: customers.length,
    });
  } catch (error) {
    console.error("Campaigns send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Helper: Update a single broadcast log entry
 */
async function updateBroadcastLog(supabase, campaignId, customerId, status, errorMessage = null, platformMessageId = null) {
  const updates = {
    status,
    sent_at: status === "sent" ? new Date().toISOString() : undefined,
    error_message: errorMessage,
  };
  if (platformMessageId) updates.platform_message_id = platformMessageId;

  // Remove undefined keys
  Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

  await supabase
    .from("broadcast_logs")
    .update(updates)
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId);
}
