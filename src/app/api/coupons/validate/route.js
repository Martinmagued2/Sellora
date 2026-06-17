import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isRateLimited } from "@/lib/rate-limit";

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
    // Rate limiting: 20 validations per minute per IP
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(`coupon-validate:${ip}`, 20, 60000)) {
      return NextResponse.json({ valid: false, error: "Too many requests." }, { status: 429 });
    }

    const body = await req.json();
    const { code, order_total, account_id: bodyAccountId } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ valid: false, error: "Coupon code is required" }, { status: 400 });
    }

    // Sanitize coupon code: max 50 chars, alphanumeric + dash/underscore only
    const sanitizedCode = code.trim().substring(0, 50).toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(sanitizedCode)) {
      return NextResponse.json({ valid: false, error: "Invalid coupon code format" }, { status: 400 });
    }

    let accountId = null;
    let authedUserId = null;

    // 🔒 SECURITY: Always authenticate first, then optionally allow account_id override
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
        authedUserId = user.id;
      }
    } catch (e) {
      // No auth cookies
    }

    // Allow account_id override ONLY if it matches the authenticated user
    if (bodyAccountId && authedUserId) {
      accountId = bodyAccountId === authedUserId ? bodyAccountId : authedUserId;
    }

    if (!accountId) {
      return NextResponse.json({ valid: false, error: "Authentication required" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Look up coupon by code and account
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("account_id", accountId)
      .eq("code", sanitizedCode)
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

    // ─── Smart coupon subtypes (C7) ───
    // Subtype 'first_order' — only valid if the customer has 0 past orders
    if (coupon.subtype === "first_order" && body.customer_id) {
      const { count: pastOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("customer_id", body.customer_id)
        .neq("status", "cancelled");
      if (pastOrders > 0) {
        return NextResponse.json({
          valid: false,
          error: "This coupon is only valid on your first order",
          coupon: { code: coupon.code, type: coupon.type, subtype: coupon.subtype },
        });
      }
    }

    // Subtype 'customer_specific' — only valid for the target customer
    if (coupon.subtype === "customer_specific" && coupon.target_customer_id) {
      if (body.customer_id !== coupon.target_customer_id) {
        return NextResponse.json({
          valid: false,
          error: "This coupon is not available for your account",
          coupon: { code: coupon.code, type: coupon.type, subtype: coupon.subtype },
        });
      }
    }

    // Subtype 'tiered' — pick the matching tier based on order total
    if (coupon.subtype === "tiered" && coupon.tiered_rules) {
      try {
        const rules = Array.isArray(coupon.tiered_rules)
          ? coupon.tiered_rules
          : JSON.parse(coupon.tiered_rules);
        // Find the highest tier the order qualifies for
        const sortedRules = [...rules].sort((a, b) => (b.min || 0) - (a.min || 0));
        const applicable = sortedRules.find((r) => orderTotal >= (r.min || 0));
        if (!applicable) {
          return NextResponse.json({
            valid: false,
            error: `Minimum order for this coupon is ${rules.sort((a,b) => (a.min||0) - (b.min||0))[0].min}`,
            coupon: { code: coupon.code, type: coupon.type, subtype: coupon.subtype },
          });
        }
        discountAmount = orderTotal * (applicable.percent / 100);
      } catch (e) {
        console.warn("[COUPON] tiered rule parse failed:", e.message);
      }
    } else if (coupon.subtype === "bogo" && body.items && Array.isArray(body.items)) {
      // Subtype 'bogo' — buy X get Y at discount
      // Simplified: applies the discount to the cheapest items in the cart
      const buyQty = coupon.bogo_buy_qty || 1;
      const getQty = coupon.bogo_get_qty || 1;
      const discountPct = coupon.bogo_get_discount_percent || 100;
      const totalQty = body.items.reduce((s, i) => s + (i.qty || 1), 0);
      if (totalQty >= buyQty + getQty) {
        // Find the cheapest items to discount (the "get" items)
        const sortedItems = [...body.items].sort((a, b) => (a.price || 0) - (b.price || 0));
        const cheapestPrice = sortedItems[0]?.price || 0;
        discountAmount = cheapestPrice * getQty * (discountPct / 100);
      }
    } else if (coupon.type === "percentage") {
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
        subtype: coupon.subtype || "standard",
        value: coupon.value,
        min_order_value: coupon.min_order_value,
        applies_to: coupon.applies_to,
        product_ids: coupon.product_ids,
        categories: coupon.categories,
        // Smart coupon metadata
        bogo: coupon.subtype === "bogo" ? {
          buy_qty: coupon.bogo_buy_qty,
          get_qty: coupon.bogo_get_qty,
          discount_percent: coupon.bogo_get_discount_percent,
        } : undefined,
        tiered_rules: coupon.subtype === "tiered" ? coupon.tiered_rules : undefined,
      },
    });
  } catch (error) {
    console.error("Coupon validate error:", error);
    return NextResponse.json({ valid: false, error: "Internal server error" }, { status: 500 });
  }
}
