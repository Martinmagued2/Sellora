import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Service role client (lazy-initialized)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * POST /api/coupons/redeem - Redeem (use) a coupon code
 *
 * This atomically increments used_count and optionally records the redemption
 * on an order. This is what makes max_uses actually work.
 *
 * Body: {
 *   code: string (required),
 *   order_id?: string (optional - links the coupon to the order),
 *   order_total?: number (optional - for calculating discount),
 *   account_id?: string (optional - for AI agent use),
 *   customer_id?: string (optional - for per-customer tracking),
 * }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { code, order_id, order_total, account_id: bodyAccountId, customer_id } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }

    let accountId = bodyAccountId;

    // If no account_id provided, try to get from auth
    if (!accountId) {
      try {
        const cookieStore = await cookies();
        const supabaseAuth = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
            },
          }
        );

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (!authError && user) {
          accountId = user.id;
        }
      } catch (e) {
        // No auth cookies - may be called from AI agent
      }
    }

    if (!accountId) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // ─── Step 1: Look up the coupon ───
    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select("*")
      .eq("account_id", accountId)
      .eq("code", code.trim().toUpperCase())
      .single();

    if (couponError || !coupon) {
      return NextResponse.json({ redeemed: false, error: "Invalid coupon code" }, { status: 404 });
    }

    // ─── Step 2: Run all validation checks (same as validate endpoint) ───
    const now = new Date();

    if (!coupon.is_active) {
      return NextResponse.json({ redeemed: false, error: "This coupon is no longer active" });
    }

    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return NextResponse.json({ redeemed: false, error: "This coupon is not yet active" });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return NextResponse.json({ redeemed: false, error: "This coupon has expired" });
    }

    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ redeemed: false, error: "This coupon has reached its usage limit" });
    }

    if (order_total !== undefined && order_total !== null && coupon.min_order_value > 0) {
      if (parseFloat(order_total) < parseFloat(coupon.min_order_value)) {
        return NextResponse.json({
          redeemed: false,
          error: `Minimum order value is ${coupon.min_order_value}. Your order total is ${order_total}.`,
        });
      }
    }

    // ─── Step 3: Enforce applies_to / product_ids / categories if order_id provided ───
    if (order_id && coupon.applies_to !== "all") {
      const { data: order } = await supabase
        .from("orders")
        .select("items")
        .eq("id", order_id)
        .single();

      if (order && Array.isArray(order.items)) {
        const orderProductIds = order.items.map(i => i.product_id).filter(Boolean);
        const orderCategories = [...new Set(order.items.map(i => i.category).filter(Boolean))];

        if (coupon.applies_to === "specific_products" && coupon.product_ids?.length > 0) {
          const hasMatchingProduct = orderProductIds.some(pid =>
            coupon.product_ids.includes(pid)
          );
          if (!hasMatchingProduct) {
            return NextResponse.json({
              redeemed: false,
              error: "This coupon does not apply to any products in your order",
            });
          }
        }

        if (coupon.applies_to === "specific_categories" && coupon.categories?.length > 0) {
          const hasMatchingCategory = orderCategories.some(cat =>
            coupon.categories.includes(cat)
          );
          if (!hasMatchingCategory) {
            return NextResponse.json({
              redeemed: false,
              error: "This coupon does not apply to any categories in your order",
            });
          }
        }
      }
    }

    // ─── Step 4: Calculate discount ───
    let discountAmount = 0;
    const orderTotal = order_total ? parseFloat(order_total) : 0;

    if (coupon.type === "percentage") {
      discountAmount = orderTotal * (coupon.value / 100);
    } else if (coupon.type === "fixed") {
      discountAmount = parseFloat(coupon.value);
    } else if (coupon.type === "free_shipping") {
      discountAmount = 0; // Free shipping discount calculated at checkout
    }

    // Cap discount at order total
    if (coupon.type !== "free_shipping" && orderTotal > 0) {
      discountAmount = Math.min(discountAmount, orderTotal);
    }

    // ─── Step 5: Atomically increment used_count using RPC or raw SQL ───
    // Use atomic update with a condition to prevent race conditions
    const { data: updatedCoupon, error: updateError } = await supabase
      .from("coupons")
      .update({ used_count: coupon.used_count + 1 })
      .eq("id", coupon.id)
      // Double-check max_uses hasn't been exceeded (race condition guard)
      .or(`max_uses.is.null,used_count.lt.${coupon.max_uses ?? Infinity}`)
      .select()
      .single();

    if (updateError || !updatedCoupon) {
      return NextResponse.json({
        redeemed: false,
        error: "Failed to redeem coupon — it may have just reached its usage limit",
      });
    }

    // ─── Step 6: Update the order with coupon info if order_id provided ───
    if (order_id) {
      await supabase
        .from("orders")
        .update({
          coupon_id: coupon.id,
          coupon_code: coupon.code,
          discount_amount: discountAmount,
          subtotal: orderTotal > 0 ? orderTotal + discountAmount : null,
          total: orderTotal > 0 ? Math.max(0, orderTotal - discountAmount) : null,
        })
        .eq("id", order_id);
    }

    // ─── Step 7: Return success ───
    return NextResponse.json({
      redeemed: true,
      discount_amount: discountAmount,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        used_count: updatedCoupon.used_count,
        max_uses: coupon.max_uses,
      },
    });
  } catch (error) {
    console.error("Coupon redeem error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
