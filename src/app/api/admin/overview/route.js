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

// Admin account IDs (hardcoded for security)
const ADMIN_ACCOUNT_IDS = ["e6a38229-7fd2-47a4-a28e-415dc76bfb46"];

async function verifyAdmin(request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey === process.env.ADMIN_SECRET_KEY) return true;

  const authHeader = request.headers.get("x-account-id");
  if (authHeader && ADMIN_ACCOUNT_IDS.includes(authHeader)) return true;

  return false;
}

/**
 * GET /api/admin/overview
 * Platform-wide overview stats for admin dashboard
 */
export async function GET(request) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const supabase = getSupabase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ─── Parallel data fetching ───
    const [
      accountsRes,
      conversationsRes,
      messagesRes,
      ordersRes,
      productsRes,
      customersRes,
      aiMessagesTodayRes,
      aiMessagesWeekRes,
      aiMessagesMonthRes,
    ] = await Promise.all([
      supabase.from("accounts").select("id, plan, created_at"),
      supabase.from("conversations").select("id, channel, account_id, last_message_at"),
      supabase.from("messages").select("id, direction, is_ai, created_at, account_id"),
      supabase.from("orders").select("id, total, payment_status, created_at"),
      supabase.from("products").select("id"),
      supabase.from("customers").select("id"),
      supabase.from("messages").select("id").eq("is_ai", true).gte("created_at", todayStart),
      supabase.from("messages").select("id").eq("is_ai", true).gte("created_at", weekAgo),
      supabase.from("messages").select("id").eq("is_ai", true).gte("created_at", monthAgo),
    ]);

    const accounts = accountsRes.data || [];
    const conversations = conversationsRes.data || [];
    const messages = messagesRes.data || [];
    const orders = ordersRes.data || [];

    // ─── Account Stats ───
    const totalAccounts = accounts.length;
    const accountsByPlan = { starter: 0, professional: 0, business: 0 };
    accounts.forEach((a) => {
      if (accountsByPlan[a.plan] !== undefined) accountsByPlan[a.plan]++;
    });

    const newAccountsWeek = accounts.filter((a) => a.created_at >= weekAgo).length;
    const newAccountsMonth = accounts.filter((a) => a.created_at >= monthAgo).length;

    // ─── Active accounts (had activity in last 7 days) ───
    const activeAccountIds = new Set();
    conversations.forEach((c) => {
      if (c.last_message_at && c.last_message_at >= weekAgo) {
        activeAccountIds.add(c.account_id);
      }
    });
    // Also check messages for activity
    messages.forEach((m) => {
      if (m.created_at >= weekAgo && m.account_id) {
        activeAccountIds.add(m.account_id);
      }
    });
    const activeAccounts = activeAccountIds.size;

    // ─── Conversation Stats ───
    const totalConversations = conversations.length;
    const conversationsByChannel = { instagram: 0, facebook: 0, whatsapp: 0 };
    conversations.forEach((c) => {
      if (conversationsByChannel[c.channel] !== undefined) conversationsByChannel[c.channel]++;
    });

    // ─── Message Stats ───
    const totalMessages = messages.length;
    const incomingMessages = messages.filter((m) => m.direction === "incoming").length;
    const outgoingMessages = messages.filter((m) => m.direction === "outgoing").length;
    const aiMessages = messages.filter((m) => m.is_ai).length;
    const humanMessages = messages.filter((m) => !m.is_ai && m.direction === "outgoing").length;

    // ─── Order Stats ───
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

    // ─── Product / Customer Stats ───
    const totalProducts = (productsRes.data || []).length;
    const totalCustomers = (customersRes.data || []).length;

    // ─── AI Auto-Reply Counts ───
    const aiAutoReplyToday = (aiMessagesTodayRes.data || []).length;
    const aiAutoReplyWeek = (aiMessagesWeekRes.data || []).length;
    const aiAutoReplyMonth = (aiMessagesMonthRes.data || []).length;

    // ─── Time-series data for last 30 days ───
    const messagesPerDay = [];
    const revenuePerDay = [];
    const accountGrowthPerDay = [];

    // Pre-sort data for efficient lookups
    const messagesByDay = {};
    messages.forEach((m) => {
      const day = new Date(m.created_at).toISOString().split("T")[0];
      messagesByDay[day] = (messagesByDay[day] || 0) + 1;
    });

    const revenueByDay = {};
    orders
      .filter((o) => o.payment_status === "paid")
      .forEach((o) => {
        const day = new Date(o.created_at).toISOString().split("T")[0];
        revenueByDay[day] = (revenueByDay[day] || 0) + (parseFloat(o.total) || 0);
      });

    // Build cumulative account growth
    const accountsByCreatedDay = {};
    accounts.forEach((a) => {
      const day = new Date(a.created_at).toISOString().split("T")[0];
      accountsByCreatedDay[day] = (accountsByCreatedDay[day] || 0) + 1;
    });

    // Count accounts created before 30 days ago for cumulative baseline
    let cumulativeAccounts = accounts.filter((a) => new Date(a.created_at) < thirtyDaysAgo).length;

    for (let i = 29; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split("T")[0];

      messagesPerDay.push({ date: dayStr, count: messagesByDay[dayStr] || 0 });
      revenuePerDay.push({ date: dayStr, revenue: Math.round((revenueByDay[dayStr] || 0) * 100) / 100 });

      cumulativeAccounts += accountsByCreatedDay[dayStr] || 0;
      accountGrowthPerDay.push({ date: dayStr, total: cumulativeAccounts });
    }

    return NextResponse.json({
      success: true,
      data: {
        accounts: {
          total: totalAccounts,
          byPlan: accountsByPlan,
          newThisWeek: newAccountsWeek,
          newThisMonth: newAccountsMonth,
          active: activeAccounts,
        },
        conversations: {
          total: totalConversations,
          byChannel: conversationsByChannel,
        },
        messages: {
          total: totalMessages,
          incoming: incomingMessages,
          outgoing: outgoingMessages,
          ai: aiMessages,
          human: humanMessages,
        },
        orders: {
          total: totalOrders,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
        },
        products: { total: totalProducts },
        customers: { total: totalCustomers },
        aiAutoReplies: {
          today: aiAutoReplyToday,
          thisWeek: aiAutoReplyWeek,
          thisMonth: aiAutoReplyMonth,
        },
        charts: {
          messagesPerDay,
          revenuePerDay,
          accountGrowthPerDay,
        },
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
