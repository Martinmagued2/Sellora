/** GET /api/coupons/auto-apply — find the best coupon for a given cart total */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const cartTotal = parseFloat(searchParams.get("total") || "0");
    const admin = getAdminClient();

    // Find all active auto_apply coupons
    const { data: coupons } = await admin.from("coupons")
      .select("*")
      .eq("account_id", user.id)
      .eq("is_active", true)
      .eq("auto_apply", true);

    if (!coupons || coupons.length === 0) return NextResponse.json({ coupon: null });

    // Find the best coupon (highest discount for this cart)
    let bestCoupon = null;
    let bestDiscount = 0;

    for (const c of coupons) {
      let discount = 0;
      if (c.type === "percentage") discount = cartTotal * (c.value / 100);
      else if (c.type === "fixed") discount = parseFloat(c.value);
      else if (c.type === "free_shipping") discount = 50; // assume 50 EGP shipping

      // Check min_order_value
      if (c.min_order_value && cartTotal < parseFloat(c.min_order_value)) continue;

      if (discount > bestDiscount) { bestDiscount = discount; bestCoupon = c; }
    }

    return NextResponse.json({
      coupon: bestCoupon,
      discount_amount: Math.round(bestDiscount * 100) / 100,
      final_total: Math.round((cartTotal - bestDiscount) * 100) / 100,
    });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
