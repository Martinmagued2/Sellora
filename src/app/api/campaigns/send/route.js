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
 * Sends a campaign message to all matching customers
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
    let query = supabase
      .from("customers")
      .select("id, name, phone, channel, platform_id, tags, total_spent, total_orders")
      .eq("account_id", user.id);

    // Filter by channel
    if (filter.channel && filter.channel !== "all") {
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

    // 5. Send messages to each customer
    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    for (const customer of customers) {
      try {
        // Personalize message with {name}
        const personalizedMessage = campaign.message_template
          .replace(/\{name\}/g, customer.name || "Customer")
          .replace(/\{business_name\}/g, account?.business_name || "our store");

        const customerChannel = customer.channel || filter.channel || "instagram";

        if (customerChannel === "whatsapp" && account?.whatsapp_connected && account?.whatsapp_access_token) {
          // Send via WhatsApp
          if (customer.phone) {
            await sendWhatsAppMessage({
              to: customer.phone,
              message: personalizedMessage,
              phoneNumberId: account.whatsapp_phone_number_id,
            });
            deliveredCount++;
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
            await sendMessage({
              recipientId: customer.platform_id,
              message: personalizedMessage,
              pageId,
              accessToken,
            });
            deliveredCount++;
          }
        } else {
          // No channel available - skip but still count as attempted
          failedCount++;
          continue;
        }

        sentCount++;
      } catch (err) {
        console.error(`Failed to send campaign message to customer ${customer.id}:`, err.message);
        failedCount++;
      }
    }

    // 6. Update campaign stats
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
