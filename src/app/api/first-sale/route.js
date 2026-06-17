/**
 * First-sale check + celebration
 * GET /api/first-sale — returns { isFirstSale, celebrated }
 *
 * When the user's first paid order is detected, sets accounts.first_sale_at
 * and returns isFirstSale=true so the client shows confetti.
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

    const { data: account } = await admin
      .from("accounts")
      .select("id, first_sale_at, first_sale_celebrated")
      .eq("id", user.id)
      .single();

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // If we already celebrated, return early
    if (account.first_sale_celebrated) {
      return NextResponse.json({
        isFirstSale: false,
        celebrated: true,
        firstSaleAt: account.first_sale_at,
      });
    }

    // Check for any paid order
    const { data: paidOrders } = await admin
      .from("orders")
      .select("id, order_number, total, currency, created_at")
      .eq("account_id", user.id)
      .eq("payment_status", "paid")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!paidOrders || paidOrders.length === 0) {
      return NextResponse.json({ isFirstSale: false, celebrated: false });
    }

    const firstOrder = paidOrders[0];

    // Mark first_sale_at
    await admin
      .from("accounts")
      .update({
        first_sale_at: firstOrder.created_at,
        first_sale_celebrated: true,
      })
      .eq("id", user.id);

    return NextResponse.json({
      isFirstSale: true,
      celebrated: false, // client will set this after showing confetti
      firstSaleAt: firstOrder.created_at,
      order: firstOrder,
    });
  } catch (err) {
    console.error("[FIRST-SALE] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
