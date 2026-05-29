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
 * GET /api/analytics/sales?range=30d
 * Returns sales analytics with time-series data
 * Range options: 7d, 30d, 90d, all
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
    const range = searchParams.get("range") || "30d";

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        startDate = new Date("2020-01-01");
        break;
      case "30d":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Fetch all orders for the account
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("total, payment_status, created_at, status, channel, items, payment_method")
      .eq("account_id", user.id)
      .order("created_at", { ascending: true });

    if (ordersError) {
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Fetch previous period orders for comparison
    const periodDays = range === "all" ? 365 : parseInt(range);
    const prevPeriodStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const { data: prevOrders } = await supabase
      .from("orders")
      .select("total, payment_status, created_at")
      .eq("account_id", user.id)
      .gte("created_at", prevPeriodStart.toISOString())
      .lt("created_at", startDate.toISOString());

    const allOrders = orders || [];
    const previousOrders = prevOrders || [];

    // Filter orders within date range
    const filteredOrders = allOrders.filter(o => new Date(o.created_at) >= startDate);
    const paidOrders = filteredOrders.filter(o => o.payment_status === "paid");
    const prevPaidOrders = previousOrders.filter(o => o.payment_status === "paid");

    // ─── Daily Revenue (past N days) ───
    const dailyRevenue = [];
    const daysToShow = range === "all" ? Math.min(90, Math.ceil((now - startDate) / (24 * 60 * 60 * 1000))) : parseInt(range);
    for (let i = daysToShow - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split("T")[0];
      const dayOrders = paidOrders.filter(o => new Date(o.created_at).toISOString().split("T")[0] === dayStr);
      dailyRevenue.push({
        date: dayStr,
        revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        orders: dayOrders.length,
      });
    }

    // ─── Weekly Revenue Comparison ───
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekOrders = paidOrders.filter(o => new Date(o.created_at) >= thisWeekStart);
    const lastWeekOrders = prevPaidOrders.filter(o => {
      const d = new Date(o.created_at);
      return d >= lastWeekStart && d < thisWeekStart;
    });

    const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lastWeekRevenue = lastWeekOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const weeklyChange = lastWeekRevenue > 0 ? (((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100).toFixed(1) : thisWeekRevenue > 0 ? 100 : 0;

    // ─── Top Selling Products ───
    const productStats = {};
    paidOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const name = item.name || "Unknown";
        if (!productStats[name]) {
          productStats[name] = { name, quantity: 0, revenue: 0 };
        }
        productStats[name].quantity += (item.qty || 1);
        productStats[name].revenue += (item.price || 0) * (item.qty || 1);
      });
    });
    const topProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ─── Revenue by Channel ───
    const channelRevenue = { instagram: 0, facebook: 0, whatsapp: 0 };
    paidOrders.forEach(o => {
      const ch = o.channel || "whatsapp";
      if (channelRevenue[ch] !== undefined) {
        channelRevenue[ch] += (o.total || 0);
      }
    });

    // ─── Revenue by Payment Method ───
    const paymentMethodRevenue = {};
    paidOrders.forEach(o => {
      const method = o.payment_method || "cod";
      paymentMethodRevenue[method] = (paymentMethodRevenue[method] || 0) + (o.total || 0);
    });

    // ─── Total revenue & trend ───
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const previousRevenue = prevPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const revenueTrend = previousRevenue > 0
      ? (((totalRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)
      : totalRevenue > 0 ? 100 : 0;

    // ─── Orders trend ───
    const ordersTrend = prevPaidOrders.length > 0
      ? (((paidOrders.length - prevPaidOrders.length) / prevPaidOrders.length) * 100).toFixed(1)
      : paidOrders.length > 0 ? 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        revenueTrend: parseFloat(revenueTrend),
        totalPaidOrders: paidOrders.length,
        ordersTrend: parseFloat(ordersTrend),
        dailyRevenue,
        weeklyComparison: {
          thisWeek: thisWeekRevenue,
          lastWeek: lastWeekRevenue,
          change: parseFloat(weeklyChange),
        },
        topProducts,
        channelRevenue,
        paymentMethodRevenue,
        avgOrderValue: paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0,
      },
    });
  } catch (error) {
    console.error("Sales analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
