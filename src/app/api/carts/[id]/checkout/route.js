/**
 * Cart Checkout API
 * POST /api/carts/[id]/checkout
 *
 * Converts an open cart into a finalized order.
 * Body: { shippingAddress?, notes?, paymentMethod? }
 *
 * Creates an order with all cart items, marks cart as 'converted',
 * and returns the created order.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

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

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: cartId } = await params;
    const { shippingAddress = null, notes = null, paymentMethod = null } = await req.json();

    const admin = getAdminClient();

    const { data: cart, error: cartErr } = await admin
      .from("carts")
      .select("*")
      .eq("id", cartId)
      .eq("account_id", user.id)
      .single();

    if (cartErr || !cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }
    if (cart.status !== "open") {
      return NextResponse.json({ error: `Cart is ${cart.status}` }, { status: 400 });
    }
    if (!cart.items || cart.items.length === 0) {
      return NextResponse.json({ error: "Cannot checkout empty cart" }, { status: 400 });
    }

    // Create the order
    const orderPayload = {
      account_id: user.id,
      customer_id: cart.customer_id,
      order_number: generateOrderNumber(),
      items: cart.items,
      subtotal: cart.subtotal,
      shipping_cost: 0,
      total: cart.total,
      currency: cart.currency || "EGP",
      status: "pending",
      channel: "whatsapp",
      payment_method: paymentMethod,
      payment_status: "unpaid",
      shipping_address: shippingAddress,
      notes,
    };

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (orderErr) {
      console.error("[CART-CHECKOUT] order insert failed:", orderErr);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Mark cart as converted
    await admin
      .from("carts")
      .update({
        status: "converted",
        converted_order_id: order.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cartId);

    // Decrement stock for each product
    for (const item of cart.items) {
      try {
        const { data: product } = await admin
          .from("products")
          .select("stock")
          .eq("id", item.product_id)
          .single();
        if (product && Number(product.stock) >= item.qty) {
          await admin
            .from("products")
            .update({ stock: Number(product.stock) - item.qty })
            .eq("id", item.product_id);
        }
      } catch (e) {
        console.warn(`[CART-CHECKOUT] stock decrement failed for ${item.product_id}:`, e.message);
      }
    }

    // Update customer lifetime value
    if (cart.customer_id) {
      try {
        const { data: customer } = await admin
          .from("customers")
          .select("total_orders, total_spent, lifetime_value")
          .eq("id", cart.customer_id)
          .single();
        if (customer) {
          await admin
            .from("customers")
            .update({
              total_orders: (customer.total_orders || 0) + 1,
              total_spent: Number(customer.total_spent || 0) + Number(cart.total),
              lifetime_value: Number(customer.lifetime_value || 0) + Number(cart.total),
              last_active_at: new Date().toISOString(),
            })
            .eq("id", cart.customer_id);
        }
      } catch (e) {
        console.warn("[CART-CHECKOUT] customer update failed:", e.message);
      }
    }

    return NextResponse.json({ order, cart: { ...cart, status: "converted" } });
  } catch (err) {
    console.error("[CART-CHECKOUT] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
