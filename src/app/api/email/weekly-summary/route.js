/**
 * Weekly Summary Email Endpoint
 * POST /api/email/weekly-summary
 *
 * Sends a weekly performance summary email to a business owner.
 * Can be triggered by a cron job (admin auth) or manually (user session).
 *
 * Authentication: Requires either:
 *   1. Authenticated user session where accountId matches user.id, OR
 *   2. Admin auth via verifyAdmin (for cron-triggered emails)
 *
 * Rate limit: 1 email per account per 24 hours.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendWeeklySummaryEmail, isEmailConfigured } from "@/lib/email";
import { verifyAdmin } from "@/lib/admin-auth";

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
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return Response.json({ error: "accountId is required" }, { status: 400 });
    }

    // ── Authentication: user session or admin ──
    let isAuthenticated = false;
    let authMethod = null;

    // Check 1: User session where accountId matches user.id
    try {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { cookies: { getAll() { return cookieStore.getAll(); } } }
      );
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

      if (!authError && user && user.id === accountId) {
        isAuthenticated = true;
        authMethod = "session";
      }
    } catch {
      // Session check failed, continue to admin check
    }

    // Check 2: Admin auth (for cron-triggered emails)
    if (!isAuthenticated) {
      const adminCheck = await verifyAdmin(req);
      if (adminCheck.isAdmin) {
        isAuthenticated = true;
        authMethod = "admin";
      }
    }

    if (!isAuthenticated) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isEmailConfigured()) {
      return Response.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const supabase = getSupabase();

    // ── Rate limit: 1 email per account per 24 hours ──
    const { data: accountForRateLimit } = await supabase
      .from("accounts")
      .select("id, weekly_summary_sent_at")
      .eq("id", accountId)
      .single();

    if (accountForRateLimit?.weekly_summary_sent_at) {
      const lastSent = new Date(accountForRateLimit.weekly_summary_sent_at);
      const hoursSinceLastSent = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSent < 24) {
        return Response.json(
          { error: "Weekly summary already sent within the last 24 hours", retryAfterHours: Math.ceil(24 - hoursSinceLastSent) },
          { status: 429 }
        );
      }
    }

    // Get account info
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, email, business_name")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    // Calculate stats for the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Conversations count
    const { count: totalConversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .gte("created_at", oneWeekAgo);

    // AI replies count
    const { count: aiReplies } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("direction", "outgoing")
      .eq("is_ai", true)
      .gte("created_at", oneWeekAgo);

    // New customers
    const { count: newCustomers } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .gte("first_seen_at", oneWeekAgo);

    // Orders
    const { data: orders } = await supabase
      .from("orders")
      .select("total, currency")
      .eq("account_id", accountId)
      .gte("created_at", oneWeekAgo);

    const ordersCount = orders?.length || 0;
    const revenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    const currency = orders?.[0]?.currency || "EGP";

    // Average response time
    const { data: aiMessages } = await supabase
      .from("messages")
      .select("response_time_seconds")
      .eq("account_id", accountId)
      .eq("direction", "outgoing")
      .eq("is_ai", true)
      .gte("created_at", oneWeekAgo)
      .not("response_time_seconds", "is", null)
      .limit(100);

    const avgResponseTime = aiMessages?.length > 0
      ? Math.round(aiMessages.reduce((sum, m) => sum + (m.response_time_seconds || 0), 0) / aiMessages.length) + "s"
      : "N/A";

    const result = await sendWeeklySummaryEmail({
      to: account.email,
      businessName: account.business_name || "Your Store",
      accountId: account.id,
      stats: {
        totalConversations: totalConversations || 0,
        aiReplies: aiReplies || 0,
        newCustomers: newCustomers || 0,
        ordersCount,
        revenue,
        currency,
        avgResponseTime,
      },
    });

    // Update the weekly_summary_sent_at timestamp for rate limiting
    if (result.success) {
      await supabase
        .from("accounts")
        .update({ weekly_summary_sent_at: new Date().toISOString() })
        .eq("id", accountId);
    }

    return Response.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (err) {
    console.error("[WEEKLY-SUMMARY] Error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
