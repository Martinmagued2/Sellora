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
 * GET /api/coupons/[id] - Get a single coupon
 */
export async function GET(req, { params }) {
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

    const { id } = await params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, coupon: data });
  } catch (error) {
    console.error("Coupon GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/coupons/[id] - Update a coupon
 */
export async function PATCH(req, { params }) {
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

    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabase();

    // Validate value bounds if updating type or value
    if (body.type === "percentage" && body.value !== undefined && (body.value > 100 || body.value < 0)) {
      return NextResponse.json({ error: "Percentage value must be between 0 and 100" }, { status: 400 });
    }

    // If code is being changed, check for uniqueness
    if (body.code) {
      const { data: existing } = await supabase
        .from("coupons")
        .select("id")
        .eq("account_id", user.id)
        .eq("code", body.code.trim().toUpperCase())
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: "A coupon with this code already exists for your account" }, { status: 409 });
      }
    }

    const updates = {};
    if (body.code !== undefined) updates.code = body.code.trim().toUpperCase();
    if (body.type !== undefined) updates.type = body.type;
    if (body.value !== undefined) updates.value = parseFloat(body.value);
    if (body.min_order_value !== undefined) updates.min_order_value = parseFloat(body.min_order_value);
    if (body.max_uses !== undefined) updates.max_uses = body.max_uses ? parseInt(body.max_uses) : null;
    if (body.starts_at !== undefined) updates.starts_at = body.starts_at;
    if (body.expires_at !== undefined) updates.expires_at = body.expires_at || null;
    if (body.applies_to !== undefined) updates.applies_to = body.applies_to;
    if (body.product_ids !== undefined) updates.product_ids = body.product_ids;
    if (body.categories !== undefined) updates.categories = body.categories;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { data, error } = await supabase
      .from("coupons")
      .update(updates)
      .eq("id", id)
      .eq("account_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update coupon: " + error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, coupon: data });
  } catch (error) {
    console.error("Coupon PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/coupons/[id] - Delete (deactivate) a coupon
 */
export async function DELETE(req, { params }) {
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

    const { id } = await params;
    const supabase = getSupabase();

    // Hard delete the coupon
    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id)
      .eq("account_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Coupon DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
