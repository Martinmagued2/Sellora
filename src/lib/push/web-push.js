/**
 * Web Push notification library — uses VAPID keys (not the broken fake-key approach).
 *
 * To enable:
 *   1. npm install web-push
 *   2. Generate VAPID keys:
 *        const webpush = require('web-push');
 *        webpush.generateVAPIDKeys();
 *      → returns { publicKey, privateKey }
 *   3. Set env vars:
 *        VAPID_PUBLIC_KEY=BPa... (public, exposed to client)
 *        VAPID_PRIVATE_KEY=abc... (server-only)
 *        VAPID_SUBJECT=mailto:support@sellora.com
 *
 * This module auto-degrades to no-op if web-push isn't installed.
 */

let webpush = null;
let _loaded = false;

async function loadWebPush() {
  if (_loaded) return webpush;
  _loaded = true;
  try {
    webpush = (await import("web-push")).default;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:support@sellora.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } else {
      webpush = null;
    }
  } catch (e) {
    webpush = null;
  }
  return webpush;
}

export async function getVapidPublicKey() {
  if (!process.env.VAPID_PUBLIC_KEY) return null;
  return process.env.VAPID_PUBLIC_KEY;
}

export async function sendPushNotification(subscription, payload) {
  const wp = await loadWebPush();
  if (!wp) return false;

  try {
    await wp.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys?.p256dh || subscription.p256dh,
          auth: subscription.keys?.auth || subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/dashboard",
        icon: payload.icon || "/logo.png",
        badge: "/logo.png",
        tag: payload.tag || "sellora-notification",
        data: payload.data || {},
      })
    );
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { expired: true };
    }
    console.warn("[PUSH] send failed:", err.message);
    return false;
  }
}

export async function broadcastPushToAccount(supabase, accountId, payload) {
  const wp = await loadWebPush();
  if (!wp) return { sent: 0, skipped: true };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("account_id", accountId);

  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  const expiredIds = [];

  await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      if (result === true) sent++;
      else if (result && result.expired) expiredIds.push(sub.id);
    })
  );

  if (expiredIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expiredIds);
  }

  await supabase
    .from("push_subscriptions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("account_id", accountId);

  return { sent, expired: expiredIds.length };
}
