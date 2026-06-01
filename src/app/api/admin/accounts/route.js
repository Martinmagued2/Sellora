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
 * GET /api/admin/accounts?search=&plan=&page=1&limit=20
 * All accounts with detailed info and aggregated stats
 */
export async function GET(request) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "";
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    // Build query for accounts
    let query = supabase
      .from("accounts")
      .select(
        `id, business_name, email, plan, plan_status, created_at, updated_at,
         instagram_connected, facebook_connected, whatsapp_connected,
         ai_enabled, auto_greeting, ai_personality, country, currency,
         owner_name, industry`
      )
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`business_name.ilike.%${search}%,email.ilike.%${search}%,owner_name.ilike.%${search}%`);
    }
    if (plan) {
      query = query.eq("plan", plan);
    }

    // Get total count first
    let countQuery = supabase
      .from("accounts")
      .select("id", { count: "exact", head: true });

    if (search) {
      countQuery = countQuery.or(`business_name.ilike.%${search}%,email.ilike.%${search}%,owner_name.ilike.%${search}%`);
    }
    if (plan) {
      countQuery = countQuery.eq("plan", plan);
    }

    const { count: totalCount } = await countQuery;

    // Fetch paginated accounts
    const { data: accounts, error: accountsError } = await query.range(offset, offset + limit - 1);

    if (accountsError) {
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        success: true,
        data: { accounts: [], pagination: { page, limit, total: totalCount || 0, totalPages: 0 } },
      });
    }

    const accountIds = accounts.map((a) => a.id);

    // Fetch related stats in parallel
    const [customersRes, ordersRes, conversationsRes, messagesRes] = await Promise.all([
      supabase.from("customers").select("account_id").in("account_id", accountIds),
      supabase
        .from("orders")
        .select("account_id, total, payment_status")
        .in("account_id", accountIds),
      supabase
        .from("conversations")
        .select("account_id, last_message_at")
        .in("account_id", accountIds),
      supabase
        .from("messages")
        .select("account_id, created_at")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    // Aggregate stats per account
    const customerCounts = {};
    (customersRes.data || []).forEach((c) => {
      customerCounts[c.account_id] = (customerCounts[c.account_id] || 0) + 1;
    });

    const orderCounts = {};
    const revenueByAccount = {};
    (ordersRes.data || []).forEach((o) => {
      orderCounts[o.account_id] = (orderCounts[o.account_id] || 0) + 1;
      if (o.payment_status === "paid") {
        revenueByAccount[o.account_id] = (revenueByAccount[o.account_id] || 0) + (parseFloat(o.total) || 0);
      }
    });

    const lastActivityByAccount = {};
    (conversationsRes.data || []).forEach((c) => {
      if (!lastActivityByAccount[c.account_id] || c.last_message_at > lastActivityByAccount[c.account_id]) {
        lastActivityByAccount[c.account_id] = c.last_message_at;
      }
    });
    (messagesRes.data || []).forEach((m) => {
      if (m.account_id && (!lastActivityByAccount[m.account_id] || m.created_at > lastActivityByAccount[m.account_id])) {
        lastActivityByAccount[m.account_id] = m.created_at;
      }
    });

    // Merge stats into accounts
    const enrichedAccounts = accounts.map((a) => ({
      ...a,
      customer_count: customerCounts[a.id] || 0,
      order_count: orderCounts[a.id] || 0,
      total_revenue: Math.round((revenueByAccount[a.id] || 0) * 100) / 100,
      last_activity: lastActivityByAccount[a.id] || null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        accounts: enrichedAccounts,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error("Admin accounts list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
