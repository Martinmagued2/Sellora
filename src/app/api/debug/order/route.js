/**
 * Debug endpoint — test order lookup directly
 * GET /api/debug/order?order_number=ORD-001016
 *
 * This bypasses the AI and shows exactly what the tool returns.
 * Use this to verify if the order exists + what the AI sees.
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

    const { searchParams } = new URL(req.url);
    const orderNumber = searchParams.get("order_number") || searchParams.get("order_id");

    if (!orderNumber) {
      // No specific order — list ALL orders for this account
      const admin = getAdminClient();
      const { data: orders, error } = await admin
        .from("orders")
        .select("id, order_number, status, total, currency, created_at")
        .eq("account_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      return NextResponse.json({
        debug: true,
        message: "No order_number specified — showing all your recent orders",
        accountId: user.id,
        totalOrders: orders?.length || 0,
        orders: orders || [],
      });
    }

    const admin = getAdminClient();

    // Try exact match (uppercase)
    const { data: exactMatch, error: exactErr } = await admin
      .from("orders")
      .select("id, order_number, status, total, currency, payment_status, items, created_at, customers(name, phone)")
      .eq("account_id", user.id)
      .eq("order_number", orderNumber.toUpperCase().trim())
      .single();

    if (exactMatch) {
      return NextResponse.json({
        debug: true,
        found: true,
        matchType: "exact (uppercase)",
        query: orderNumber,
        order: exactMatch,
      });
    }

    // Try case-insensitive
    const { data: ilikeMatch, error: ilikeErr } = await admin
      .from("orders")
      .select("id, order_number, status, total, currency, payment_status, items, created_at, customers(name, phone)")
      .eq("account_id", user.id)
      .ilike("order_number", orderNumber.trim())
      .single();

    if (ilikeMatch) {
      return NextResponse.json({
        debug: true,
        found: true,
        matchType: "ilike (case-insensitive)",
        query: orderNumber,
        order: ilikeMatch,
      });
    }

    // Try partial match
    const { data: partialMatches } = await admin
      .from("orders")
      .select("id, order_number, status, total, currency, created_at")
      .eq("account_id", user.id)
      .ilike("order_number", `%${orderNumber.trim()}%`)
      .limit(5);

    // Get all orders for reference
    const { data: allOrders } = await admin
      .from("orders")
      .select("order_number, status, total")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      debug: true,
      found: false,
      query: orderNumber,
      message: `Order '${orderNumber}' not found`,
      partialMatches: partialMatches || [],
      yourRecentOrders: allOrders || [],
      accountId: user.id,
    });
  } catch (err) {
    console.error("[DEBUG-ORDER] error:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}
