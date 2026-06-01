import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

// Service role client (lazy-initialized for use in route handlers)
import { createClient } from "@supabase/supabase-js";
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
 * GET /api/admin/orders?search=&status=&account_id=&page=1&limit=20
 * All orders across all accounts with aggregated stats
 */
export async function GET(request) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const accountId = searchParams.get("account_id") || "";
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    // Build orders query with joins
    let query = supabase
      .from("orders")
      .select(
        `id, order_number, items, subtotal, shipping_cost, total, currency,
         status, channel, payment_method, payment_status, payment_link,
         shipping_address, tracking_number, notes, source, created_at, updated_at,
         account:accounts!orders_account_id_fkey(id, business_name, email, plan),
         customer:customers!orders_customer_id_fkey(id, name, phone, email)`
      )
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (accountId) query = query.eq("account_id", accountId);

    // Get total count
    let countQuery = supabase
      .from("orders")
      .select("id", { count: "exact", head: true });

    if (status) countQuery = countQuery.eq("status", status);
    if (accountId) countQuery = countQuery.eq("account_id", accountId);

    const { count: totalCount } = await countQuery;

    // Fetch paginated orders
    const { data: orders, error: ordersError } = await query.range(offset, offset + limit - 1);

    if (ordersError) {
      return NextResponse.json({ error: "Failed to fetch orders", details: ordersError.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      // Still return stats even if no paginated results
      const { data: allOrders } = await supabase
        .from("orders")
        .select("total, payment_status, status");

      const ao = allOrders || [];
      return NextResponse.json({
        success: true,
        data: {
          orders: [],
          pagination: { page, limit, total: totalCount || 0, totalPages: 0 },
          stats: buildStats(ao),
        },
      });
    }

    // Search filter (post-fetch for customer/business name)
    let filtered = orders;
    if (search) {
      const s = search.toLowerCase();
      filtered = orders.filter(
        (o) =>
          (o.order_number && o.order_number.toLowerCase().includes(s)) ||
          (o.customer?.name && o.customer.name.toLowerCase().includes(s)) ||
          (o.customer?.email && o.customer.email.toLowerCase().includes(s)) ||
          (o.customer?.phone && o.customer.phone.toLowerCase().includes(s)) ||
          (o.account?.business_name && o.account.business_name.toLowerCase().includes(s))
      );
    }

    // Fetch aggregated stats (all orders, not just this page)
    const { data: allOrders } = await supabase
      .from("orders")
      .select("total, payment_status, status");

    return NextResponse.json({
      success: true,
      data: {
        orders: filtered,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
        },
        stats: buildStats(allOrders || []),
      },
    });
  } catch (error) {
    console.error("Admin orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildStats(orders) {
  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  // Orders by status
  const ordersByStatus = {};
  orders.forEach((o) => {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
  });

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    totalOrders: orders.length,
    totalPaidOrders: paidOrders.length,
    ordersByStatus,
  };
}
