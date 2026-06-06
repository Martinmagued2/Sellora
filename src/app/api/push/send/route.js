import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// VAPID keys - in production, these should be environment variables
// For now we generate them deterministically from a secret
const VAPID_SUBJECT = "mailto:support@sellora.com";

function getVapidKeys() {
  // In production, use environment variables:
  // VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  // Generate deterministic keys for development
  const secret = process.env.NEXT_PUBLIC_SUPABASE_URL || "sellora-vapid-secret";
  const hash = crypto.createHash("sha256").update(secret).digest();
  const privateKey = hash.toString("base64url");

  // Derive public key from private key (simplified)
  const publicKey = crypto
    .createHash("sha256")
    .update(hash)
    .digest()
    .toString("base64url");

  return { publicKey, privateKey };
}

function createVapidHeaders(targetUrl) {
  const keys = getVapidKeys();
  const url = new URL(targetUrl);
  const origin = `${url.protocol}//${url.host}`;

  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };

  // Simplified JWT creation (in production use a proper VAPID library)
  const encodedHeader = Buffer.from(JSON.stringify(header))
    .toString("base64url")
    .replace(/=/g, "");
  const encodedPayload = Buffer.from(JSON.stringify(payload))
    .toString("base64url")
    .replace(/=/g, "");

  const signInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", keys.privateKey)
    .update(signInput)
    .digest("base64url")
    .replace(/=/g, "");

  const jwt = `${signInput}.${signature}`;

  return {
    Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
  };
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId, title, body, url, icon } = await request.json();

    if (!accountId) {
      return Response.json({ error: "Account ID required" }, { status: 400 });
    }

    // Get push subscriptions for the target account
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("account_id", accountId);

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({ message: "No push subscriptions found for this account", sent: 0 });
    }

    const results = [];
    for (const sub of subscriptions) {
      try {
        const pushMessage = {
          title: title || "Sellora Notification",
          body: body || "You have a new notification",
          icon: icon || "/logo.png",
          url: url || "/dashboard",
        };

        // In production, use web-push library to send the notification
        // For now, we attempt to send via the Push API protocol
        const vapidHeaders = createVapidHeaders(sub.endpoint);

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            ...vapidHeaders,
          },
          body: JSON.stringify(pushMessage),
        }).catch(() => null);

        if (response && response.ok) {
          results.push({ endpoint: sub.endpoint, status: "sent" });
        } else {
          // If push fails (e.g., subscription expired), remove it
          if (response && (response.status === 404 || response.status === 410)) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }
          results.push({ endpoint: sub.endpoint, status: "failed" });
        }
      } catch (err) {
        results.push({ endpoint: sub.endpoint, status: "error", error: err.message });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    return Response.json({ sent, total: subscriptions.length, results });
  } catch (err) {
    console.error("Push send error:", err);
    return Response.json({ error: "Failed to send push notification" }, { status: 500 });
  }
}

// GET: Return VAPID public key for client-side push subscription
export async function GET() {
  const keys = getVapidKeys();
  return Response.json({ publicKey: keys.publicKey });
}
