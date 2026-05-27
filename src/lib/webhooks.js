/**
 * Webhook Dispatcher
 * 
 * Sends event payloads to registered webhook URLs when triggered.
 * Used by order creation, message events, etc.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Supported webhook events:
 * - order.created
 * - order.updated
 * - message.received
 * - customer.created
 */

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
    const { data: webhooks, error } = await supabase
      .from("account_webhooks")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_active", true);

    if (error || !webhooks || webhooks.length === 0) return;

    const matchingWebhooks = webhooks.filter(
      (wh) => wh.events && wh.events.includes(eventType)
    );

    if (matchingWebhooks.length === 0) return;

    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // Fire all webhooks in parallel (non-blocking)
    const results = await Promise.allSettled(
      matchingWebhooks.map(async (wh) => {
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

        try {
          const response = await fetch(wh.url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });

          clearTimeout(timeout);

          // Update last triggered status
          await supabase
            .from("account_webhooks")
            .update({
              last_triggered_at: new Date().toISOString(),
              last_status_code: response.status,
              failure_count: response.ok ? 0 : (wh.failure_count || 0) + 1,
            })
            .eq("id", wh.id);

          // Auto-disable after 10 consecutive failures
          if (!response.ok && (wh.failure_count || 0) + 1 >= 10) {
            await supabase
              .from("account_webhooks")
              .update({ is_active: false })
              .eq("id", wh.id);
            console.warn(`Webhook ${wh.id} auto-disabled after 10 failures.`);
          }

          return { id: wh.id, status: response.status, ok: response.ok };
        } catch (fetchError) {
          clearTimeout(timeout);

          await supabase
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
