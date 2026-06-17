/**
 * Cart Item by ID API
 * PATCH  /api/carts/[id]/items/[itemId]  { qty }        — update item qty
 * DELETE /api/carts/[id]/items/[itemId]                  — remove item from cart
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { recomputeTotals } from "@/lib/cart-utils";

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

async function getOwnedCart(admin, cartId, userId) {
  const { data: cart } = await admin
    .from("carts")
    .select("*")
    .eq("id", cartId)
    .eq("account_id", userId)
    .single();
  return cart;
}

async function persistCart(admin, cart) {
  const totals = recomputeTotals(cart.items || [], Number(cart.discount) || 0);
  const { data: updated, error } = await admin
    .from("carts")
    .update({
      items: cart.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cart.id)
    .select("*")
    .single();
  return { updated, error };
}

/** DELETE /api/carts/[id]/items/[itemId] — remove an item from the cart */
export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: cartId, itemId } = await params;
    const admin = getAdminClient();

    const cart = await getOwnedCart(admin, cartId, user.id);
    if (!cart) return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    if (cart.status !== "open") {
      return NextResponse.json({ error: `Cart is ${cart.status}` }, { status: 400 });
    }

    cart.items = (cart.items || []).filter((i) => i.item_id !== itemId);
    const { updated, error } = await persistCart(admin, cart);
    if (error) return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });

    return NextResponse.json({ cart: updated });
  } catch (err) {
    console.error("[CART-ITEM] DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH /api/carts/[id]/items/[itemId] — update item qty */
export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: cartId, itemId } = await params;
    const { qty } = await req.json();

    if (!qty || qty < 1) {
      return NextResponse.json({ error: "qty must be >= 1" }, { status: 400 });
    }

    const admin = getAdminClient();
    const cart = await getOwnedCart(admin, cartId, user.id);
    if (!cart) return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    if (cart.status !== "open") {
      return NextResponse.json({ error: `Cart is ${cart.status}` }, { status: 400 });
    }

    const items = cart.items || [];
    const idx = items.findIndex((i) => i.item_id === itemId);
    if (idx < 0) return NextResponse.json({ error: "Item not in cart" }, { status: 404 });

    items[idx].qty = qty;
    cart.items = items;
    const { updated, error } = await persistCart(admin, cart);
    if (error) return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });

    return NextResponse.json({ cart: updated });
  } catch (err) {
    console.error("[CART-ITEM] PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
