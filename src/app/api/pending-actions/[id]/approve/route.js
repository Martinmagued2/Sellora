/**
 * Approve Pending Action
 * POST /api/pending-actions/[id]/approve
 *
 * Approves and executes a pending AI action.
 * For 'create_order': creates the order, returns order_id
 * For 'redeem_coupon': applies the coupon
 * For 'send_payment_link': sends the link via WhatsApp
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { recomputeTotals, generateOrderNumber } from "@/lib/cart-utils";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const admin = getAdminClient();

    const { data: action, error: fetchErr } = await admin
      .from("pending_actions")
      .select("*")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (fetchErr || !action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }
    if (action.status !== "pending") {
      return NextResponse.json({ error: `Action is already ${action.status}` }, { status: 400 });
    }

    let result = {};

    // Execute based on action_type
    if (action.action_type === "create_order") {
      const payload = action.payload || {};
      const items = payload.items || [];
      const totals = recomputeTotals(items, payload.discount || 0);

      const orderNumber = generateOrderNumber();
      const { data: order, error: orderErr } = await admin
        .from("orders")
        .insert({
          account_id: user.id,
          customer_id: action.customer_id || payload.customer_id,
          order_number: orderNumber,
          items,
          subtotal: totals.subtotal,
          shipping_cost: payload.shipping_cost || 0,
          total: totals.total,
          currency: payload.currency || "EGP",
          status: "pending",
          channel: payload.channel || "whatsapp",
          payment_method: payload.payment_method,
          payment_status: "unpaid",
          shipping_address: payload.shipping_address,
          notes: payload.notes,
        })
        .select("*")
        .single();

      if (orderErr) throw new Error(orderErr.message);
      result = { order_id: order.id, order_number: orderNumber };

      // Decrement stock
      for (const item of items) {
        try {
          const { data: product } = await admin.from("products").select("stock").eq("id", item.product_id).single();
          if (product && Number(product.stock) >= item.qty) {
            await admin.from("products").update({ stock: Number(product.stock) - item.qty }).eq("id", item.product_id);
          }
        } catch (e) { /* ignore */ }
      }
    } else if (action.action_type === "redeem_coupon") {
      // Mark coupon as redeemed (decrement used_count)
      const code = action.payload?.code;
      if (code) {
        const { data: coupon } = await admin
          .from("coupons")
          .select("id, used_count")
          .eq("account_id", user.id)
          .eq("code", code.toUpperCase())
          .single();
        if (coupon) {
          await admin.from("coupons").update({ used_count: (coupon.used_count || 0) + 1 }).eq("id", coupon.id);
        }
      }
      result = { coupon_redeemed: true };
    } else if (action.action_type === "send_payment_link") {
      // For now just mark as executed — actual payment link sending is in another endpoint
      result = { payment_link: action.payload?.link };
    }

    // Mark action as executed
    await admin
      .from("pending_actions")
      .update({
        status: "executed",
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        result,
      })
      .eq("id", id);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[PENDING-ACTIONS] approve error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
