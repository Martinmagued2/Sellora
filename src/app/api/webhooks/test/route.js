import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { dispatchWebhook } from "@/lib/webhooks";

// Service role client
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
 * POST /api/webhooks/test
 *
 * Sends a test payload to a specific webhook (or all webhooks for the account).
 * Body: { webhookId?, event? }
 *   - webhookId: specific webhook to test (optional, tests all if omitted)
 *   - event: event type to simulate (default: "order.created")
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
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

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { webhookId, event = "order.created" } = body;

    const supabase = getSupabase();

    // Fetch webhooks to test
    let webhooks = [];
    if (webhookId) {
      const { data, error } = await supabase
        .from("account_webhooks")
        .select("*")
        .eq("id", webhookId)
        .eq("account_id", user.id)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
      }
      webhooks = [data];
    } else {
      const { data, error } = await supabase
        .from("account_webhooks")
        .select("*")
        .eq("account_id", user.id)
        .eq("is_active", true);
      if (error || !data || data.length === 0) {
        return NextResponse.json({ error: "No active webhooks found" }, { status: 404 });
      }
      webhooks = data;
    }

    // Generate test payload based on event type
    const testPayloads = {
      "order.created": {
        orderId: "test-" + Date.now(),
        items: [{ name: "Test Product", price: 99.99, quantity: 1 }],
        total: 99.99,
        currency: "EGP",
        customer: { name: "Test Customer", phone: "+201000000000" },
        status: "pending",
        test: true,
      },
      "order.updated": {
        orderId: "test-" + Date.now(),
        status: "shipped",
        previousStatus: "pending",
        test: true,
      },
      "message.received": {
        conversationId: "test-conv-" + Date.now(),
        direction: "incoming",
        content: "This is a test message from Sellora webhook testing",
        type: "text",
        channel: "whatsapp",
        test: true,
      },
      "customer.created": {
        customerId: "test-cust-" + Date.now(),
        name: "Test Customer",
        channel: "whatsapp",
        test: true,
      },
    };

    const payload = testPayloads[event] || testPayloads["order.created"];

    // Send test to each matching webhook
    const results = await Promise.allSettled(
      webhooks
        .filter((wh) => !webhookId || wh.events?.includes(event))
        .map(async (wh) => {
          const body = JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            data: { ...payload, _test: true },
          });

          const headers = {
            "Content-Type": "application/json",
            "X-Sellora-Event": event,
            "X-Sellora-Test": "true",
          };

          // Sign if secret exists
          if (wh.secret) {
            const crypto = await import("crypto");
            const signature = crypto
              .createHmac("sha256", wh.secret)
              .update(body)
              .digest("hex");
            headers["X-Sellora-Signature"] = signature;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
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

            let responseBody = "";
            try {
              responseBody = await response.text();
              if (responseBody.length > 500) {
                responseBody = responseBody.substring(0, 500) + "...(truncated)";
              }
            } catch {
              responseBody = "";
            }

            // Update webhook status
            await supabase
              .from("account_webhooks")
              .update({
                last_triggered_at: new Date().toISOString(),
                last_status_code: response.status,
                failure_count: response.ok ? 0 : (wh.failure_count || 0) + 1,
              })
              .eq("id", wh.id);

            // Record delivery
            await supabase.from("webhook_deliveries").insert({
              account_id: user.id,
              webhook_id: wh.id,
              event,
              payload: { event, timestamp: new Date().toISOString(), data: payload },
              response_status: response.status,
              response_body: responseBody,
              duration_ms: durationMs,
              status: response.ok ? "success" : "failed",
              attempts: 1,
            });

            return {
              webhookId: wh.id,
              url: wh.url,
              status: response.status,
              ok: response.ok,
              durationMs,
              responseBody,
            };
          } catch (fetchError) {
            clearTimeout(timeout);
            const durationMs = Date.now() - startTime;

            await supabase.from("webhook_deliveries").insert({
              account_id: user.id,
              webhook_id: wh.id,
              event,
              payload: { event, timestamp: new Date().toISOString(), data: payload },
              response_status: 0,
              response_body: fetchError.message,
              duration_ms: durationMs,
              status: "failed",
              attempts: 1,
            });

            await supabase
              .from("account_webhooks")
              .update({
                last_triggered_at: new Date().toISOString(),
                last_status_code: 0,
                failure_count: (wh.failure_count || 0) + 1,
              })
              .eq("id", wh.id);

            return {
              webhookId: wh.id,
              url: wh.url,
              status: 0,
              ok: false,
              error: fetchError.message,
              durationMs,
            };
          }
        })
    );

    const summary = results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: r.reason?.message || "Unknown error" }
    );

    return NextResponse.json({
      success: true,
      event,
      results: summary,
    });
  } catch (err) {
    console.error("Webhook test error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
