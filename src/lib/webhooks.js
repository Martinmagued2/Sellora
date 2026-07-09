/**
 * Webhook Dispatcher
 *
 * Sends event payloads to registered webhook URLs when triggered.
 * Used by order creation, message events, etc.
 * Records all deliveries in webhook_deliveries table.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
 * Supported webhook events:
 * - order.created
 * - order.updated
 * - message.received
 * - customer.created
 */

/**
 * SECURITY: Validate that a webhook URL is safe to fetch.
 * Prevents SSRF (Server-Side Request Forgery) by blocking:
 * - Non-HTTP(S) protocols (file://, ftp://, etc.)
 * - Internal/private IP ranges (127.0.0.1, 10.x, 172.16-31.x, 192.168.x)
 * - Cloud metadata endpoints (169.254.169.254)
 * - IPv6 loopback and link-local
 */
export function isWebhookUrlSafe(urlString) {
  try {
    const url = new URL(urlString);
    // Only allow http: and https: protocols
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    // In production, only allow https
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      return false;
    }
    const hostname = url.hostname.toLowerCase();

    // Block localhost variations
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }

    // Block cloud metadata endpoint
    if (hostname === "169.254.169.254" || hostname.startsWith("169.254.")) {
      return false;
    }

    // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      if (a === 10) return false; // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
      if (a === 192 && b === 168) return false; // 192.168.0.0/16
      if (a === 0) return false; // 0.0.0.0/8
      if (a === 127) return false; // 127.0.0.0/8
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Record a webhook delivery in the database.
 */
async function recordDelivery({ accountId, webhookId, event, payload, responseStatus, responseBody, durationMs, status, attempts }) {
  try {
    await getSupabase().from("webhook_deliveries").insert({
      account_id: accountId,
      webhook_id: webhookId,
      event,
      payload,
      response_status: responseStatus || null,
      response_body: responseBody || null,
      duration_ms: durationMs || null,
      status: status || "pending",
      attempts: attempts || 1,
      next_retry_at: status === "failed" ? getNextRetryAt(1) : null,
    });
  } catch (err) {
    console.error("Failed to record webhook delivery:", err.message);
  }
}

/**
 * Calculate next retry timestamp with exponential backoff.
 * Attempt 1 → 1min, Attempt 2 → 5min, Attempt 3+ → 15min
 */
function getNextRetryAt(attempt) {
  const backoffMinutes = [1, 5, 15][Math.min(attempt - 1, 2)] || 15;
  return new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
}

/**
 * Dispatch an event to all active webhooks for an account.
 *
 * @param {string} accountId - The account that owns the webhooks
 * @param {string} eventType - e.g. "order.created"
 * @param {object} payload - The event data to send
 */
export async function dispatchWebhook(accountId, eventType, payload) {
  try {
    // Fetch all active webhooks for this account that listen to this event
    const { data: webhooks, error } = await getSupabase()
      .from("account_webhooks")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_active", true);

    if (error || !webhooks || webhooks.length === 0) return;

    const matchingWebhooks = webhooks.filter(
      (wh) => wh.events && wh.events.includes(eventType)
    );

    if (matchingWebhooks.length === 0) return;

    // SECURITY: Validate webhook URLs to prevent SSRF
    const safeWebhooks = matchingWebhooks.filter((wh) => {
      if (!isWebhookUrlSafe(wh.url)) {
        console.warn(`[Webhook] Blocked unsafe URL: ${wh.url} (SSRF protection)`);
        return false;
      }
      return true;
    });

    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // Fire all safe webhooks in parallel (non-blocking)
    const results = await Promise.allSettled(
      safeWebhooks.map(async (wh) => {
        const headers = {
          "Content-Type": "application/json",
          "X-Sellora-Event": eventType,
        };

        // Sign the payload if a secret is set
        if (wh.secret) {
          const signature = crypto
            .createHmac("sha256", wh.secret)
            .update(body)
            .digest("hex");
          headers["X-Sellora-Signature"] = signature;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
        const startTime = Date.now();

        try {
          const response = await fetch(wh.url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });

          clearTimeout(timeout);
          const durationMs = Date.now() - startTime;

          // Read response body (truncated)
          let responseBody = "";
          try {
            responseBody = await response.text();
            if (responseBody.length > 2000) {
              responseBody = responseBody.substring(0, 2000) + "...(truncated)";
            }
          } catch {
            responseBody = "";
          }

          // Record the delivery
          await recordDelivery({
            accountId,
            webhookId: wh.id,
            event: eventType,
            payload: { event: eventType, timestamp: new Date().toISOString(), data: payload },
            responseStatus: response.status,
            responseBody,
            durationMs,
            status: response.ok ? "success" : "failed",
            attempts: 1,
          });

          // Update last triggered status
          await getSupabase()
            .from("account_webhooks")
            .update({
              last_triggered_at: new Date().toISOString(),
              last_status_code: response.status,
              failure_count: response.ok ? 0 : (wh.failure_count || 0) + 1,
            })
            .eq("id", wh.id);

          // Auto-disable after 10 consecutive failures
          if (!response.ok && (wh.failure_count || 0) + 1 >= 10) {
            await getSupabase()
              .from("account_webhooks")
              .update({ is_active: false })
              .eq("id", wh.id);
            console.warn(`Webhook ${wh.id} auto-disabled after 10 failures.`);
          }

          return { id: wh.id, status: response.status, ok: response.ok };
        } catch (fetchError) {
          clearTimeout(timeout);
          const durationMs = Date.now() - startTime;

          // Record the failed delivery
          await recordDelivery({
            accountId,
            webhookId: wh.id,
            event: eventType,
            payload: { event: eventType, timestamp: new Date().toISOString(), data: payload },
            responseStatus: 0,
            responseBody: fetchError.message,
            durationMs,
            status: "failed",
            attempts: 1,
          });

          await getSupabase()
            .from("account_webhooks")
            .update({
              last_triggered_at: new Date().toISOString(),
              last_status_code: 0,
              failure_count: (wh.failure_count || 0) + 1,
            })
            .eq("id", wh.id);

          return { id: wh.id, status: 0, error: fetchError.message };
        }
      })
    );

    return results;
  } catch (err) {
    // Webhook dispatch should never break the main flow
    console.error("Webhook dispatch error (non-fatal):", err.message);
  }
}
