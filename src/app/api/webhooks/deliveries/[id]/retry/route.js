import { createClient } from "@/lib/supabase/server";
import { isWebhookUrlSafe } from "@/lib/webhooks";

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deliveryId = params.id;

    // Fetch the delivery record
    const { data: delivery, error: fetchError } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("id", deliveryId)
      .eq("account_id", user.id)
      .single();

    if (fetchError || !delivery) {
      return Response.json({ error: "Delivery not found" }, { status: 404 });
    }

    if (delivery.status === "success") {
      return Response.json({ error: "Cannot retry a successful delivery" }, { status: 400 });
    }

    // Fetch the webhook details
    const { data: webhook, error: whError } = await supabase
      .from("account_webhooks")
      .select("*")
      .eq("id", delivery.webhook_id)
      .single();

    if (whError || !webhook) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    // 🔒 SECURITY: SSRF protection — block internal/private URLs
    if (!isWebhookUrlSafe(webhook.url)) {
      return Response.json({ error: "Webhook URL is not safe (blocked by SSRF protection)" }, { status: 400 });
    }

    // Re-send the original payload
    const payload = delivery.payload || {};
    const body = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      "X-Sellora-Event": delivery.event,
    };

    // Sign the payload if a secret is set
    if (webhook.secret) {
      const crypto = await import("crypto");
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(body)
        .digest("hex");
      headers["X-Sellora-Signature"] = signature;
    }

    const startTime = Date.now();
    let responseStatus = 0;
    let responseBody = "";
    let newStatus = "failed";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      responseStatus = response.status;

      try {
        responseBody = await response.text();
        // Truncate response body if too long
        if (responseBody.length > 2000) {
          responseBody = responseBody.substring(0, 2000) + "...(truncated)";
        }
      } catch {
        responseBody = "";
      }

      newStatus = response.ok ? "success" : "failed";
    } catch (fetchErr) {
      responseStatus = 0;
      responseBody = fetchErr.message;
      newStatus = "failed";
    }

    const durationMs = Date.now() - startTime;
    const newAttempts = (delivery.attempts || 1) + 1;

    // Calculate next retry with exponential backoff
    let nextRetryAt = null;
    if (newStatus === "failed") {
      const backoffMinutes = [1, 5, 15][Math.min(newAttempts - 1, 2)] || 15;
      nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
    }

    // Update the delivery record
    const { error: updateError } = await supabase
      .from("webhook_deliveries")
      .update({
        status: newStatus === "failed" ? "retrying" : newStatus,
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: durationMs,
        attempts: newAttempts,
        next_retry_at: nextRetryAt,
      })
      .eq("id", deliveryId);

    if (updateError) {
      console.error("Failed to update delivery:", updateError);
    }

    // Update webhook status
    if (newStatus === "success") {
      await supabase
        .from("account_webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status_code: responseStatus,
          failure_count: 0,
        })
        .eq("id", webhook.id);
    } else {
      const newFailureCount = (webhook.failure_count || 0) + 1;
      const updates = {
        last_triggered_at: new Date().toISOString(),
        last_status_code: responseStatus,
        failure_count: newFailureCount,
      };
      // Auto-disable after 10 consecutive failures
      if (newFailureCount >= 10) {
        updates.is_active = false;
      }
      await supabase
        .from("account_webhooks")
        .update(updates)
        .eq("id", webhook.id);
    }

    return Response.json({
      success: true,
      delivery: {
        id: deliveryId,
        status: newStatus === "failed" ? "retrying" : newStatus,
        response_status: responseStatus,
        duration_ms: durationMs,
        attempts: newAttempts,
        next_retry_at: nextRetryAt,
      },
    });
  } catch (err) {
    console.error("Webhook retry error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
