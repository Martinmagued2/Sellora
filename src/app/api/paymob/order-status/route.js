import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

/**
 * GET /api/paymob/order-status?orderId=xxx
 *
 * Public endpoint to check order status (used by checkout page).
 * Only returns limited order info for security.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, items, total, currency, payment_status, payment_method")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });

  } catch (err) {
    console.error("[ORDER-STATUS] Error:", err);
    // 🔒 SECURITY: Don't leak internal error messages
    return NextResponse.json({ error: "Failed to retrieve order status" }, { status: 500 });
  }
}
