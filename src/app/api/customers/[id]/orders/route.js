/**
 * GET /api/customers/[id]/orders — list all orders for a customer.
 *
 * SECURITY: Uses getAuthUser + canAccessAccount. The customer must belong
 * to the user's effective account.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const db = admin();

    // Verify the customer belongs to the user's account
    const { data: customer } = await db
      .from("customers")
      .select("id, account_id, name")
      .eq("id", params.id)
      .eq("account_id", effectiveAccountId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Fetch orders for this customer
    const { data: orders, error } = await db
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        payment_status,
        total,
        currency,
        items,
        shipping_address,
        tracking_number,
        carrier,
        created_at,
        updated_at
      `)
      .eq("customer_id", params.id)
      .eq("account_id", effectiveAccountId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[CUSTOMER_ORDERS] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute summary stats
    const totalOrders = orders?.length || 0;
    const totalSpent = (orders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return NextResponse.json({
      orders: orders || [],
      summary: {
        total_orders: totalOrders,
        total_spent: totalSpent,
      },
    });
  } catch (e) {
    console.error("[CUSTOMER_ORDERS] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
