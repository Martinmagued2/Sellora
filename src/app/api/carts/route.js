/**
 * Cart API
 *
 * POST   /api/carts                 { conversationId?, customerId? }    → create/get open cart for context
 * GET    /api/carts/[id]                                                  → get cart
 * POST   /api/carts/[id]/items       { productId, qty, variant? }        → add item
 * PATCH  /api/carts/[id]/items/[itemId]  { qty? }                         → update qty
 * DELETE /api/carts/[id]/items/[itemId]                                  → remove item
 * POST   /api/carts/[id]/checkout    { }                                  → convert cart to order
 *
 * Carts are the multi-item version of an order-in-progress. The AI uses
 * these tools to build up a cart with a customer over chat, then convert
 * to an order once the customer confirms.
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

/** POST /api/carts — create or return existing open cart for a conversation/customer */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId, customerId } = await req.json();
    const admin = getAdminClient();

    // Look up existing open cart for this conversation
    let query = admin
      .from("carts")
      .select("*")
      .eq("account_id", user.id)
      .eq("status", "open");

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    } else if (customerId) {
      query = query.eq("customer_id", customerId);
    } else {
      return NextResponse.json({ error: "conversationId or customerId required" }, { status: 400 });
    }

    const { data: existing } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existing) {
      return NextResponse.json({ cart: existing });
    }

    // Create a new cart
    const insertPayload = {
      account_id: user.id,
      status: "open",
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
    };
    if (conversationId) insertPayload.conversation_id = conversationId;
    if (customerId) insertPayload.customer_id = customerId;

    const { data: cart, error } = await admin
      .from("carts")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("[CART] create failed:", error);
      return NextResponse.json({ error: "Failed to create cart" }, { status: 500 });
    }

    return NextResponse.json({ cart });
  } catch (err) {
    console.error("[CART] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

