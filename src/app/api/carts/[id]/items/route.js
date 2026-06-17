/**
 * Cart Items API
 * POST   /api/carts/[id]/items       { productId, qty, variant? }
 * PATCH  /api/carts/[id]/items/[itemId]  { qty? }
 * DELETE /api/carts/[id]/items/[itemId]
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { recomputeTotals } from "../route";

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

/** POST /api/carts/[id]/items — add a product to the cart */
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: cartId } = await params;
    const { productId, qty = 1, variant = null } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }
    if (qty < 1) {
      return NextResponse.json({ error: "qty must be >= 1" }, { status: 400 });
    }

    const admin = getAdminClient();
    const cart = await getOwnedCart(admin, cartId, user.id);
    if (!cart) return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    if (cart.status !== "open") {
      return NextResponse.json({ error: `Cart is ${cart.status} — cannot modify` }, { status: 400 });
    }

    // Look up product
    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("id, name, price, stock, variants, status")
      .eq("id", productId)
      .eq("account_id", user.id)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (product.status !== "active") {
      return NextResponse.json({ error: "Product is not active" }, { status: 400 });
    }

    // Variant price override (if applicable)
    let unitPrice = Number(product.price);
    let variantLabel = null;
    if (variant && Array.isArray(product.variants)) {
      const v = product.variants.find((x) => x.label === variant || x.id === variant);
      if (v) {
        unitPrice = Number(v.price || product.price);
        variantLabel = v.label || v.id;
      }
    }

    // If item already in cart with same variant, merge
    const items = cart.items || [];
    const existingIdx = items.findIndex(
      (i) => i.product_id === productId && (i.variant || null) === (variantLabel || null)
    );

    if (existingIdx >= 0) {
      items[existingIdx].qty += qty;
    } else {
      items.push({
        item_id: crypto.randomUUID(),
        product_id: productId,
        name: product.name,
        price: unitPrice,
        qty,
        variant: variantLabel,
        added_at: new Date().toISOString(),
      });
    }

    cart.items = items;
    const { updated, error } = await persistCart(admin, cart);
    if (error) {
      console.error("[CART-ITEMS] persist failed:", error);
      return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
    }

    return NextResponse.json({ cart: updated });
  } catch (err) {
    console.error("[CART-ITEMS] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
