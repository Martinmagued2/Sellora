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
 * GET /api/coupons - List coupons for the authenticated user's account
 * Query params: status (active|expired|all), type (percentage|fixed|free_shipping)
 */
export async function GET(req) {
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
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    let query = supabase
      .from("coupons")
      .select("*")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    if (status === "active") {
      query = query.eq("is_active", true);
    } else if (status === "expired") {
      query = query.lt("expires_at", new Date().toISOString());
    } else if (status === "exhausted") {
      query = query.not("max_uses", "is", null);
      // Exhausted = used_count >= max_uses — we'll filter this in JS
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch coupons: " + error.message }, { status: 500 });
    }

    let coupons = data || [];

    // Filter exhausted coupons in JS (Supabase can't compare columns directly in a query)
    if (status === "exhausted") {
      coupons = coupons.filter((c) => c.max_uses !== null && c.used_count >= c.max_uses);
    }

    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error("Coupons GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/coupons - Create a new coupon
 * Body: { code, type, value, min_order_value?, max_uses?, starts_at?, expires_at?, applies_to?, product_ids?, categories?, is_active? }
 */
export async function POST(req) {
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
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      code,
      type,
      value,
      min_order_value,
      max_uses,
      starts_at,
      expires_at,
      applies_to,
      product_ids,
      categories,
      is_active,
    } = body;

    // Validation
    if (!code || !code.trim()) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }
    if (!type || !["percentage", "fixed", "free_shipping"].includes(type)) {
      return NextResponse.json({ error: "Type must be 'percentage', 'fixed', or 'free_shipping'" }, { status: 400 });
    }
    if (value === undefined || value === null || value < 0) {
      return NextResponse.json({ error: "Value is required and must be non-negative" }, { status: 400 });
    }
    if (type === "percentage" && (value > 100 || value < 0)) {
      return NextResponse.json({ error: "Percentage value must be between 0 and 100" }, { status: 400 });
    }

    // Check plan limits
    const { data: account } = await getSupabase()
      .from("accounts")
      .select("plan")
      .eq("id", user.id)
      .single();

    const { getPlanLimits, isLimitExceeded } = await import("@/lib/plan-limits");
    const limits = getPlanLimits(account?.plan || "starter");
    const couponLimit = limits.coupons !== undefined ? limits.coupons : 3;

    if (couponLimit !== -1) {
      const { count } = await getSupabase()
        .from("coupons")
        .select("*", { count: "exact", head: true })
        .eq("account_id", user.id);

      if (isLimitExceeded(count || 0, couponLimit)) {
        return NextResponse.json({
          error: `Coupon limit reached. Your ${account?.plan || "starter"} plan allows ${couponLimit} coupons. Please upgrade to add more.`,
          limit: couponLimit,
          current: count,
        }, { status: 403 });
      }
    }

    // Check unique code per account
    const { data: existing } = await getSupabase()
      .from("coupons")
      .select("id")
      .eq("account_id", user.id)
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "A coupon with this code already exists for your account" }, { status: 409 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        account_id: user.id,
        code: code.trim().toUpperCase(),
        type,
        value: parseFloat(value),
        min_order_value: min_order_value ? parseFloat(min_order_value) : 0,
        max_uses: max_uses ? parseInt(max_uses) : null,
        starts_at: starts_at || new Date().toISOString(),
        expires_at: expires_at || null,
        applies_to: applies_to || "all",
        product_ids: product_ids || [],
        categories: categories || [],
        is_active: is_active !== undefined ? is_active : true,
        used_count: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create coupon: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, coupon: data });
  } catch (error) {
    console.error("Coupons POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
