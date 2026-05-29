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
 * GET /api/analytics/customers
 * Returns customer analytics including growth, segments, and activity
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

    // Fetch all customers
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, name, total_orders, total_spent, channel, platform, is_returning, first_seen_at, created_at")
      .eq("account_id", user.id)
      .order("total_spent", { ascending: false });

    if (customersError) {
      return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
    }

    // Fetch orders for average order value
    const { data: orders } = await supabase
      .from("orders")
      .select("total, payment_status, customer_id, created_at")
      .eq("account_id", user.id);

    // Fetch conversations for message counts
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, customer_id, channel, created_at")
      .eq("account_id", user.id);

    // Fetch messages for activity
    const { data: messages } = await supabase
      .from("messages")
      .select("id, conversation_id, direction, is_ai, created_at")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000);

    const allCustomers = customers || [];
    const allOrders = orders || [];
    const allConversations = conversations || [];
    const allMessages = messages || [];

    // ─── Basic Stats ───
    const totalCustomers = allCustomers.length;
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = allCustomers.filter(c => new Date(c.first_seen_at || c.created_at) >= thisMonthStart).length;
    const returningCustomers = allCustomers.filter(c => c.is_returning || c.total_orders > 1).length;

    // ─── Average Lifetime Value ───
    const totalSpent = allCustomers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    const avgLifetimeValue = totalCustomers > 0 ? Math.round(totalSpent / totalCustomers) : 0;

    // ─── Average Order Value ───
    const paidOrders = allOrders.filter(o => o.payment_status === "paid");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

    // ─── Customer Growth (new customers per day for last 30 days) ───
    const customerGrowth = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split("T")[0];
      const newOnDay = allCustomers.filter(c => {
        const d = new Date(c.first_seen_at || c.created_at);
        return d.toISOString().split("T")[0] === dayStr;
      }).length;
      customerGrowth.push({ date: dayStr, count: newOnDay });
    }

    // ─── Most Active Customers (by message count + order count) ───
    // Build conversation → customer map
    const convCustomerMap = {};
    allConversations.forEach(conv => {
      convCustomerMap[conv.id] = conv.customer_id;
    });

    // Count messages per customer
    const customerMsgCounts = {};
    allMessages.filter(m => m.direction === "incoming").forEach(m => {
      const custId = convCustomerMap[m.conversation_id];
      if (custId) {
        customerMsgCounts[custId] = (customerMsgCounts[custId] || 0) + 1;
      }
    });

    // Merge with order data
    const mostActive = allCustomers
      .map(c => ({
        id: c.id,
        name: c.name,
        total_orders: c.total_orders || 0,
        total_spent: c.total_spent || 0,
        message_count: customerMsgCounts[c.id] || 0,
        activity_score: (c.total_orders || 0) * 3 + (customerMsgCounts[c.id] || 0),
        channel: c.platform || c.channel,
      }))
      .sort((a, b) => b.activity_score - a.activity_score)
      .slice(0, 10);

    // ─── Customer Retention Rate ───
    const customersWith2PlusOrders = allCustomers.filter(c => c.total_orders >= 2).length;
    const retentionRate = totalCustomers > 0 ? ((customersWith2PlusOrders / totalCustomers) * 100).toFixed(1) : 0;

    // ─── Top Customer Segments by Spending ───
    const segments = {
      "High Value (5000+ EGP)": allCustomers.filter(c => (c.total_spent || 0) >= 5000).length,
      "Medium (1000-4999 EGP)": allCustomers.filter(c => (c.total_spent || 0) >= 1000 && (c.total_spent || 0) < 5000).length,
      "Low (100-999 EGP)": allCustomers.filter(c => (c.total_spent || 0) >= 100 && (c.total_spent || 0) < 1000).length,
      "Browsers (<100 EGP)": allCustomers.filter(c => (c.total_spent || 0) < 100).length,
    };

    // ─── New vs Returning ───
    const newVsReturning = {
      new: totalCustomers - returningCustomers,
      returning: returningCustomers,
      newPct: totalCustomers > 0 ? Math.round(((totalCustomers - returningCustomers) / totalCustomers) * 100) : 0,
      returningPct: totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        totalCustomers,
        newThisMonth,
        returningCustomers,
        avgLifetimeValue,
        avgOrderValue,
        customerGrowth,
        mostActive,
        retentionRate: parseFloat(retentionRate),
        segments,
        newVsReturning,
      },
    });
  } catch (error) {
    console.error("Customer analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
