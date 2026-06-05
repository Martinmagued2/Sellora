import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
 * GET /api/abandoned-carts
 *
 * List abandoned carts for an account with optional filters.
 *
 * Query params:
 *   - account_id (required)
 *   - status: filter by status (abandoned, reminded, recovered, expired)
 *   - date_from: filter by abandoned_at >= date
 *   - date_to: filter by abandoned_at <= date
 *   - page: page number (default 1)
 *   - limit: items per page (default 50)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (!accountId) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("abandoned_carts")
      .select(`
        *,
        customer:customers(id, name, email, phone, channel, platform_id),
        conversation:conversations(id, channel, status)
      `, { count: "exact" })
      .eq("account_id", accountId)
      .order("abandoned_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (dateFrom) {
      query = query.gte("abandoned_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("abandoned_at", dateTo);
    }

    const { data: carts, error, count } = await query;

    if (error) {
      console.error("[ABANDONED-CARTS] Fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch abandoned carts" }, { status: 500 });
    }

    // Compute summary stats
    const { data: stats } = await supabase
      .from("abandoned_carts")
      .select("status, cart_value")
      .eq("account_id", accountId);

    const totalAbandonedValue = (stats || [])
      .filter(s => s.status === "abandoned" || s.status === "reminded")
      .reduce((sum, s) => sum + (parseFloat(s.cart_value) || 0), 0);

    const totalRecoveredValue = (stats || [])
      .filter(s => s.status === "recovered")
      .reduce((sum, s) => sum + (parseFloat(s.cart_value) || 0), 0);

    const activeCarts = (stats || []).filter(s => s.status === "abandoned" || s.status === "reminded").length;
    const recoveredCarts = (stats || []).filter(s => s.status === "recovered").length;
    const totalCarts = (stats || []).length;
    const recoveryRate = totalCarts > 0 ? Math.round((recoveredCarts / totalCarts) * 100) : 0;

    return NextResponse.json({
      carts: carts || [],
      total: count || 0,
      page,
      limit,
      stats: {
        totalAbandonedValue,
        totalRecoveredValue,
        activeCarts,
        recoveredCarts,
        totalCarts,
        recoveryRate,
      },
    });
  } catch (err) {
    console.error("[ABANDONED-CARTS] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
