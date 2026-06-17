/**
 * CSV Export API
 * GET /api/export?type=orders&range=30d
 *
 * Exports account data as CSV. Pro+ feature (csv_export: true).
 *
 * Supported types:
 *   - orders         — order_number, customer, total, status, payment_status, created_at
 *   - customers      — name, email, phone, channel, total_orders, total_spent, created_at
 *   - conversations  — customer, channel, status, message_count, last_message_at, resolved_by
 *   - products       — name, price, stock, category, status, created_at
 *   - reviews        — product, rating, status, body, created_at
 *   - ai_feedback    — message_id, rating, reason, conversation_id, created_at
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { getPlanLimits } from "@/lib/plan-limits";

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

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, "all": null };

function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  // Escape double-quotes and wrap in quotes if it contains commas, quotes, or newlines
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows, columns) {
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCSV(c.get(row))).join(",")
  ).join("\n");
  return `${header}\n${body}`;
}

const EXPORT_CONFIG = {
  orders: {
    label: "Orders",
    columns: [
      { label: "Order #", get: (r) => r.order_number },
      { label: "Customer", get: (r) => r.customer?.name || r.customer_name || "" },
      { label: "Channel", get: (r) => r.channel },
      { label: "Items", get: (r) => (r.items || []).length },
      { label: "Total", get: (r) => r.total },
      { label: "Currency", get: (r) => r.currency },
      { label: "Status", get: (r) => r.status },
      { label: "Payment Status", get: (r) => r.payment_status },
      { label: "Payment Method", get: (r) => r.payment_method || "" },
      { label: "Created At", get: (r) => r.created_at },
    ],
  },
  customers: {
    label: "Customers",
    columns: [
      { label: "Name", get: (r) => r.name },
      { label: "Email", get: (r) => r.email || "" },
      { label: "Phone", get: (r) => r.phone || "" },
      { label: "Channel", get: (r) => r.channel },
      { label: "Tags", get: (r) => (r.tags || []).join(";") },
      { label: "Total Orders", get: (r) => r.total_orders || 0 },
      { label: "Total Spent", get: (r) => r.total_spent || 0 },
      { label: "LTV", get: (r) => r.lifetime_value || 0 },
      { label: "VIP", get: (r) => r.vip ? "Yes" : "No" },
      { label: "Created At", get: (r) => r.created_at },
    ],
  },
  conversations: {
    label: "Conversations",
    columns: [
      { label: "Customer", get: (r) => r.customer?.name || "" },
      { label: "Channel", get: (r) => r.channel },
      { label: "Status", get: (r) => r.status },
      { label: "Assigned To", get: (r) => r.assigned_to || "" },
      { label: "AI Paused", get: (r) => r.ai_paused ? "Yes" : "No" },
      { label: "Resolved By", get: (r) => r.resolved_by || "" },
      { label: "Unread Count", get: (r) => r.unread_count || 0 },
      { label: "Last Message At", get: (r) => r.last_message_at },
      { label: "Created At", get: (r) => r.created_at },
    ],
  },
  products: {
    label: "Products",
    columns: [
      { label: "Name", get: (r) => r.name },
      { label: "Price", get: (r) => r.price },
      { label: "Stock", get: (r) => r.stock },
      { label: "Category", get: (r) => r.category || "" },
      { label: "Status", get: (r) => r.status },
      { label: "Description", get: (r) => r.description || "" },
      { label: "Created At", get: (r) => r.created_at },
    ],
  },
  reviews: {
    label: "Reviews",
    columns: [
      { label: "Product", get: (r) => r.products?.name || "" },
      { label: "Customer", get: (r) => r.customers?.name || "" },
      { label: "Rating", get: (r) => r.rating },
      { label: "Title", get: (r) => r.title || "" },
      { label: "Body", get: (r) => r.body || "" },
      { label: "Status", get: (r) => r.status },
      { label: "Source", get: (r) => r.source },
      { label: "Reply", get: (r) => r.reply || "" },
      { label: "Created At", get: (r) => r.created_at },
    ],
  },
  ai_feedback: {
    label: "AI Feedback",
    columns: [
      { label: "Message ID", get: (r) => r.message_id },
      { label: "Conversation ID", get: (r) => r.conversation_id },
      { label: "Rating", get: (r) => r.rating },
      { label: "Reason", get: (r) => r.reason || "" },
      { label: "Operator ID", get: (r) => r.operator_id },
      { label: "Created At", get: (r) => r.created_at },
    ],
  },
};

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Plan gate
    const { data: account } = await getAdminClient()
      .from("accounts")
      .select("plan")
      .eq("id", user.id)
      .single();
    const planLimits = getPlanLimits(account?.plan || "starter");
    if (!planLimits.csv_export) {
      return NextResponse.json(
        { error: "CSV export is available on Professional and Business plans. Upgrade to unlock." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "orders";
    const rangeKey = searchParams.get("range") || "30d";
    const days = RANGE_DAYS[rangeKey];

    const config = EXPORT_CONFIG[type];
    if (!config) {
      return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
    }

    const admin = getAdminClient();
    const since = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;

    let query = admin.from(type).select("*").eq("account_id", user.id).order("created_at", { ascending: false }).limit(10000);
    if (since) query = query.gte("created_at", since);

    // Special joins
    if (type === "orders") {
      query = admin.from("orders")
        .select("*, customer:customers(name)")
        .eq("account_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (since) query = query.gte("created_at", since);
    } else if (type === "conversations") {
      query = admin.from("conversations")
        .select("*, customer:customers(name)")
        .eq("account_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (since) query = query.gte("created_at", since);
    } else if (type === "reviews") {
      query = admin.from("product_reviews")
        .select("*, products!inner(name), customers(name)")
        .eq("account_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (since) query = query.gte("created_at", since);
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const csv = toCSV(rows || [], config.columns);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sellora-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error("[EXPORT] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
