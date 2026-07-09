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
 * GET /api/admin/system
 * System health and operational metrics
 */
export async function GET(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const supabase = getSupabase();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ─── Parallel data fetching ───
    const [
      auditLogsRes,
      auditLogsErrorsRes,
      rateLimitsRes,
      webhooksRes,
      // Table counts
      accountsCountRes,
      productsCountRes,
      customersCountRes,
      conversationsCountRes,
      messagesCountRes,
      ordersCountRes,
      campaignsCountRes,
      agentActionsCountRes,
      faqsCountRes,
      autoRepliesCountRes,
      teamMembersCountRes,
      accountWebhooksCountRes,
      broadcastLogsCountRes,
    ] = await Promise.all([
      // Webhook delivery stats — recent audit logs
      supabase
        .from("audit_logs")
        .select("event_type, created_at, details")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(5000),

      // Error logs — recent errors
      supabase
        .from("audit_logs")
        .select("event_type, details, created_at")
        .gte("created_at", dayAgo)
        .like("event_type", "%error%")
        .order("created_at", { ascending: false })
        .limit(100),

      // Rate limit hits
      supabase
        .from("rate_limits")
        .select("action, created_at")
        .gte("created_at", dayAgo),

      // Webhook delivery stats
      supabase
        .from("account_webhooks")
        .select("id, is_active, last_triggered_at, last_status_code, failure_count"),

      // Table counts
      supabase.from("accounts").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("messages").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }),
      supabase.from("agent_actions").select("id", { count: "exact", head: true }),
      supabase.from("faqs").select("id", { count: "exact", head: true }),
      supabase.from("auto_replies").select("id", { count: "exact", head: true }),
      supabase.from("team_members").select("id", { count: "exact", head: true }),
      supabase.from("account_webhooks").select("id", { count: "exact", head: true }),
      supabase.from("broadcast_logs").select("id", { count: "exact", head: true }),
    ]);

    // ─── Webhook Delivery Stats ───
    const webhooks = webhooksRes.data || [];
    const activeWebhooks = webhooks.filter((w) => w.is_active).length;
    const totalWebhooks = webhooks.length;
    const webhooksTriggeredToday = webhooks.filter(
      (w) => w.last_triggered_at && w.last_triggered_at >= dayAgo
    ).length;
    const webhookFailures = webhooks.reduce((sum, w) => sum + (w.failure_count || 0), 0);
    const webhookSuccessRate = totalWebhooks > 0
      ? Math.round(((totalWebhooks - webhooks.filter((w) => (w.failure_count || 0) > 3).length) / totalWebhooks) * 100)
      : 100;

    // ─── Audit Log Events ───
    const auditLogs = auditLogsRes.data || [];
    const eventsByType = {};
    auditLogs.forEach((log) => {
      eventsByType[log.event_type] = (eventsByType[log.event_type] || 0) + 1;
    });

    // Webhook-specific delivery stats from audit_logs
    const webhookEvents = auditLogs.filter((l) => l.event_type === "webhook_sent" || l.event_type === "webhook_failed");
    const webhookDelivered = auditLogs.filter((l) => l.event_type === "webhook_sent").length;
    const webhookFailed = auditLogs.filter((l) => l.event_type === "webhook_failed").length;
    const webhookDeliveryRate = (webhookDelivered + webhookFailed) > 0
      ? Math.round((webhookDelivered / (webhookDelivered + webhookFailed)) * 100)
      : null;

    // ─── Error Stats ───
    const errorLogs = auditLogsErrorsRes.data || [];
    const errorsByType = {};
    errorLogs.forEach((log) => {
      errorsByType[log.event_type] = (errorsByType[log.event_type] || 0) + 1;
    });
    const errorCount24h = errorLogs.length;

    // ─── Rate Limit Stats ───
    const rateLimits = rateLimitsRes.data || [];
    const rateLimitByAction = {};
    rateLimits.forEach((r) => {
      rateLimitByAction[r.action] = (rateLimitByAction[r.action] || 0) + 1;
    });
    const rateLimitHits24h = rateLimits.length;

    // ─── Database Table Sizes ───
    const tableSizes = {
      accounts: accountsCountRes.count || 0,
      products: productsCountRes.count || 0,
      customers: customersCountRes.count || 0,
      conversations: conversationsCountRes.count || 0,
      messages: messagesCountRes.count || 0,
      orders: ordersCountRes.count || 0,
      campaigns: campaignsCountRes.count || 0,
      agent_actions: agentActionsCountRes.count || 0,
      faqs: faqsCountRes.count || 0,
      auto_replies: autoRepliesCountRes.count || 0,
      team_members: teamMembersCountRes.count || 0,
      account_webhooks: accountWebhooksCountRes.count || 0,
      broadcast_logs: broadcastLogsCountRes.count || 0,
    };

    // ─── Active Connections Estimate ───
    // Based on accounts with recent activity
    const { count: activeAccountsToday } = await supabase
      .from("messages")
      .select("account_id", { count: "exact", head: true })
      .gte("created_at", dayAgo);

    // ─── System Uptime & Health ───
    const systemHealth = {
      status: "healthy",
      timestamp: now.toISOString(),
      database: "connected",
      version: "1.0.0",
    };

    // If there are too many errors, mark as degraded
    if (errorCount24h > 50) {
      systemHealth.status = "degraded";
    }

    return NextResponse.json({
      success: true,
      data: {
        health: systemHealth,
        webhooks: {
          total: totalWebhooks,
          active: activeWebhooks,
          triggeredToday: webhooksTriggeredToday,
          totalFailures: webhookFailures,
          successRate: webhookSuccessRate,
          deliveryRate: webhookDeliveryRate,
          delivered: webhookDelivered,
          failed: webhookFailed,
        },
        errors: {
          count24h: errorCount24h,
          byType: errorsByType,
          recent: errorLogs.slice(0, 20).map((e) => ({
            event_type: e.event_type,
            details: e.details,
            created_at: e.created_at,
          })),
        },
        rateLimits: {
          hits24h: rateLimitHits24h,
          byAction: rateLimitByAction,
        },
        database: {
          tableSizes,
          totalRecords: Object.values(tableSizes).reduce((a, b) => a + b, 0),
        },
        activeConnections: {
          accountsActiveToday: activeAccountsToday || 0,
        },
        auditEvents: {
          total: auditLogs.length,
          byType: eventsByType,
        },
      },
    });
  } catch (error) {
    console.error("Admin system error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
