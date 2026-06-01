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
const ADMIN_ACCOUNT_IDS = ["0643bcc3-d5ef-43e1-a1be-0b36de04ef92"];

async function verifyAdmin(request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey === process.env.ADMIN_SECRET_KEY) return true;

  const authHeader = request.headers.get("x-account-id");
  if (authHeader && ADMIN_ACCOUNT_IDS.includes(authHeader)) return true;

  return false;
}

/**
 * GET /api/admin/accounts/[id]
 * Full account details + all related data counts
 */
export async function GET(request, { params }) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const { id } = params;
    const supabase = getSupabase();

    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Fetch related counts in parallel
    const [customersRes, ordersRes, conversationsRes, messagesRes, productsRes, campaignsRes, faqsRes, autoRepliesRes, webhooksRes, teamMembersRes, agentActionsRes] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("orders").select("id, total, payment_status, status, created_at").eq("account_id", id),
      supabase.from("conversations").select("id, channel, status, created_at").eq("account_id", id),
      supabase.from("messages").select("id, direction, is_ai, created_at").eq("account_id", id),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("faqs").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("auto_replies").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("account_webhooks").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("team_members").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("agent_actions").select("id", { count: "exact", head: true }).eq("account_id", id),
    ]);

    const orders = ordersRes.data || [];
    const totalRevenue = orders
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

    const conversations = conversationsRes.data || [];
    const messages = messagesRes.data || [];

    // Conversations by channel
    const conversationsByChannel = { instagram: 0, facebook: 0, whatsapp: 0 };
    conversations.forEach((c) => {
      if (conversationsByChannel[c.channel] !== undefined) conversationsByChannel[c.channel]++;
    });

    // Conversations by status
    const conversationsByStatus = {};
    conversations.forEach((c) => {
      conversationsByStatus[c.status] = (conversationsByStatus[c.status] || 0) + 1;
    });

    // Messages breakdown
    const messageStats = {
      total: messages.length,
      incoming: messages.filter((m) => m.direction === "incoming").length,
      outgoing: messages.filter((m) => m.direction === "outgoing").length,
      ai: messages.filter((m) => m.is_ai).length,
      human: messages.filter((m) => !m.is_ai && m.direction === "outgoing").length,
    };

    // Orders by status
    const ordersByStatus = {};
    orders.forEach((o) => {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        account,
        stats: {
          customers: customersRes.count || 0,
          orders: orders.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          ordersByStatus,
          conversations: conversations.length,
          conversationsByChannel,
          conversationsByStatus,
          messages: messageStats,
          products: productsRes.count || 0,
          campaigns: campaignsRes.count || 0,
          faqs: faqsRes.count || 0,
          autoReplies: autoRepliesRes.count || 0,
          webhooks: webhooksRes.count || 0,
          teamMembers: teamMembersRes.count || 0,
          agentActions: agentActionsRes.count || 0,
        },
      },
    });
  } catch (error) {
    console.error("Admin account GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/accounts/[id]
 * Update account: plan, ban/suspend, toggle features
 */
export async function PATCH(request, { params }) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const supabase = getSupabase();

    // Build update object from allowed fields
    const allowedFields = [
      "plan",
      "plan_status",
      "ai_enabled",
      "auto_greeting",
      "auto_greeting_message",
      "auto_greeting_instagram",
      "auto_greeting_facebook",
      "auto_greeting_whatsapp",
      "auto_follow_up_enabled",
      "ai_personality",
      "ai_languages",
      "business_name",
      "industry",
      "country",
      "currency",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Handle ban/suspend via plan_status
    if (body.banned !== undefined) {
      updates.plan_status = body.banned ? "canceled" : "active";
    }
    if (body.suspended !== undefined) {
      updates.plan_status = body.suspended ? "past_due" : "active";
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Failed to update account", details: updateError.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { account: updated } });
  } catch (error) {
    console.error("Admin account PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/accounts/[id]
 * Suspend account (soft delete — sets plan_status to 'canceled')
 */
export async function DELETE(request, { params }) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const { id } = params;
    const supabase = getSupabase();

    // Soft delete: suspend the account
    const { data: suspended, error: suspendError } = await supabase
      .from("accounts")
      .update({
        plan_status: "canceled",
        ai_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, business_name, plan_status")
      .single();

    if (suspendError) {
      return NextResponse.json({ error: "Failed to suspend account", details: suspendError.message }, { status: 500 });
    }

    if (!suspended) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { account: suspended, message: "Account suspended successfully" },
    });
  } catch (error) {
    console.error("Admin account DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
