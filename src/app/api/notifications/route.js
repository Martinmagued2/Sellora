/**
 * Notifications API
 * 
 * GET    /api/notifications — Fetch notifications (with pagination, filters)
 * POST   /api/notifications — Create a new notification
 * PATCH  /api/notifications — Mark notification(s) as read
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getAuthenticatedUser(req) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, error: "Not authenticated" };

  const adminClient = getAdminClient();
  const { data: account } = await adminClient
    .from("accounts")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!account) return { user: null, error: "Account not found" };

  return { user, accountId: account.id, error: null };
}

/**
 * GET — Fetch notifications for the authenticated user
 * Query params:
 *   unread  — "true" to fetch only unread
 *   type    — filter by notification type (e.g., "new_order", "ai_escalation")
 *   limit   — page size (default 20)
 *   offset  — pagination offset (default 0)
 */
export async function GET(req) {
  try {
    const { accountId, error } = await getAuthenticatedUser(req);
    if (error) {
      return Response.json({ error }, { status: error === "Not authenticated" ? 401 : 404 });
    }

    const adminClient = getAdminClient();
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const type = searchParams.get("type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build main query
    let query = adminClient
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    if (type) {
      // Support comma-separated types for the notifications page filter
      const types = type.split(",").map(t => t.trim()).filter(Boolean);
      if (types.length === 1) {
        query = query.eq("type", types[0]);
      } else if (types.length > 1) {
        query = query.in("type", types);
      }
    }

    const { data: notifications, count, error: fetchError } = await query;

    if (fetchError) {
      console.error("[NOTIFICATIONS] Fetch error:", fetchError.message);
      return Response.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await adminClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("read", false);

    return Response.json({
      notifications: notifications || [],
      total: count || 0,
      unread_count: unreadCount || 0,
      has_more: (offset + limit) < (count || 0),
    });
  } catch (err) {
    console.error("[NOTIFICATIONS] Error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST — Create a new notification
 * Body: { type, title, message?, account_id, related_id?, related_type?, data? }
 * 
 * Can be called by:
 *   - System (with service role)
 *   - Other API routes (with authenticated user, using their own account_id)
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { type, title, message, account_id, related_id, related_type, data } = body;

    // Validate required fields
    if (!type || !title) {
      return Response.json({ error: "Missing required fields: type, title" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // If account_id is provided (system/internal call), use it directly
    // Otherwise, authenticate the user
    let targetAccountId = account_id;

    if (!targetAccountId) {
      const { accountId, error } = await getAuthenticatedUser(req);
      if (error) {
        return Response.json({ error }, { status: error === "Not authenticated" ? 401 : 404 });
      }
      targetAccountId = accountId;
    }

    // Validate notification type
    const validTypes = [
      "new_order", "new_message", "ai_escalation", "payment_received",
      "low_stock", "campaign_sent", "team_invite", "system"
    ];
    if (!validTypes.includes(type)) {
      return Response.json({ error: `Invalid notification type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const notification = {
      account_id: targetAccountId,
      type,
      title,
      message: message || null,
      related_id: related_id || null,
      related_type: related_type || null,
      data: data || {},
      read: false,
    };

    const { data: inserted, error: insertError } = await adminClient
      .from("notifications")
      .insert(notification)
      .select()
      .single();

    if (insertError) {
      console.error("[NOTIFICATIONS] Insert error:", insertError.message);
      return Response.json({ error: "Failed to create notification" }, { status: 500 });
    }

    return Response.json({ notification: inserted }, { status: 201 });
  } catch (err) {
    console.error("[NOTIFICATIONS] Create error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH — Mark notification(s) as read
 * Body: { notification_id?: string, mark_all?: boolean }
 * 
 * - If mark_all is true, marks all unread notifications as read
 * - If notification_id is provided, marks that specific notification as read
 */
export async function PATCH(req) {
  try {
    const { accountId, error } = await getAuthenticatedUser(req);
    if (error) {
      return Response.json({ error }, { status: error === "Not authenticated" ? 401 : 404 });
    }

    const adminClient = getAdminClient();
    const body = await req.json();
    const { notification_id, mark_all } = body;

    if (mark_all) {
      const { error: updateError } = await adminClient
        .from("notifications")
        .update({ read: true })
        .eq("account_id", accountId)
        .eq("read", false);

      if (updateError) {
        console.error("[NOTIFICATIONS] Mark all read error:", updateError.message);
        return Response.json({ error: "Failed to mark all as read" }, { status: 500 });
      }

      return Response.json({ success: true, marked: "all" });
    } else if (notification_id) {
      const { error: updateError } = await adminClient
        .from("notifications")
        .update({ read: true })
        .eq("id", notification_id)
        .eq("account_id", accountId);

      if (updateError) {
        console.error("[NOTIFICATIONS] Mark read error:", updateError.message);
        return Response.json({ error: "Failed to mark as read" }, { status: 500 });
      }

      return Response.json({ success: true, marked: notification_id });
    } else {
      return Response.json({ error: "Provide notification_id or mark_all: true" }, { status: 400 });
    }
  } catch (err) {
    console.error("[NOTIFICATIONS] Mark read error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
