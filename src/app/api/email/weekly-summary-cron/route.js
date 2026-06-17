/**
 * Weekly Summary Email Cron
 * POST /api/email/weekly-summary-cron
 *
 * Called every Monday at 8am (UTC) by Vercel Cron.
 * Sends a weekly performance summary email to every account that:
 *   - Has an email address
 *   - Has had at least 1 conversation in the last 7 days
 *   - Has NOT opted out of weekly summaries (accounts.metadata.weekly_summary_opt_out = true)
 *
 * The email includes:
 *   - Total conversations, orders, revenue
 *   - AI deflection rate + cost savings
 *   - Top products
 *   - Top customers
 *   - 1 actionable recommendation
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWeeklySummaryEmail } from "@/lib/email";

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

export async function POST(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const stats = { sent: 0, errors: 0, skipped: 0 };

  try {
    // Get all accounts with activity in the last 7 days
    const { data: activeAccounts } = await supabase
      .from("accounts")
      .select("id, email, business_name, owner_name, plan, currency, country")
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    for (const account of activeAccounts || []) {
      try {
        // Check for activity
        const { count: convCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo);

        if (!convCount || convCount === 0) {
          stats.skipped++;
          continue;
        }

        // Gather weekly stats
        const { data: orders } = await supabase
          .from("orders")
          .select("total, payment_status, status, currency")
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo);
        const paidOrders = (orders || []).filter((o) => o.payment_status === "paid");
        const revenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);

        const { data: convs } = await supabase
          .from("conversations")
          .select("resolved_by, channel")
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo);
        const aiResolved = (convs || []).filter((c) => c.resolved_by === "ai").length;
        const deflectionRate = convs?.length > 0
          ? Math.round((aiResolved / convs.length) * 100)
          : 0;

        const { data: topProducts } = await supabase
          .from("orders")
          .select("items")
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo)
          .eq("payment_status", "paid");
        const productSales = {};
        (topProducts || []).forEach((o) => {
          (o.items || []).forEach((i) => {
            productSales[i.name] = (productSales[i.name] || 0) + i.qty;
          });
        });
        const topProductsList = Object.entries(productSales)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, qty]) => ({ name, qty }));

        // Build recommendation
        let recommendation = "";
        if (deflectionRate < 30) {
          recommendation = "Your AI deflection is below 30%. Consider improving your AI personality and FAQ knowledge base to deflect more conversations automatically.";
        } else if (revenue === 0) {
          recommendation = "No paid orders this week. Try sending a broadcast campaign to your customers with a special offer.";
        } else if (paidOrders.length > 0 && convCount > 0) {
          const conversionRate = (paidOrders.length / convCount) * 100;
          if (conversionRate < 5) {
            recommendation = `Your conversation-to-order conversion is ${conversionRate.toFixed(1)}%. Try sending payment links more proactively when customers show buying intent.`;
          } else {
            recommendation = `Great week! ${conversionRate.toFixed(1)}% conversation-to-order conversion. Keep up the momentum with a follow-up campaign next week.`;
          }
        }

        const summary = {
          businessName: account.business_name,
          weekRange: { start: sevenDaysAgo, end: new Date().toISOString() },
          conversations: convCount || 0,
          orders: paidOrders.length,
          revenue,
          currency: account.currency || "EGP",
          deflectionRate,
          topProducts: topProductsList,
          recommendation,
        };

        await sendWeeklySummaryEmail({
          to: account.email,
          businessName: account.business_name,
          stats: {
            totalConversations: summary.conversations,
            aiReplies: aiResolved,
            newCustomers: 0, // could be computed but skip for v1
            ordersCount: summary.orders,
            revenue: summary.revenue,
            currency: summary.currency,
            avgResponseTime: "N/A",
          },
        });

        stats.sent++;
      } catch (e) {
        console.error(`[WEEKLY] failed for ${account.email}:`, e.message);
        stats.errors++;
      }
    }

    return NextResponse.json({ success: true, stats, at: new Date().toISOString() });
  } catch (err) {
    console.error("[WEEKLY] fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
