/**
 * Notifications API
 * 
 * GET  /api/notifications — List unread notifications for the authenticated user
 * POST /api/notifications — Mark notifications as read
 * 
 * Notifications are created by the AI escalation system and stored in the
 * `notifications` table. The owner sees them in the notification panel.
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

/**
 * GET — Fetch notifications for the authenticated user
 */
export async function GET(req) {
  try {
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
    if (authError || !user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Find the user's account
    const adminClient = getAdminClient();
    const { data: account } = await adminClient
      .from("accounts")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!account) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type"); // e.g., "ai_escalation"

    let query = adminClient
      .from("notifications")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error("[NOTIFICATIONS] Fetch error:", error.message);
      return Response.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await adminClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("account_id", account.id)
      .eq("read", false);

    return Response.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
    });
  } catch (err) {
    console.error("[NOTIFICATIONS] Error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST — Mark notifications as read
 * Body: { notificationIds?: string[], markAllRead?: boolean }
 */
export async function POST(req) {
  try {
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
    if (authError || !user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = getAdminClient();
    const { data: account } = await adminClient
      .from("accounts")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!account) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const body = await req.json();
    const { notificationIds, markAllRead } = body;

    if (markAllRead) {
      await adminClient
        .from("notifications")
        .update({ read: true })
        .eq("account_id", account.id)
        .eq("read", false);
    } else if (notificationIds && notificationIds.length > 0) {
      await adminClient
        .from("notifications")
        .update({ read: true })
        .in("id", notificationIds)
        .eq("account_id", account.id);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[NOTIFICATIONS] Mark read error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
