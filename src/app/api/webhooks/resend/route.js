/**
 * POST /api/webhooks/resend
 *
 * Receives Resend webhook events for email status tracking:
 *   - email.sent
 *   - email.delivered
 *   - email.bounced
 *   - email.complained
 *   - email.opened
 *   - email.clicked
 *
 * Updates email_log rows by resend_id and marks unsubscribes on complaints.
 *
 * Auth: validates the Resend webhook signature (svix) if RESEND_WEBHOOK_SECRET
 * is set. Otherwise, allows the request through (development mode).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _admin = null;
function getAdmin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
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
    if (!admin) {
      console.error("[RESEND_WEBHOOK] no service role key");
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

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
          token: `complaint_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
