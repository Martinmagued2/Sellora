/**
 * Subscriptions cron — runs daily (via Vercel Cron).
 * For each active subscription that's due (next_order_at <= now),
 * creates a new order and notifies the customer.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { recomputeTotals, generateOrderNumber } from "@/lib/cart-utils";

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

export async function POST(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();
  const stats = { processed: 0, orders_created: 0, errors: 0 };

  // Find all active subscriptions due now
  const { data: due } = await supabase
    .from("subscriptions")
    .select(`
      id, account_id, customer_id, product_id, variant, quantity,
      frequency_days, price_snapshot, currency, payment_method,
      total_orders,
      customers!inner(name, phone),
      products!inner(name),
      accounts!inner(business_name, whatsapp_access_token, whatsapp_phone_number_id)
    `)
    .eq("status", "active")
    .lte("next_order_at", now);

  for (const sub of due || []) {
    try {
      stats.processed++;
      const items = [{
        item_id: crypto.randomUUID(),
        product_id: sub.product_id,
        name: sub.products.name,
        price: Number(sub.price_snapshot),
        qty: sub.quantity,
        variant: sub.variant,
        added_at: now,
      }];
      const totals = recomputeTotals(items, 0);

      // Create the order
      const orderNumber = generateOrderNumber();
      const { data: order } = await supabase.from("orders").insert({
        account_id: sub.account_id,
        customer_id: sub.customer_id,
        order_number: orderNumber,
        items,
        subtotal: totals.subtotal,
        shipping_cost: 0,
        total: totals.total,
        currency: sub.currency,
        status: "pending",
        channel: "whatsapp",
        payment_method: sub.payment_method,
        payment_status: "unpaid",
        notes: `Recurring subscription order (subscription ${sub.id})`,
      }).select("*").single();

      if (order) {
        stats.orders_created++;

        // Update subscription
        const nextOrderAt = new Date(Date.now() + sub.frequency_days * 86400_000).toISOString();
        await supabase.from("subscriptions").update({
          total_orders: (sub.total_orders || 0) + 1,
          last_order_at: now,
          next_order_at: nextOrderAt,
        }).eq("id", sub.id);

        // Notify customer via WhatsApp
        if (sub.customers?.phone && sub.accounts?.whatsapp_access_token) {
          try {
            const msg = `📦 Your recurring order ${orderNumber} has been created!\n\nProduct: ${sub.products.name}${sub.variant ? ` (${sub.variant})` : ""}\nQuantity: ${sub.quantity}\nTotal: ${sub.currency} ${totals.total}\n\nReply to confirm or modify. 🙏`;
            await sendWhatsAppMessage({
              to: sub.customers.phone,
              message: msg,
              phoneNumberId: sub.accounts.whatsapp_phone_number_id,
              accessToken: sub.accounts.whatsapp_access_token,
            });
          } catch (e) { /* silent */ }
        }
      }
    } catch (e) {
      console.error("[SUBS-CRON] failed:", e.message);
      stats.errors++;
    }
  }

  return NextResponse.json({ success: true, stats, at: now });
}
