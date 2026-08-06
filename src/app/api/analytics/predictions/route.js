/**
 * GET /api/analytics/predictions
 *
 * Predictive analytics: churn prediction, reorder prediction, revenue forecast.
 *
 * Returns:
 *   {
 *     churn_predictions: [{ customer_id, name, churn_probability, reason, last_order_date }],
 *     reorder_predictions: [{ customer_id, name, product_name, predicted_reorder_date, confidence }],
 *     revenue_forecast: { next_7_days, next_30_days, trend, method },
 *     generated_at: "..."
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();
    const now = new Date();

    // ─── 1. Churn Prediction (RFM-based) ───
    // Fetch customers with order history
    const { data: customers } = await db
      .from("customers")
      .select("id, name, total_orders, total_spent, last_active_at, created_at")
      .eq("account_id", effectiveAccountId)
      .gte("total_orders", 1)
      .order("total_spent", { ascending: false })
      .limit(100);

    const churnPredictions = (customers || []).map(c => {
      const daysSinceActive = c.last_active_at
        ? Math.floor((now - new Date(c.last_active_at)) / (1000 * 60 * 60 * 24))
        : 999;

      // RFM scoring (simplified)
      // Recency: 0-7d=5, 8-14d=4, 15-30d=3, 31-60d=2, 61-90d=1, >90d=0
      const recencyScore = daysSinceActive <= 7 ? 5 : daysSinceActive <= 14 ? 4 : daysSinceActive <= 30 ? 3 : daysSinceActive <= 60 ? 2 : daysSinceActive <= 90 ? 1 : 0;
      // Frequency: 1=1, 2-3=2, 4-6=3, 7-10=4, 10+=5
      const freqScore = c.total_orders >= 10 ? 5 : c.total_orders >= 7 ? 4 : c.total_orders >= 4 ? 3 : c.total_orders >= 2 ? 2 : 1;
      // Monetary: based on total_spent quartiles (simplified)
      const monetaryScore = c.total_spent >= 500 ? 5 : c.total_spent >= 200 ? 4 : c.total_spent >= 100 ? 3 : c.total_spent >= 50 ? 2 : 1;

      // Churn probability: weighted formula
      // Higher recency score = lower churn risk
      // Lower frequency = higher churn risk
      const churnProbability = Math.round(
        Math.max(0, Math.min(100,
          100 - (recencyScore * 15) - (freqScore * 5) - (monetaryScore * 3)
        ))
      );

      let reason = "";
      if (daysSinceActive > 90) reason = `No activity in ${daysSinceActive} days`;
      else if (daysSinceActive > 60) reason = `Inactive for ${daysSinceActive} days — usually reorders within 30 days`;
      else if (freqScore === 1 && daysSinceActive > 14) reason = "One-time buyer showing no repeat interest";
      else if (churnProbability > 50) reason = "Declining engagement pattern";
      else reason = "Healthy engagement";

      return {
        customer_id: c.id,
        name: c.name,
        churn_probability: churnProbability,
        risk_level: churnProbability >= 70 ? "high" : churnProbability >= 40 ? "medium" : "low",
        reason,
        last_active: c.last_active_at,
        total_orders: c.total_orders,
        total_spent: c.total_spent,
      };
    }).filter(c => c.churn_probability >= 40) // Only show at-risk customers
      .sort((a, b) => b.churn_probability - a.churn_probability)
      .slice(0, 10);

    // ─── 2. Reorder Prediction ───
    // Based on average inter-order interval per customer
    const { data: orders } = await db
      .from("orders")
      .select("id, customer_id, created_at, items, customer:customers(name)")
      .eq("account_id", effectiveAccountId)
      .order("created_at", { ascending: true })
      .limit(500);

    // Group orders by customer
    const customerOrders = {};
    for (const o of (orders || [])) {
      if (!o.customer_id) continue;
      if (!customerOrders[o.customer_id]) customerOrders[o.customer_id] = [];
      customerOrders[o.customer_id].push(o);
    }

    const reorderPredictions = [];
    for (const [custId, custOrders] of Object.entries(customerOrders)) {
      if (custOrders.length < 2) continue; // Need at least 2 orders to predict

      // Calculate average interval between orders
      const intervals = [];
      for (let i = 1; i < custOrders.length; i++) {
        const diff = new Date(custOrders[i].created_at) - new Date(custOrders[i-1].created_at);
        intervals.push(diff / (1000 * 60 * 60 * 24)); // days
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const lastOrderDate = new Date(custOrders[custOrders.length - 1].created_at);
      const predictedReorder = new Date(lastOrderDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
      const daysUntilReorder = Math.round((predictedReorder - now) / (1000 * 60 * 60 * 24));

      // Only show predictions within the next 30 days
      if (daysUntilReorder > 0 && daysUntilReorder <= 30) {
        // Get most ordered product
        const productCounts = {};
        custOrders.forEach(o => {
          (o.items || []).forEach(item => {
            const name = item.name || "Unknown";
            productCounts[name] = (productCounts[name] || 0) + 1;
          });
        });
        const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

        reorderPredictions.push({
          customer_id: custId,
          name: custOrders[0].customer?.name || "Unknown",
          product_name: topProduct?.[0] || "Various",
          predicted_reorder_date: predictedReorder.toISOString(),
          days_until_reorder: daysUntilReorder,
          avg_interval_days: Math.round(avgInterval),
          confidence: custOrders.length >= 4 ? "high" : custOrders.length >= 3 ? "medium" : "low",
          total_orders: custOrders.length,
        });
      }
    }
    reorderPredictions.sort((a, b) => a.days_until_reorder - b.days_until_reorder);

    // ─── 3. Revenue Forecast (30-day moving average + linear regression) ───
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [recentOrdersRes, prevOrdersRes] = await Promise.all([
      db.from("orders").select("total, created_at").eq("account_id", effectiveAccountId).gte("created_at", thirtyDaysAgo.toISOString()),
      db.from("orders").select("total, created_at").eq("account_id", effectiveAccountId).gte("created_at", sixtyDaysAgo.toISOString()).lt("created_at", thirtyDaysAgo.toISOString()),
    ]);

    const recentRevenue = (recentOrdersRes.data || []).filter(o => o.payment_status !== "cancelled").reduce((s, o) => s + (Number(o.total) || 0), 0);
    const prevRevenue = (prevOrdersRes.data || []).filter(o => o.payment_status !== "cancelled").reduce((s, o) => s + (Number(o.total) || 0), 0);

    // Simple trend: if revenue increased X% last 30 days vs previous 30 days,
    // project the same trend forward
    const trendPct = prevRevenue > 0
      ? Math.round(((recentRevenue - prevRevenue) / prevRevenue) * 100)
      : recentRevenue > 0 ? 100 : 0;

    // Forecast: apply trend to recent revenue
    const next30Forecast = Math.round(recentRevenue * (1 + trendPct / 100));
    const next7Forecast = Math.round(next30Forecast / 30 * 7);

    return NextResponse.json({
      churn_predictions: churnPredictions,
      reorder_predictions: reorderPredictions.slice(0, 10),
      revenue_forecast: {
        next_7_days: next7Forecast,
        next_30_days: next30Forecast,
        last_30_days: recentRevenue,
        previous_30_days: prevRevenue,
        trend_pct: trendPct,
        method: "30-day moving average with trend projection",
      },
      generated_at: now.toISOString(),
    });
  } catch (e) {
    console.error("[PREDICTIONS] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}
