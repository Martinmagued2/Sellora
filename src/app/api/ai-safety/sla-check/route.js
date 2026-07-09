/**
 * AI Safety — SLA Breach Cron
 *
 * POST /api/ai-safety/sla-check
 *
 * Called by a cron (e.g. Vercel Cron, EasyCron, or GitHub Actions) every
 * ~5 minutes. Marks conversations as 'sla_breached' when:
 *   - sla_deadline IS NOT NULL
 *   - sla_deadline < now()
 *   - status NOT IN ('closed', 'sla_breached')
 *
 * Breached conversations get:
 *   - status = 'sla_breached' (so the dashboard can filter/highlight them)
 *   - a 'sla_breached' tag added (in addition to existing tags)
 *   - priority bumped to 'urgent' if it was lower
 *
 * Auth: the caller must provide a CRON_SECRET header matching the
 * CRON_SECRET env var. This prevents public abuse. If CRON_SECRET is not
 * set, the endpoint refuses to run (safer default).
 *
 * The endpoint returns a summary of how many conversations were marked
 * breached in this run.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function POST(req) {
  try {
    // ─── Auth: require CRON_SECRET header ───
    // The header can be either x-cron-secret or Authorization: Bearer <secret>.
    const providedSecret =
      req.headers.get("x-cron-secret") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    if (!process.env.CRON_SECRET) {
      console.warn("[SLA-CHECK] CRON_SECRET env var is not set — refusing to run.");
      return NextResponse.json(
        { error: "CRON_SECRET not configured on the server" },
        { status: 503 }
      );
    }

    const bufA = Buffer.from(String(providedSecret || ""), "utf8");
    const bufB = Buffer.from(process.env.CRON_SECRET, "utf8");
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();
    const nowIso = new Date().toISOString();

    // 1. Find all conversations whose SLA deadline has passed and that are
    //    not already closed or breached.
    //
    //    We select one row at a time-ish via .limit(200) per run to keep
    //    the cron cheap. If there are more than 200 breached conversations
    //    the next cron tick will pick them up.
    const { data: breached, error: fetchErr } = await admin
      .from("conversations")
      .select("id, account_id, priority, tags, sla_deadline, status, channel")
      .not("sla_deadline", "is", null)
      .lt("sla_deadline", nowIso)
      .not("status", "in", '("closed","sla_breached")')
      .order("sla_deadline", { ascending: true })
      .limit(200);

    if (fetchErr) {
      console.error("[SLA-CHECK] fetch error:", fetchErr.message);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!breached || breached.length === 0) {
      return NextResponse.json({ success: true, breachedCount: 0 });
    }

    // 2. For each breached conversation: bump priority to 'urgent' if lower,
    //    add 'sla_breached' tag, set status='sla_breached'. Also insert a
    //    conversation_event for audit and a notification for the owner.
    const PRIORITY_RANK = { low: 0, normal: 1, high: 2, urgent: 3 };
    let updated = 0;
    const errors = [];

    for (const conv of breached) {
      try {
        const currentTags = Array.isArray(conv.tags) ? conv.tags : [];
        const newTags = currentTags.includes("sla_breached")
          ? currentTags
          : [...currentTags, "sla_breached"];
        const newPriority =
          PRIORITY_RANK[conv.priority || "normal"] >= PRIORITY_RANK.urgent
            ? conv.priority
            : "urgent";

        const { error: updErr } = await admin
          .from("conversations")
          .update({
            status: "sla_breached",
            priority: newPriority,
            tags: newTags,
          })
          .eq("id", conv.id);

        if (updErr) {
          errors.push({ id: conv.id, error: updErr.message });
          continue;
        }

        // Audit event
        try {
          await admin.from("conversation_events").insert({
            conversation_id: conv.id,
            account_id: conv.account_id,
            event_type: "sla_breached",
            metadata: {
              sla_deadline: conv.sla_deadline,
              detected_at: nowIso,
              previous_status: conv.status,
              previous_priority: conv.priority,
              new_priority: newPriority,
            },
          });
        } catch (evtErr) {
          // non-fatal
        }

        // Owner notification (best-effort)
        try {
          await admin.from("notifications").insert({
            account_id: conv.account_id,
            type: "sla_breached",
            title: "SLA Breached",
            message: `A ${conv.channel} conversation breached its SLA deadline (${conv.sla_deadline}). The customer is still waiting for a reply.`,
            data: {
              conversation_id: conv.id,
              channel: conv.channel,
              sla_deadline: conv.sla_deadline,
              detected_at: nowIso,
            },
            read: false,
          });
        } catch (notifErr) {
          // non-fatal
        }

        updated += 1;
      } catch (perConvErr) {
        errors.push({ id: conv.id, error: perConvErr.message });
      }
    }

    console.log(
      `[SLA-CHECK] Marked ${updated}/${breached.length} conversations as sla_breached`
    );

    return NextResponse.json({
      success: true,
      breachedCount: updated,
      examined: breached.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (err) {
    console.error("[SLA-CHECK] fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET — convenience for testing/debugging (still requires CRON_SECRET)
export async function GET(req) {
  return POST(req);
}
