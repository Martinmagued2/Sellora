/**
 * Cohort Retention Analytics
 * GET /api/cohort?months=12
 *
 * Returns customer acquisition cohorts and their repurchase rates
 * at 1, 2, 3, 6, and 12 months.
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

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const monthsBack = parseInt(searchParams.get("months") || "12", 10);
    const since = new Date(Date.now() - monthsBack * 30 * 86400_000).toISOString();

    const admin = getAdminClient();

    // 1. Find each customer's first order (their cohort month)
    const { data: orders } = await admin
      .from("orders")
      .select("id, customer_id, created_at, status, total")
      .eq("account_id", user.id)
      .neq("status", "cancelled")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (!orders || orders.length === 0) {
      return NextResponse.json({ cohorts: [], summary: { totalCustomers: 0, avgRetention30d: 0, avgRetention90d: 0 } });
    }

    // Group: cohort_month → customers + their orders
    const customerFirstOrder = {}; // customer_id → first order date
    orders.forEach((o) => {
      if (!customerFirstOrder[o.customer_id]) {
        customerFirstOrder[o.customer_id] = new Date(o.created_at);
      } else if (new Date(o.created_at) < customerFirstOrder[o.customer_id]) {
        customerFirstOrder[o.customer_id] = new Date(o.created_at);
      }
    });

    const cohorts = {}; // month → { size, customers: [ids], retention: { 1: 0, 2: 0, ... } }
    Object.entries(customerFirstOrder).forEach(([customerId, firstDate]) => {
      const cohortMonth = firstDate.toISOString().slice(0, 7); // YYYY-MM
      if (!cohorts[cohortMonth]) {
        cohorts[cohortMonth] = { size: 0, customers: [], retention: {} };
      }
      cohorts[cohortMonth].size++;
      cohorts[cohortMonth].customers.push(customerId);
    });

    // For each cohort, count how many customers placed another order in month 1, 2, 3, 6, 12
    Object.entries(cohorts).forEach(([cohortMonth, cohort]) => {
      const cohortDate = new Date(`${cohortMonth}-01`);
      const cohortCustomerOrders = orders.filter((o) => cohort.customers.includes(o.customer_id));

      [1, 2, 3, 6, 12].forEach((monthOffset) => {
        const monthStart = new Date(cohortDate);
        monthStart.setMonth(monthStart.getMonth() + monthOffset);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const repeatCustomers = new Set(
          cohortCustomerOrders
            .filter((o) => {
              const d = new Date(o.created_at);
              return d >= monthStart && d < monthEnd && d > cohortDate;
            })
            .map((o) => o.customer_id)
        );
        cohort.retention[monthOffset] = repeatCustomers.size;
      });
    });

    // Build response
    const cohortsArray = Object.entries(cohorts)
      .map(([month, c]) => ({
        month,
        size: c.size,
        retention: {
          m1: c.retention[1] || 0,
          m1_pct: c.size > 0 ? Math.round(((c.retention[1] || 0) / c.size) * 1000) / 10 : 0,
          m2: c.retention[2] || 0,
          m2_pct: c.size > 0 ? Math.round(((c.retention[2] || 0) / c.size) * 1000) / 10 : 0,
          m3: c.retention[3] || 0,
          m3_pct: c.size > 0 ? Math.round(((c.retention[3] || 0) / c.size) * 1000) / 10 : 0,
          m6: c.retention[6] || 0,
          m6_pct: c.size > 0 ? Math.round(((c.retention[6] || 0) / c.size) * 1000) / 10 : 0,
          m12: c.retention[12] || 0,
          m12_pct: c.size > 0 ? Math.round(((c.retention[12] || 0) / c.size) * 1000) / 10 : 0,
        },
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const totalCustomers = cohortsArray.reduce((s, c) => s + c.size, 0);
    const avgM1 = cohortsArray.length > 0
      ? cohortsArray.reduce((s, c) => s + c.retention.m1_pct, 0) / cohortsArray.length
      : 0;
    const avgM3 = cohortsArray.length > 0
      ? cohortsArray.reduce((s, c) => s + c.retention.m3_pct, 0) / cohortsArray.length
      : 0;

    return NextResponse.json({
      cohorts: cohortsArray,
      summary: {
        totalCustomers,
        avgRetention30d: Math.round(avgM1 * 10) / 10,
        avgRetention90d: Math.round(avgM3 * 10) / 10,
      },
    });
  } catch (err) {
    console.error("[COHORT] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
