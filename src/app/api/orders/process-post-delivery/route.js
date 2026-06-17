/**
 * Post-Delivery Processor
 * POST /api/orders/process-post-delivery
 *
 * Called by a cron job (every 30 min). For orders that:
 *   - Have status = 'delivered' AND
 *   - Haven't had a review request sent yet (stored as order.metadata.review_requested_at)
 *
 * Sends a WhatsApp message asking the customer to rate their purchase 1-5.
 * Includes a link to /review?order=ORD_ID&product=PROD_ID that opens a star-rating page.
 *
 * Auth: CRON_SECRET.
 *
 * Also handles:
 *   - Order just paid → send thank-you + confirmation message
 *   - Payment link sent but not paid in 24h → reminder
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendMessage } from "@/lib/channels/meta";

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

export async function POST(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const stats = { review_requests: 0, payment_reminders: 0, thank_you_sent: 0, errors: 0 };

  try {
    // ─── Phase 1: Post-delivery review requests ───
    // Find orders delivered in the last 7 days that haven't had a review request sent.
    // We track this via a separate table: order_post_delivery_events
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: deliveredOrders } = await supabase
      .from("orders")
      .select(`
        id, order_number, account_id, customer_id, channel, status, updated_at,
        items,
        customers(name, phone),
        accounts!inner(
          business_name, whatsapp_access_token, whatsapp_phone_number_id,
          instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id
        )
      `)
      .eq("status", "delivered")
      .gte("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: false })
      .limit(300);

    for (const order of deliveredOrders || []) {
      try {
        // Check if we've already sent a review request for this order
        const { data: existing } = await supabase
          .from("order_post_delivery_events")
          .select("id")
          .eq("order_id", order.id)
          .eq("event_type", "review_request")
          .maybeSingle();
        if (existing) continue; // already sent

        // Send review request to the customer
        const customer = order.customers;
        const recipientId = customer?.phone;
        if (!recipientId) continue;

        // Build review URL (deep link to a public star-rating page)
        const firstProduct = (order.items || [])[0];
        const reviewUrl = `${APP_URL}/review?order=${order.id}&product=${firstProduct?.product_id || ""}`;

        const message = `Hi ${customer.name || "there"}! 🌟 Your order ${order.order_number} was delivered — we'd love to hear what you think!\n\nTap a star to rate your experience:\n${reviewUrl}\n\nIt takes 10 seconds and means the world to us. Thank you! 🙏`;

        const account = order.accounts;
        let sent = false;
        if (order.channel === "whatsapp") {
          try {
            await sendWhatsAppMessage({
              to: recipientId,
              message,
              phoneNumberId: account.whatsapp_phone_number_id,
              accessToken: account.whatsapp_access_token,
            });
            sent = true;
          } catch (e) { console.error("[POST-DELIVERY] WA send failed:", e.message); }
        } else if (order.channel === "instagram" && account.instagram_access_token) {
          try {
            await sendMessage({
              recipientId,
              message,
              pageId: account.instagram_page_id,
              accessToken: account.instagram_access_token,
            });
            sent = true;
          } catch (e) { console.error("[POST-DELIVERY] IG send failed:", e.message); }
        } else if (account.facebook_access_token) {
          try {
            await sendMessage({
              recipientId,
              message,
              pageId: account.facebook_page_id,
              accessToken: account.facebook_access_token,
            });
            sent = true;
          } catch (e) { console.error("[POST-DELIVERY] FB send failed:", e.message); }
        }

        if (sent) {
          // Record the event so we don't double-send
          await supabase.from("order_post_delivery_events").insert({
            order_id: order.id,
            account_id: order.account_id,
            event_type: "review_request",
            sent_at: new Date().toISOString(),
          });
          stats.review_requests++;
        } else {
          stats.errors++;
        }
      } catch (e) {
        console.error("[POST-DELIVERY] review request error:", e.message);
        stats.errors++;
      }
    }

    // ─── Phase 2: Payment link reminders (C2) ───
    // For orders with payment_link sent >24h ago, still unpaid → remind the customer.
    const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: unpaidOrders } = await supabase
      .from("orders")
      .select(`
        id, order_number, total, currency, payment_link, payment_status, channel, updated_at,
        customers(name, phone),
        accounts!inner(whatsapp_access_token, whatsapp_phone_number_id, business_name)
      `)
      .eq("payment_status", "unpaid")
      .not("payment_link", "is", null)
      .lt("updated_at", oneDayAgo)
      .order("updated_at", { ascending: false })
      .limit(200);

    for (const order of unpaidOrders || []) {
      try {
        // Check if we've already sent a payment reminder
        const { data: existing } = await supabase
          .from("order_post_delivery_events")
          .select("id")
          .eq("order_id", order.id)
          .eq("event_type", "payment_reminder")
          .maybeSingle();
        if (existing) continue;

        const customer = order.customers;
        const recipientId = customer?.phone;
        if (!recipientId) continue;

        const message = `Hi ${customer.name || "there"}! Just a friendly reminder — your order ${order.order_number} for ${order.currency} ${order.total} is still pending payment.\n\nComplete your purchase here: ${order.payment_link}\n\nReply here if you need any help! 🙏`;

        const account = order.accounts;
        let sent = false;
        if (order.channel === "whatsapp") {
          try {
            await sendWhatsAppMessage({
              to: recipientId,
              message,
              phoneNumberId: account.whatsapp_phone_number_id,
              accessToken: account.whatsapp_access_token,
            });
            sent = true;
          } catch (e) { /* ignore */ }
        }

        if (sent) {
          await supabase.from("order_post_delivery_events").insert({
            order_id: order.id,
            account_id: order.account_id,
            event_type: "payment_reminder",
            sent_at: new Date().toISOString(),
          });
          stats.payment_reminders++;
        } else {
          stats.errors++;
        }
      } catch (e) {
        console.error("[POST-DELIVERY] payment reminder error:", e.message);
        stats.errors++;
      }
    }

    return NextResponse.json({ success: true, stats, at: new Date().toISOString() });
  } catch (err) {
    console.error("[POST-DELIVERY] fatal:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}
