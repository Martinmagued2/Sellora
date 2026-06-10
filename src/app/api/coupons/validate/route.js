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
 * POST /api/coupons/validate - Validate a coupon code
 * Body: { code, order_total?, account_id? }
 *
 * If account_id is provided (for AI agent use), validate against that account.
 * Otherwise, use the authenticated user's account.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { code, order_total, account_id: bodyAccountId } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ valid: false, error: "Coupon code is required" }, { status: 400 });
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
      return NextResponse.json({ valid: false, error: "Account ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Look up coupon by code and account
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("account_id", accountId)
      .eq("code", code.trim().toUpperCase())
      .single();

    if (error || !coupon) {
      return NextResponse.json({
        valid: false,
        error: "Invalid coupon code",
        code: code.trim().toUpperCase(),
      });
    }

    // Validation checks
    const now = new Date();

    // 1. Check if active
    if (!coupon.is_active) {
      return NextResponse.json({
        valid: false,
        error: "This coupon is no longer active",
        coupon: { code: coupon.code, type: coupon.type },
      });
    }

    // 2. Check if not yet started
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return NextResponse.json({
        valid: false,
        error: "This coupon is not yet active",
        coupon: { code: coupon.code, type: coupon.type, starts_at: coupon.starts_at },
      });
    }

    // 3. Check if expired
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return NextResponse.json({
        valid: false,
        error: "This coupon has expired",
        coupon: { code: coupon.code, type: coupon.type, expires_at: coupon.expires_at },
      });
    }

    // 4. Check usage limit
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({
        valid: false,
        error: "This coupon has reached its usage limit",
        coupon: { code: coupon.code, type: coupon.type, max_uses: coupon.max_uses, used_count: coupon.used_count },
      });
    }

    // 5. Check minimum order value
    if (order_total !== undefined && order_total !== null && coupon.min_order_value > 0) {
      if (parseFloat(order_total) < parseFloat(coupon.min_order_value)) {
        return NextResponse.json({
          valid: false,
          error: `Minimum order value is ${coupon.min_order_value}. Your order total is ${order_total}.`,
          coupon: { code: coupon.code, type: coupon.type, min_order_value: coupon.min_order_value },
        });
      }
    }

    // 6. Enforce applies_to / product_ids / categories if items provided
    const { items } = body;
    if (items && Array.isArray(items) && coupon.applies_to !== "all") {
      const itemProductIds = items.map(i => i.product_id).filter(Boolean);
      const itemCategories = [...new Set(items.map(i => i.category).filter(Boolean))];

      if (coupon.applies_to === "specific_products" && coupon.product_ids?.length > 0) {
        const hasMatchingProduct = itemProductIds.some(pid => coupon.product_ids.includes(pid));
        if (!hasMatchingProduct) {
          return NextResponse.json({
            valid: false,
            error: "This coupon does not apply to any products in your order",
            coupon: { code: coupon.code, type: coupon.type, applies_to: coupon.applies_to },
          });
        }
      }

      if (coupon.applies_to === "specific_categories" && coupon.categories?.length > 0) {
        const hasMatchingCategory = itemCategories.some(cat => coupon.categories.includes(cat));
        if (!hasMatchingCategory) {
          return NextResponse.json({
            valid: false,
            error: "This coupon does not apply to any categories in your order",
            coupon: { code: coupon.code, type: coupon.type, applies_to: coupon.applies_to },
          });
        }
      }
    }

    // Coupon is valid! Calculate discount
    let discountAmount = 0;
    const orderTotal = order_total ? parseFloat(order_total) : 0;

    if (coupon.type === "percentage") {
      discountAmount = orderTotal * (coupon.value / 100);
    } else if (coupon.type === "fixed") {
      discountAmount = parseFloat(coupon.value);
    } else if (coupon.type === "free_shipping") {
      discountAmount = 0; // Free shipping discount depends on shipping cost, not calculated here
    }

    // Cap discount at order total for percentage/fixed
    if (coupon.type !== "free_shipping" && orderTotal > 0) {
      discountAmount = Math.min(discountAmount, orderTotal);
    }

    return NextResponse.json({
      valid: true,
      discount_amount: discountAmount,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        min_order_value: coupon.min_order_value,
        applies_to: coupon.applies_to,
        product_ids: coupon.product_ids,
        categories: coupon.categories,
      },
    });
  } catch (error) {
    console.error("Coupon validate error:", error);
    return NextResponse.json({ valid: false, error: "Internal server error" }, { status: 500 });
  }
}
