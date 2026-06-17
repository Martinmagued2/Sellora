/**
 * Subscriptions API
 * GET    /api/subscriptions                   — list
 * POST   /api/subscriptions                   — create { customer_id, product_id, frequency_days, ... }
 * PATCH  /api/subscriptions/[id]              — update status (pause/resume/cancel)
 * POST   /api/subscriptions/process-scheduled — cron: create orders for due subscriptions
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

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("subscriptions")
      .select(`
        *,
        customers!inner(name, phone),
        products!inner(name, image_urls)
      `)
      .eq("account_id", user.id)
      .order("next_order_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscriptions: data || [] });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { customer_id, product_id, variant, quantity = 1, frequency_days = 30, payment_method } = await req.json();
    if (!customer_id || !product_id || !frequency_days) {
      return NextResponse.json({ error: "customer_id, product_id, frequency_days required" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Fetch product to snapshot price
    const { data: product } = await admin
      .from("products")
      .select("price, currency")
      .eq("id", product_id)
      .eq("account_id", user.id)
      .single();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const nextOrderAt = new Date(Date.now() + frequency_days * 86400_000).toISOString();

    const { data, error } = await admin
      .from("subscriptions")
      .insert({
        account_id: user.id,
        customer_id,
        product_id,
        variant,
        quantity,
        frequency_days,
        next_order_at: nextOrderAt,
        price_snapshot: product.price,
        currency: product.currency || "EGP",
        payment_method,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription: data });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
