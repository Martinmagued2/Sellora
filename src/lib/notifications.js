/**
 * Central notification system — call notify() from any API route to fire
 * a notification for any action. Respects user preferences per category.
 *
 * Usage:
 *   import { notify } from "@/lib/notifications";
 *   await notify(user.id, {
 *     category: "orders",
 *     type: "new_order",
 *     title: "New order!",
 *     message: "Order #1234 for 250 EGP",
 *     priority: "high",
 *     actionUrl: "/dashboard/orders",
 *     actionLabel: "View Order",
 *   });
 *
 * Categories: orders, messages, payments, products, customers, reviews,
 *             team, channels, ai, automation, security, system
 *
 * Delivery channels per category (from account.notif_prefs):
 *   - dashboard: always creates a row in notifications table
 *   - push: sends a web push notification (if subscribed)
 *   - email: sends an email (if email is configured)
 */

import { createClient } from "@supabase/supabase-js";

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

const VALID_CATEGORIES = [
  "orders", "messages", "payments", "products", "customers",
  "reviews", "team", "channels", "ai", "automation", "security", "system",
];

const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

/**
 * Fire a notification. Respects user preferences.
 *
 * @param {string} accountId - The account to notify
 * @param {Object} params
 * @param {string} params.category - One of VALID_CATEGORIES
 * @param {string} params.type - Notification type (e.g. "new_order", "payment_received")
 * @param {string} params.title - Short title
 * @param {string} [params.message] - Longer description
 * @param {string} [params.priority] - low|normal|high|urgent (default: normal)
 * @param {string} [params.actionUrl] - URL to navigate to when clicked
 * @param {string} [params.actionLabel] - Label for the action button
 * @param {Object} [params.data] - Additional structured data
 * @param {string} [params.related_id] - UUID of related entity
 * @param {string} [params.related_type] - Type of related entity
 * @returns {Promise<{success: boolean, notification?: object, error?: string}>}
 */
export async function notify(accountId, params) {
  if (!accountId || !params?.category || !params?.type || !params?.title) {
    return { success: false, error: "Missing required fields: accountId, category, type, title" };
  }

  const {
    category, type, title, message, priority = "normal",
    actionUrl, actionLabel, data = {}, related_id, related_type,
    userId, // optional — targets a specific team member
  } = params;

  if (!VALID_CATEGORIES.includes(category)) {
    return { success: false, error: `Invalid category: ${category}` };
  }
  if (!VALID_PRIORITIES.includes(priority)) {
    return { success: false, error: `Invalid priority: ${priority}` };
  }

  const db = admin();

  // 1. Fetch the account's notification preferences for this category
  let prefs = { dashboard: true, push: false, email: false };
  let accountEmail = null;
  try {
    const { data: account } = await db.from("accounts")
      .select("notif_prefs, email")
      .eq("id", accountId)
      .maybeSingle();
    if (account?.notif_prefs && typeof account.notif_prefs === "object") {
      const catPrefs = account.notif_prefs[category];
      if (catPrefs) prefs = { ...prefs, ...catPrefs };
    }
    if (account?.email) accountEmail = account.email;
    if (accountEmail) data._account_email = accountEmail;
  } catch (e) {
    console.warn("[notify] Failed to fetch prefs:", e.message);
  }

  // If userId is provided, also fetch the team member's email for direct notification
  let targetEmail = accountEmail;
  if (userId && userId !== accountId) {
    try {
      const { data: tm } = await db.from("team_members")
        .select("email, invited_email")
        .eq("user_id", userId)
        .eq("account_id", accountId)
        .maybeSingle();
      if (tm?.email || tm?.invited_email) {
        targetEmail = tm.email || tm.invited_email;
        data._target_email = targetEmail;
      }
    } catch (e) {
      console.warn("[notify] Failed to fetch team member email:", e.message);
    }
  }

  let notification = null;

  // 2. Dashboard notification (always create unless explicitly disabled)
  if (prefs.dashboard !== false) {
    try {
      const { data: inserted, error } = await db.from("notifications").insert({
        account_id: accountId,
        user_id: userId || null,
        type,
        title: title.slice(0, 200),
        message: message ? message.slice(0, 1000) : null,
        category,
        priority,
        action_url: actionUrl || null,
        action_label: actionLabel || null,
        data,
        related_id: related_id || null,
        related_type: related_type || null,
        read: false,
      }).select().single();

      if (error) {
        console.error("[notify] Insert failed:", error.message);
      } else {
        notification = inserted;
      }
    } catch (e) {
      console.error("[notify] Dashboard insert error:", e.message);
    }
  }

  // 3. Push notification (best-effort, non-blocking)
  if (prefs.push) {
    try {
      await sendPushNotification(db, accountId, title, message, actionUrl, priority);
    } catch (e) {
      console.warn("[notify] Push failed:", e.message);
    }
  }

  // 4. Email notification (best-effort, non-blocking)
  if (prefs.email && data._account_email) {
    try {
      await sendEmailNotification(
        data._account_email,
        title,
        message,
        category,
        priority,
        accountId,
        url
      );
    } catch (e) {
      console.warn("[notify] Email failed:", e.message);
    }
  }

  return { success: true, notification };
}

/**
 * Get the user's notification preferences (for the dashboard UI).
 */
export async function getNotifPrefs(accountId) {
  const db = admin();
  const { data: account } = await db.from("accounts")
    .select("notif_prefs").eq("id", accountId).maybeSingle();
  return account?.notif_prefs || null;
}

/**
 * Update the user's notification preferences.
 */
export async function updateNotifPrefs(accountId, prefs) {
  const db = admin();
  // Validate structure
  const sanitized = {};
  for (const cat of VALID_CATEGORIES) {
    if (prefs[cat] && typeof prefs[cat] === "object") {
      sanitized[cat] = {
        dashboard: Boolean(prefs[cat].dashboard),
        push: Boolean(prefs[cat].push),
        email: Boolean(prefs[cat].email),
      };
    }
  }
  const { error } = await db.from("accounts")
    .update({ notif_prefs: sanitized }).eq("id", accountId);
  if (error) return { success: false, error: error.message };
  return { success: true, prefs: sanitized };
}

// ─── Push notification ───
async function sendPushNotification(db, accountId, title, message, url, priority) {
  const { data: subs } = await db.from("push_subscriptions")
    .select("endpoint, keys")
    .eq("account_id", accountId)
    .eq("active", true)
    .limit(10);
  if (!subs || subs.length === 0) return;

  // Use the existing push send endpoint
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        title,
        body: message || "",
        url: url || "/dashboard/notifications",
        tag: priority === "urgent" ? "urgent" : "default",
      }),
    });
  } catch (e) {
    // Push is best-effort
  }
}

// ─── Email notification ───
async function sendEmailNotification(to, title, message, category, priority, accountId, url) {
  try {
    const { sendNotificationEmail, isEmailConfigured } = await import("@/lib/email");
    if (!isEmailConfigured()) return;
    const priorityLabel = priority === "urgent" ? "🚨 URGENT: " : priority === "high" ? "⚠️ " : "";
    await sendNotificationEmail({
      to,
      title: `${priorityLabel}${title}`,
      body: message || "",
      category,
      accountId,
      ctaLink: url ? (url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_APP_URL || "https://sellorachat.com"}${url}`) : null,
      ctaLabel: url ? "View Details →" : null,
    });
  } catch (e) {
    console.warn("[NOTIFY] email send failed:", e.message);
  }
}
