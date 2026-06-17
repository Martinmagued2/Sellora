/**
 * Per-Channel Revenue Analytics
 * GET /api/analytics/channel-revenue?range=30d
 *
 * Returns revenue + order count + conversion rate broken down by acquisition channel.
 * Joins orders with the conversation that produced them via customer_id + channel.
 *
 * Output:
 *   byChannel: [{ channel, revenue, orders, customers, avgOrderValue, conversionRate }]
 *   trend: [{ day, channel, revenue }]
 *   totals: { totalRevenue, totalOrders, totalCustomers }
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

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const rangeKey = searchParams.get("range") || "30d";
    const days = RANGE_DAYS[rangeKey] || 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const admin = getAdminClient();

    // Fetch orders in range
    const { data: orders } = await admin
      .from("orders")
      .select("id, customer_id, channel, total, payment_status, currency, created_at, status")
      .eq("account_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    // Fetch customers to map customer_id → acquisition channel
    const customerIds = [...new Set((orders || []).map((o) => o.customer_id).filter(Boolean))];
    let customerChannels = {};
    if (customerIds.length > 0) {
      // Process in batches
      for (let i = 0; i < customerIds.length; i += 200) {
        const batch = customerIds.slice(i, i + 200);
        const { data: customers } = await admin
          .from("customers")
          .select("id, channel")
          .in("id", batch);
        (customers || []).forEach((c) => { customerChannels[c.id] = c.channel || "manual"; });
      }
    }

    // Count conversations per channel (for conversion rate)
    const { data: convs } = await admin
      .from("conversations")
      .select("id, channel, customer_id")
      .eq("account_id", user.id)
      .gte("created_at", since);
    const convsByChannel = {};
    (convs || []).forEach((c) => {
      const ch = c.channel || "unknown";
      convsByChannel[ch] = (convsByChannel[ch] || 0) + 1;
    });

    // Build per-channel aggregates
    // Use the order's channel (where the order was placed) for attribution
    const channelAgg = {};
    const paidOrders = (orders || []).filter((o) => o.payment_status === "paid" && o.status !== "cancelled");

    for (const o of paidOrders) {
      const ch = o.channel || customerChannels[o.customer_id] || "manual";
      channelAgg[ch] = channelAgg[ch] || { revenue: 0, orders: 0, customers: new Set() };
      channelAgg[ch].revenue += Number(o.total);
      channelAgg[ch].orders++;
      if (o.customer_id) channelAgg[ch].customers.add(o.customer_id);
    }

    const byChannel = Object.entries(channelAgg).map(([channel, v]) => ({
      channel,
      revenue: Math.round(v.revenue * 100) / 100,
      orders: v.orders,
      customers: v.customers.size,
      avgOrderValue: v.orders > 0 ? Math.round((v.revenue / v.orders) * 100) / 100 : 0,
      conversations: convsByChannel[channel] || 0,
      conversionRate: (convsByChannel[channel] || 0) > 0
        ? Math.round((v.orders / convsByChannel[channel]) * 1000) / 10
        : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // Daily trend by channel
    const trendMap = {};
    paidOrders.forEach((o) => {
      const day = o.created_at.slice(0, 10);
      const ch = o.channel || "manual";
      const key = `${day}|${ch}`;
      trendMap[key] = (trendMap[key] || 0) + Number(o.total);
    });
    const trend = Object.entries(trendMap)
      .map(([key, revenue]) => {
        const [day, channel] = key.split("|");
        return { day, channel, revenue: Math.round(revenue * 100) / 100 };
      })
      .sort((a, b) => a.day.localeCompare(b.day));

    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalOrders = paidOrders.length;
    const totalCustomers = new Set(paidOrders.map((o) => o.customer_id).filter(Boolean)).size;

    return NextResponse.json({
      range: rangeKey,
      byChannel,
      trend,
      totals: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        totalCustomers,
      },
    });
  } catch (err) {
    console.error("[CHANNEL-REVENUE] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
