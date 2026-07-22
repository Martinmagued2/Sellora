/**
 * POST /api/webhooks/resend
 *
 * Receives Resend webhook events for email status tracking:
 *   - email.sent, email.delivered, email.bounced, email.complained,
 *     email.opened, email.clicked
 *
 * Updates email_log rows by resend_id and marks unsubscribes on complaints.
 *
 * SECURITY: Verifies the Svix signature using RESEND_WEBHOOK_SECRET.
 * Rejects all requests if the secret is unset (fail closed) — do NOT allow
 * "development mode" bypass, since attackers can exploit it to fake complaints
 * and auto-unsubscribe any user.
 *
 * Svix signature headers:
 *   - svix-id:          message ID
 *     - svix-timestamp:  unix seconds
 *   - svix-signature:   space-separated list of "v1,base64sig"
 *
 * Verification: HMAC-SHA256(secret, "${svix-id}.${svix-timestamp}.${rawBody}")
 * Compare with the v1,g suffixed signature using timingSafeEqual.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

let _admin = null;
function getAdmin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

/**
 * Verify Svix webhook signature.
 * Returns true if valid, false otherwise.
 *
 * @param {string} rawBody - the raw request body as a string
 * @param {object} headers - request headers (case-insensitive keys)
 * @param {string} secret - the RESEND_WEBHOOK_SECRET
 */
function verifySvixSignature(rawBody, headers, secret) {
  if (!secret) return false;

  // Svix secrets start with "whsec_" — strip the prefix for HMAC key
  const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;

  const msgId = headers["svix-id"] || headers["Svix-Id"];
  const msgTimestamp = headers["svix-timestamp"] || headers["Svix-Timestamp"];
  const msgSignatureHeader = headers["svix-signature"] || headers["Svix-Signature"];

  if (!msgId || !msgTimestamp || !msgSignatureHeader) return false;

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(msgTimestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) return false;

  // Build the signed payload
  const signedPayload = `${msgId}.${msgTimestamp}.${rawBody}`;

  // Expected signature: base64(HMAC-SHA256(key, signedPayload))
  const expectedSig = crypto
    .createHmac("sha256", key)
    .update(signedPayload)
    .digest("base64");

  // The header may contain multiple "v1,g,base64sig" entries separated by spaces.
  // We accept if ANY of them matches.
  const signatures = msgSignatureHeader.split(" ").map((s) => {
    const parts = s.split(",");
    // parts[0] = "v1", parts[1] = base64sig (or with "g" suffix)
    return parts.length >= 2 ? parts[1] : null;
  }).filter(Boolean);

  for (const sig of signatures) {
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expectedSig);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true;
      }
    } catch {
      // signature decode failed, skip
    }
  }
  return false;
}

export async function POST(req) {
  try {
    // SECURITY: Read the raw body BEFORE parsing JSON, because the signature
    // is computed over the raw bytes (not the re-serialized JSON).
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }

    // Verify Svix signature — fail closed if secret is unset
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[RESEND_WEBHOOK] RESEND_WEBHOOK_SECRET is not set — rejecting webhook (fail closed).");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Headers via req.headers (case-insensitive in Next.js)
    const headers = Object.fromEntries(req.headers.entries());
    const signatureValid = verifySvixSignature(rawBody, headers, webhookSecret);
    if (!signatureValid) {
      console.warn("[RESEND_WEBHOOK] Invalid signature — rejecting.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = body.type;
    const email = body.data?.email || body.data?.to || body.data?.recipient;
    const resendId = body.data?.email_id || body.data?.id;
    const createdAt = body.data?.created_at || new Date().toISOString();

    if (!eventType) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    const admin = getAdmin();

    // Update email_log by resend_id
    if (resendId) {
      const updates = {};
      switch (eventType) {
        case "email.sent":
          updates.status = "sent";
          break;
        case "email.delivered":
          updates.status = "delivered";
          updates.delivered_at = createdAt;
          break;
        case "email.bounced":
          updates.status = "bounced";
          updates.bounced_at = createdAt;
          updates.error = body.data?.error?.message || "Bounced";
          break;
        case "email.complained":
          updates.status = "complained";
          updates.complained_at = createdAt;
          break;
        case "email.opened":
          updates.opened_at = createdAt;
          break;
        case "email.clicked":
          updates.clicked_at = createdAt;
          break;
      }

      if (Object.keys(updates).length > 0) {
        await admin
          .from("email_log")
          .update(updates)
          .eq("resend_id", resendId);
      }
    }

    // On complaint, auto-unsubscribe
    if (eventType === "email.complained" && email) {
      await admin.from("email_unsubscribes").upsert(
        {
          email,
          template_type: "all",
          reason: "complaint",
          token: `complaint_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`,
        },
        { onConflict: "email,account_id,template_type" }
      );
      console.log(`[RESEND_WEBHOOK] Auto-unsubscribed ${email} (complaint)`);
    }

    return NextResponse.json({ received: true, eventType });
  } catch (e) {
    console.error("[RESEND_WEBHOOK] error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "Resend webhook receiver",
    events: [
      "email.sent",
      "email.delivered",
      "email.bounced",
      "email.complained",
      "email.opened",
      "email.clicked",
    ],
  });
}
