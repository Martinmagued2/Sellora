/**
 * GET /api/ai/dashboard-insights
 *
 * The "Business Command Center" endpoint. Fetches key stats for the user's
 * account, runs a single LLM call over them, and returns 3-5 prioritized
 * recommendations with action buttons.
 *
 * This is the proactive "AI says..." panel that turns Sellora from a
 * collection of charts into a daily-essential intelligent dashboard.
 *
 * Response shape:
 *   {
 *     stats: { ... },            // the raw stats passed to the LLM
 *     insights: [
 *       {
 *         priority: "high" | "medium" | "low",
 *         category: "revenue" | "customers" | "inventory" | "response" | "opportunity",
 *         title: "Reply to Sarah now",
 *         detail: "93% chance of purchase based on her conversation pattern",
 *         action_label: "Open Conversation",
 *         action_path: "/dashboard/conversations?id=..."
 *       },
 *       ...
 *     ],
 *     summary: "Yesterday was strong — revenue up 8%. But 23 customers are waiting...",
 *     generated_at: "2026-07-23T..."
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";
import { buildStandaloneProvider } from "@/lib/ai/standalone-provider";

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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const db = admin();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ─── Gather stats in parallel ───
    const [
      ordersToday, ordersYesterday, ordersWeek, ordersLastWeek,
      conversationsToday, conversationsWaiting, conversationsNeedsAttention,
      lowStockProducts, topCustomers, recentEscalations, unreadMessages,
      aiRepliesToday
    ] = await Promise.all([
      // Orders today
      db.from("orders").select("total, currency, status, payment_status")
        .eq("account_id", effectiveAccountId)
        .gte("created_at", yesterday.toISOString()),
      // Orders yesterday (for comparison)
      db.from("orders").select("total, currency")
        .eq("account_id", effectiveAccountId)
        .gte("created_at", twoWeeksAgo.toISOString())
        .lt("created_at", yesterday.toISOString()),
      // Orders this week
      db.from("orders").select("total, currency")
        .eq("account_id", effectiveAccountId)
        .gte("created_at", weekAgo.toISOString()),
      // Orders last week (for WoW comparison)
      db.from("orders").select("total, currency")
        .eq("account_id", effectiveAccountId)
        .gte("created_at", twoWeeksAgo.toISOString())
        .lt("created_at", weekAgo.toISOString()),
      // Conversations today
      db.from("conversations").select("id, status, channel")
        .eq("account_id", effectiveAccountId)
        .gte("created_at", yesterday.toISOString()),
      // Conversations waiting for reply (customer sent last message)
      db.from("conversations").select("id, customer_id, channel, last_message_at")
        .eq("account_id", effectiveAccountId)
        .eq("status", "waiting_customer")
        .order("last_message_at", { ascending: false })
        .limit(20),
      // Conversations needing attention
      db.from("conversations").select("id, customer_id, channel, status")
        .eq("account_id", effectiveAccountId)
        .eq("status", "needs_attention"),
      // Low-stock products
      db.from("products").select("id, name, stock, price")
        .eq("account_id", effectiveAccountId)
        .lt("stock", 5)
        .gt("stock", 0)
        .order("stock", { ascending: true })
        .limit(10),
      // Top customers (by spend)
      db.from("customers").select("id, name, total_spent, total_orders, last_active_at")
        .eq("account_id", effectiveAccountId)
        .order("total_spent", { ascending: false })
        .limit(5),
      // Recent escalations
      db.from("conversations").select("id, customer:customers(name), status")
        .eq("account_id", effectiveAccountId)
        .eq("status", "needs_attention")
        .order("updated_at", { ascending: false })
        .limit(5),
      // Unread messages count
      db.from("messages").select("id", { count: "exact", head: true })
        .eq("account_id", effectiveAccountId)
        .eq("direction", "incoming")
        .eq("is_read", false),
      // AI replies today (count)
      db.from("messages").select("id", { count: "exact", head: true })
        .eq("account_id", effectiveAccountId)
        .eq("is_ai", true)
        .gte("created_at", yesterday.toISOString()),
    ]);

    // ─── Compute summary stats ───
    const todayRevenue = (ordersToday.data || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const yesterdayRevenue = (ordersYesterday.data || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const weekRevenue = (ordersWeek.data || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const lastWeekRevenue = (ordersLastWeek.data || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0;
    const weekRevenueChange = lastWeekRevenue > 0 ? ((weekRevenue - lastWeekRevenue) / lastWeekRevenue * 100) : 0;

    const stats = {
      account_id: effectiveAccountId,
      generated_at: now.toISOString(),
      revenue: {
        today: Math.round(todayRevenue * 100) / 100,
        yesterday: Math.round(yesterdayRevenue * 100) / 100,
        today_vs_yesterday_pct: Math.round(revenueChange * 10) / 10,
        this_week: Math.round(weekRevenue * 100) / 100,
        last_week: Math.round(lastWeekRevenue * 100) / 100,
        week_over_week_pct: Math.round(weekRevenueChange * 10) / 10,
      },
      orders: {
        today_count: ordersToday.data?.length || 0,
        week_count: ordersWeek.data?.length || 0,
      },
      conversations: {
        today_count: conversationsToday.data?.length || 0,
        waiting_count: conversationsWaiting.data?.length || 0,
        needs_attention_count: conversationsNeedsAttention.data?.length || 0,
      },
      unread_messages: unreadMessages.count || 0,
      ai_replies_today: aiRepliesToday.count || 0,
      inventory: {
        low_stock_count: lowStockProducts.data?.length || 0,
        low_stock_items: (lowStockProducts.data || []).slice(0, 5).map(p => ({
          name: p.name,
          stock: p.stock,
        })),
      },
      top_customers: (topCustomers.data || []).map(c => ({
        name: c.name,
        total_spent: c.total_spent,
        total_orders: c.total_orders,
        last_active: c.last_active_at,
      })),
      waiting_conversations: (conversationsWaiting.data || []).slice(0, 5).map(c => ({
        id: c.id,
        channel: c.channel,
        waiting_since: c.last_message_at,
      })),
    };

    // ─── Run LLM to generate insights ───
    const model = buildStandaloneProvider();
    if (!model) {
      // No AI provider configured — return stats with rule-based fallback insights
      return NextResponse.json({
        stats,
        insights: generateRuleBasedInsights(stats),
        summary: "AI providers not configured. Showing rule-based insights.",
        generated_at: now.toISOString(),
        ai_powered: false,
      });
    }

    const systemPrompt = `You are Sellora's AI Business Advisor. You analyze store metrics and surface 3-5 actionable insights that help the business owner grow revenue, retain customers, and operate efficiently.

RULES:
1. Each insight must be SPECIFIC and ACTIONABLE — never generic ("improve response time" is bad; "Your IG response time is 42% slower this week, reply to these 3 customers" is good).
2. Prioritize by impact: revenue > at-risk customers > inventory > response time.
3. If a stat is concerning, explain WHY it matters (e.g., "3 VIPs haven't ordered in 60 days — they typically reorder every 30 days").
4. Each insight has: priority (high/medium/low), category, title (max 60 chars), detail (1-2 sentences), action_label, action_path.
5. Valid action_paths: /dashboard/conversations, /dashboard/orders, /dashboard/products, /dashboard/customers, /dashboard/abandoned-carts
6. Write a 2-sentence summary at the end that reads like a morning briefing.
7. Return ONLY valid JSON, no markdown fences.

JSON schema:
{
  "insights": [
    {
      "priority": "high",
      "category": "revenue",
      "title": "...",
      "detail": "...",
      "action_label": "Open Conversations",
      "action_path": "/dashboard/conversations"
    }
  ],
  "summary": "..."
}`;

    const userPrompt = `Here are today's store stats (generated at ${now.toISOString()}):

${JSON.stringify(stats, null, 2)}

Generate 3-5 prioritized insights and a 2-sentence summary.`;

    let insights = [];
    let summary = "";

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 1200,
      });

      // Parse the LLM response as JSON
      const text = result.text.trim();
      // Strip markdown fences if present
      const cleanText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(cleanText);
      insights = parsed.insights || [];
      summary = parsed.summary || "";
    } catch (llmErr) {
      console.error("[DASHBOARD-INSIGHTS] LLM call failed:", llmErr.message);
      // Fall back to rule-based insights
      insights = generateRuleBasedInsights(stats);
      summary = "AI analysis unavailable — showing rule-based insights.";
    }

    return NextResponse.json({
      stats,
      insights,
      summary,
      generated_at: now.toISOString(),
      ai_powered: insights.length > 0,
    });
  } catch (e) {
    console.error("[DASHBOARD-INSIGHTS] error:", e.message);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

/**
 * Rule-based fallback insights (used when no AI provider is configured).
 */
function generateRuleBasedInsights(stats) {
  const insights = [];

  // Waiting customers
  if (stats.conversations.waiting_count > 0) {
    insights.push({
      priority: "high",
      category: "response",
      title: `${stats.conversations.waiting_count} customer${stats.conversations.waiting_count === 1 ? "" : "s"} waiting for your reply`,
      detail: `The longest wait has been since ${stats.waiting_conversations[0]?.waiting_since || "recently"}. Fast replies increase conversion by up to 40%.`,
      action_label: "Open Conversations",
      action_path: "/dashboard/conversations",
    });
  }

  // Needs attention
  if (stats.conversations.needs_attention_count > 0) {
    insights.push({
      priority: "high",
      category: "customers",
      title: `${stats.conversations.needs_attention_count} conversation${stats.conversations.needs_attention_count === 1 ? "" : "s"} need attention`,
      detail: "These conversations have been flagged as urgent or escalated. Review them now.",
      action_label: "Review Now",
      action_path: "/dashboard/conversations?status=needs_attention",
    });
  }

  // Unread messages
  if (stats.unread_messages > 0) {
    insights.push({
      priority: "high",
      category: "response",
      title: `${stats.unread_messages} unread message${stats.unread_messages === 1 ? "" : "s"}`,
      detail: "Customers are waiting. Each unread message is a potential sale at risk.",
      action_label: "View Inbox",
      action_path: "/dashboard/conversations",
    });
  }

  // Revenue trend
  if (stats.revenue.today_vs_yesterday_pct < 0) {
    insights.push({
      priority: "medium",
      category: "revenue",
      title: `Revenue is down ${Math.abs(stats.revenue.today_vs_yesterday_pct)}% vs yesterday`,
      detail: `Today: ${stats.revenue.today}. Yesterday: ${stats.revenue.yesterday}. Check for slow responses or stockouts.`,
      action_label: "View Analytics",
      action_path: "/dashboard/analytics",
    });
  } else if (stats.revenue.today_vs_yesterday_pct > 0) {
    insights.push({
      priority: "low",
      category: "revenue",
      title: `Revenue is up ${stats.revenue.today_vs_yesterday_pct}% vs yesterday`,
      detail: `Great momentum! Today: ${stats.revenue.today}. Keep it going by following up with waiting customers.`,
      action_label: "View Orders",
      action_path: "/dashboard/orders",
    });
  }

  // Low stock
  if (stats.inventory.low_stock_count > 0) {
    insights.push({
      priority: "medium",
      category: "inventory",
      title: `${stats.inventory.low_stock_count} product${stats.inventory.low_stock_count === 1 ? "" : "s"} running low on stock`,
      detail: `Lowest: ${stats.inventory.low_stock_items[0]?.name || ""} (${stats.inventory.low_stock_items[0]?.stock || 0} left). Restock to avoid lost sales.`,
      action_label: "View Products",
      action_path: "/dashboard/products",
    });
  }

  // Top customers — re-engagement
  if (stats.top_customers.length > 0) {
    const topCustomer = stats.top_customers[0];
    const daysSinceActive = topCustomer.last_active
      ? Math.floor((Date.now() - new Date(topCustomer.last_active).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    if (daysSinceActive > 30) {
      insights.push({
        priority: "medium",
        category: "customers",
        title: `Your top customer ${topCustomer.name} hasn't been active in ${daysSinceActive} days`,
        detail: `They've spent ${topCustomer.total_spent} across ${topCustomer.total_orders} orders. Send a win-back message.`,
        action_label: "Message Customer",
        action_path: "/dashboard/customers",
      });
    }
  }

  // AI performance
  if (stats.ai_replies_today > 0) {
    insights.push({
      priority: "low",
      category: "opportunity",
      title: `AI handled ${stats.ai_replies_today} message${stats.ai_replies_today === 1 ? "" : "s"} today`,
      detail: "Your AI is working. Review its conversations to ensure quality and catch escalation opportunities.",
      action_label: "Review AI Conversations",
      action_path: "/dashboard/conversations",
    });
  }

  // Sort by priority: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights.slice(0, 5);
}
