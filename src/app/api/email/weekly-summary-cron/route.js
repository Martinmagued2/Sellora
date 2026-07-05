/**
 * Weekly Summary Email Cron
 * POST /api/email/weekly-summary-cron
 *
 * Called every Monday at 8am (UTC) by cron-job.org.
 * Sends a COMPREHENSIVE weekly performance summary to every account that:
 *   - Has an email address
 *   - Has had at least 1 conversation in the last 7 days
 *   - Has NOT opted out (accounts.weekly_summary_opt_out = true)
 *
 * The email is a full "morning briefing" with:
 *   - Top-line revenue, orders, conversations, customers
 *   - Channel breakdown (WhatsApp / Instagram / Facebook / Telegram / Email)
 *   - AI deflection rate + AI cost savings
 *   - Top 5 products by units sold
 *   - Top 5 customers by spend
 *   - Abandoned carts + recovery stats
 *   - Pending tasks + reviews awaiting response
 *   - Average response time, fastest + slowest channel
 *   - Week-over-week comparison (revenue / orders / convs vs previous 7 days)
 *   - Action items / recommendations (smart, based on data)
 *   - Team performance (per-agent stats)
 *   - Low-stock products needing reorder
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
  // Pattern B: CRON_SECRET is REQUIRED
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
  const stats = { sent: 0, errors: 0, skipped: 0 };

  try {
    // Get all accounts with activity in the last 7 days
    const { data: activeAccounts } = await supabase
      .from("accounts")
      .select("id, email, business_name, owner_name, plan, currency, country, weekly_summary_opt_out, weekly_summary_sent_at")
      .not("email", "is", null)
      .eq("weekly_summary_opt_out", false)
      .order("created_at", { ascending: false })
      .limit(1000);

    const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

    for (const account of activeAccounts || []) {
      try {
        // Rate-limit: skip if sent within last 24h (prevents double-sends if cron fires twice)
        if (account.weekly_summary_sent_at && new Date(account.weekly_summary_sent_at) > new Date(oneDayAgo)) {
          stats.skipped++;
          continue;
        }

        // ───────────────────────────────────────────────────────────
        // 1. Activity check
        // ───────────────────────────────────────────────────────────
        const { count: convCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo);

        if (!convCount || convCount === 0) {
          stats.skipped++;
          continue;
        }

        // ───────────────────────────────────────────────────────────
        // 2. CONVERSATIONS + CHANNELS
        // ───────────────────────────────────────────────────────────
        const { data: convs } = await supabase
          .from("conversations")
          .select("id, resolved_by, channel, status, intent, converted, created_at, priority, assigned_to")
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo);

        const allConvs = convs || [];
        const aiResolved = allConvs.filter((c) => c.resolved_by === "ai").length;
        const humanResolved = allConvs.filter((c) => c.resolved_by === "human").length;
        const deflectionRate = allConvs.length > 0
          ? Math.round((aiResolved / allConvs.length) * 100)
          : 0;
        const convertedCount = allConvs.filter((c) => c.converted).length;
        const conversionRate = allConvs.length > 0
          ? +((convertedCount / allConvs.length) * 100).toFixed(1)
          : 0;

        // Channel breakdown
        const channelBreakdown = {};
        allConvs.forEach((c) => {
          const ch = c.channel || "unknown";
          channelBreakdown[ch] = (channelBreakdown[ch] || 0) + 1;
        });

        // Status breakdown (active vs closed)
        const activeConvs = allConvs.filter((c) => ["new", "open", "in_progress", "needs_attention"].includes(c.status)).length;
        const closedConvs = allConvs.filter((c) => c.status === "closed" || c.status === "resolved").length;

        // Intent breakdown (top 3)
        const intentCounts = {};
        allConvs.forEach((c) => {
          if (c.intent && c.intent !== "general") {
            intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1;
          }
        });
        const topIntents = Object.entries(intentCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([intent, count]) => ({ intent, count }));

        // ───────────────────────────────────────────────────────────
        // 3. ORDERS + REVENUE
        // ───────────────────────────────────────────────────────────
        const { data: orders } = await supabase
          .from("orders")
          .select("id, total, payment_status, status, currency, created_at, items")
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false });
        const allOrders = orders || [];
        const paidOrders = allOrders.filter((o) => o.payment_status === "paid");
        const revenue = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
        const pendingRevenue = allOrders
          .filter((o) => o.payment_status !== "paid" && o.status !== "cancelled")
          .reduce((s, o) => s + Number(o.total || 0), 0);
        const aov = paidOrders.length > 0 ? revenue / paidOrders.length : 0;

        // ───────────────────────────────────────────────────────────
        // 4. WEEK-OVER-WEEK COMPARISON (previous 7 days)
        // ───────────────────────────────────────────────────────────
        const { count: prevConvCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("account_id", account.id)
          .gte("created_at", fourteenDaysAgo)
          .lt("created_at", sevenDaysAgo);

        const { data: prevOrders } = await supabase
          .from("orders")
          .select("total, payment_status")
          .eq("account_id", account.id)
          .gte("created_at", fourteenDaysAgo)
          .lt("created_at", sevenDaysAgo);
        const prevPaidOrders = (prevOrders || []).filter((o) => o.payment_status === "paid");
        const prevRevenue = prevPaidOrders.reduce((s, o) => s + Number(o.total || 0), 0);

        const revenueChange = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : (revenue > 0 ? 100 : 0);
        const ordersChange = prevPaidOrders.length > 0 ? Math.round(((paidOrders.length - prevPaidOrders.length) / prevPaidOrders.length) * 100) : (paidOrders.length > 0 ? 100 : 0);
        const convsChange = prevConvCount > 0 ? Math.round(((allConvs.length - prevConvCount) / prevConvCount) * 100) : (allConvs.length > 0 ? 100 : 0);

        // ───────────────────────────────────────────────────────────
        // 5. TOP PRODUCTS (by units sold)
        // ───────────────────────────────────────────────────────────
        const productSales = {};
        const productRevenue = {};
        paidOrders.forEach((o) => {
          (o.items || []).forEach((i) => {
            productSales[i.name] = (productSales[i.name] || 0) + (i.qty || i.quantity || 1);
            productRevenue[i.name] = (productRevenue[i.name] || 0) + Number(i.price || 0) * (i.qty || i.quantity || 1);
          });
        });
        const topProducts = Object.keys(productSales)
          .map((name) => ({ name, units: productSales[name], revenue: productRevenue[name] }))
          .sort((a, b) => b.units - a.units)
          .slice(0, 5);

        // ───────────────────────────────────────────────────────────
        // 6. TOP CUSTOMERS (by spend this week)
        // ───────────────────────────────────────────────────────────
        const { data: topCustomersData } = await supabase
          .from("customers")
          .select("id, name, email, total_spent, total_orders, channel, last_order_at")
          .eq("account_id", account.id)
          .order("total_spent", { ascending: false })
          .limit(5);
        const topCustomers = (topCustomersData || []).map((c) => ({
          name: c.name || c.email || "Unknown",
          totalSpent: Number(c.total_spent || 0),
          totalOrders: c.total_orders || 0,
          channel: c.channel,
        }));

        // ───────────────────────────────────────────────────────────
        // 7. NEW CUSTOMERS
        // ───────────────────────────────────────────────────────────
        const { count: newCustCount } = await supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .eq("account_id", account.id)
          .gte("created_at", sevenDaysAgo);

        // ───────────────────────────────────────────────────────────
        // 8. ABANDONED CARTS + RECOVERY
        // ───────────────────────────────────────────────────────────
        let abandonedCarts = 0;
        let recoveredCarts = 0;
        let recoveredRevenue = 0;
        try {
          const { data: carts } = await supabase
            .from("abandoned_carts")
            .select("id, status, cart_value, recovery_revenue")
            .eq("account_id", account.id)
            .gte("abandoned_at", sevenDaysAgo);
          (carts || []).forEach((c) => {
            abandonedCarts++;
            if (c.status === "recovered") {
              recoveredCarts++;
              recoveredRevenue += Number(c.recovery_revenue || 0);
            }
          });
        } catch (e) { /* table might not exist */ }

        // ───────────────────────────────────────────────────────────
        // 9. RESPONSE TIME
        // ───────────────────────────────────────────────────────────
        const { data: aiMessages } = await supabase
          .from("messages")
          .select("response_time_seconds, conversation_id")
          .eq("is_ai", true)
          .not("response_time_seconds", "is", null)
          .gte("created_at", sevenDaysAgo)
          .limit(500);
        const responseTimes = (aiMessages || []).map((m) => m.response_time_seconds).filter(Boolean);
        const avgResponseTime = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null;
        const fastestResponse = responseTimes.length > 0 ? Math.min(...responseTimes) : null;
        const slowestResponse = responseTimes.length > 0 ? Math.max(...responseTimes) : null;

        // ───────────────────────────────────────────────────────────
        // 10. PENDING TASKS + REVIEWS
        // ───────────────────────────────────────────────────────────
        let pendingTasks = 0;
        let overdueTasks = 0;
        try {
          const { count: tc } = await supabase
            .from("customer_tasks")
            .select("*", { count: "exact", head: true })
            .eq("account_id", account.id)
            .in("status", ["unseen", "seen", "in_progress", "review", "rejected", "pending"]);
          pendingTasks = tc || 0;
          const { count: oc } = await supabase
            .from("customer_tasks")
            .select("*", { count: "exact", head: true })
            .eq("account_id", account.id)
            .lt("due_date", new Date().toISOString())
            .not("status", "in", '("done","completed","cancelled")');
          overdueTasks = oc || 0;
        } catch (e) { /* table might not exist */ }

        let pendingReviews = 0;
        try {
          const { count: rc } = await supabase
            .from("reviews")
            .select("*", { count: "exact", head: true })
            .eq("account_id", account.id)
            .eq("status", "pending");
          pendingReviews = rc || 0;
        } catch (e) { /* table might not exist */ }

        // ───────────────────────────────────────────────────────────
        // 11. LOW-STOCK PRODUCTS
        // ───────────────────────────────────────────────────────────
        let lowStockProducts = [];
        try {
          const { data: lp } = await supabase
            .from("products")
            .select("id, name, stock, status")
            .eq("account_id", account.id)
            .eq("status", "active")
            .lte("stock", 5)
            .gt("stock", 0)
            .order("stock", { ascending: true })
            .limit(5);
          lowStockProducts = (lp || []).map((p) => ({ name: p.name, stock: p.stock }));
        } catch (e) { /* ignore */ }

        // ───────────────────────────────────────────────────────────
        // 12. TEAM PERFORMANCE (per-agent stats)
        // ───────────────────────────────────────────────────────────
        let teamPerformance = [];
        try {
          const { data: members } = await supabase
            .from("team_members")
            .select("user_id, name, display_name, invited_email, role")
            .eq("account_id", account.id)
            .eq("invite_status", "accepted")
            .eq("status", "active");

          if (members && members.length > 0) {
            // Owner first
            teamPerformance.push({
              name: account.owner_name || account.email,
              role: "owner",
              conversationsHandled: allConvs.filter((c) => c.assigned_to === account.id).length,
            });
            // Then team members
            for (const m of members) {
              const handled = allConvs.filter((c) => c.assigned_to === m.user_id).length;
              teamPerformance.push({
                name: m.name || m.display_name || m.invited_email,
                role: m.role,
                conversationsHandled: handled,
              });
            }
          }
        } catch (e) { /* ignore */ }

        // ───────────────────────────────────────────────────────────
        // 13. AI COST SAVINGS (rough estimate)
        // ───────────────────────────────────────────────────────────
        // AI deflection rate * conversations * assumed $0.50 saved per deflected convo
        const aiCostSavings = (aiResolved * 0.5).toFixed(2);

        // ───────────────────────────────────────────────────────────
        // 14. SMART RECOMMENDATIONS / ACTION ITEMS
        // ───────────────────────────────────────────────────────────
        const actionItems = [];
        if (deflectionRate < 30 && allConvs.length > 5) {
          actionItems.push({
            priority: "high",
            text: `Your AI deflection rate is ${deflectionRate}%. Improve your AI personality and FAQ knowledge base to deflect more conversations automatically.`,
          });
        }
        if (revenue === 0 && allConvs.length > 3) {
          actionItems.push({
            priority: "high",
            text: "No paid orders this week. Send a broadcast campaign with a special offer to your customers.",
          });
        }
        if (conversionRate < 5 && allConvs.length > 5) {
          actionItems.push({
            priority: "medium",
            text: `Your conversation-to-order conversion is ${conversionRate}%. Send payment links more proactively when customers show buying intent.`,
          });
        }
        if (overdueTasks > 0) {
          actionItems.push({
            priority: "high",
            text: `You have ${overdueTasks} overdue task${overdueTasks > 1 ? "s" : ""}. Review them in the Tasks page.`,
          });
        }
        if (pendingReviews > 0) {
          actionItems.push({
            priority: "medium",
            text: `${pendingReviews} customer review${pendingReviews > 1 ? "s are" : " is"} awaiting your response. Reply to build trust.`,
          });
        }
        if (lowStockProducts.length > 0) {
          actionItems.push({
            priority: "medium",
            text: `${lowStockProducts.length} product${lowStockProducts.length > 1 ? "s are" : " is"} running low on stock. Reorder soon: ${lowStockProducts.map((p) => `${p.name} (${p.stock} left)`).join(", ")}.`,
          });
        }
        if (abandonedCarts > 0 && recoveredCarts === 0) {
          actionItems.push({
            priority: "medium",
            text: `${abandonedCarts} cart${abandonedCarts > 1 ? "s were" : " was"} abandoned this week with 0 recovered. Enable cart recovery automations.`,
          });
        }
        if (revenueChange > 0) {
          actionItems.push({
            priority: "low",
            text: `🎉 Revenue is up ${revenueChange}% vs last week. Keep the momentum with a follow-up campaign next week.`,
          });
        } else if (revenueChange < 0 && prevRevenue > 0) {
          actionItems.push({
            priority: "high",
            text: `⚠️ Revenue is down ${Math.abs(revenueChange)}% vs last week. Consider a win-back campaign for inactive customers.`,
          });
        }
        if (actionItems.length === 0) {
          actionItems.push({
            priority: "low",
            text: "Everything looks healthy this week. Keep up the great work! 💪",
          });
        }

        // ───────────────────────────────────────────────────────────
        // 15. BUILD + SEND EMAIL
        // ───────────────────────────────────────────────────────────
        const summary = {
          businessName: account.business_name,
          weekRange: { start: sevenDaysAgo, end: new Date().toISOString() },
          totalConversations: allConvs.length,
          activeConversations: activeConvs,
          closedConversations: closedConvs,
          aiReplies: aiResolved,
          humanReplies: humanResolved,
          deflectionRate,
          newCustomers: newCustCount || 0,
          ordersCount: paidOrders.length,
          revenue,
          pendingRevenue,
          aov,
          currency: account.currency || "EGP",
          avgResponseTime,
          fastestResponse,
          slowestResponse,
          conversionRate,
          convertedCount,
          channelBreakdown,
          topIntents,
          topProducts,
          topCustomers,
          abandonedCarts,
          recoveredCarts,
          recoveredRevenue,
          pendingTasks,
          overdueTasks,
          pendingReviews,
          lowStockProducts,
          teamPerformance,
          aiCostSavings,
          actionItems,
          // WoW comparison
          prevRevenue,
          prevOrders: prevPaidOrders.length,
          prevConvs: prevConvCount || 0,
          revenueChange,
          ordersChange,
          convsChange,
        };

        const sendResult = await sendWeeklySummaryEmail({
          to: account.email,
          businessName: account.business_name,
          accountId: account.id,
          stats: summary,
        });

        if (sendResult.success) {
          // Stamp sent_at for rate-limit
          await supabase
            .from("accounts")
            .update({ weekly_summary_sent_at: new Date().toISOString() })
            .eq("id", account.id);
          stats.sent++;
        } else {
          console.error(`[WEEKLY] send failed for ${account.email}:`, sendResult.error);
          stats.errors++;
        }
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
