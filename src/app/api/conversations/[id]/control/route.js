/**
 * Conversation Controls API
 * POST /api/conversations/[id]/control
 *
 * Actions:
 *   - pause_ai          { durationHours?: number, reason?: string }
 *   - resume_ai         {}
 *   - take_over         { durationHours?: number }   alias for pause_ai with 4h default
 *   - assign            { assigneeId: uuid }
 *   - unassign          {}
 *   - snooze            { until: ISO string }
 *   - unsnooze          {}
 *   - close             {}
 *
 * All actions record an entry in conversation_events for audit.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { finalizeDeflection } from "@/lib/ai/reply-helpers";
import { canAccessAccount, getActorName } from "@/lib/team-auth";

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

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const body = await req.json();
    let { action, ...payload } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing 'action' in body" }, { status: 400 });
    }

    // Normalize take_over → pause_ai with 4h default
    if (action === "take_over") {
      payload.durationHours = payload.durationHours ?? 4;
      payload.reason = payload.reason || "Operator take-over";
      action = "pause_ai";
    }

    const admin = getAdminClient();

    // Verify the conversation belongs to this user's account (or their team's account)
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, account_id, status, assigned_to")
      .eq("id", conversationId)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    // Team-aware ownership check
    const hasAccess = await canAccessAccount(user, conv.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let update = {};
    let eventType = action;
    let eventMeta = {};

    switch (action) {
      case "pause_ai": {
        const hours = payload.durationHours && payload.durationHours > 0 ? payload.durationHours : null;
        update.ai_paused = true;
        update.ai_paused_by = user.id;
        update.ai_paused_until = hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
        update.escalation_reason = payload.reason || "Paused by operator";
        eventMeta = { durationHours: hours, reason: update.escalation_reason };
        break;
      }
      case "resume_ai":
        update.ai_paused = false;
        update.ai_paused_until = null;
        update.ai_paused_by = null;
        update.escalation_reason = null;
        break;
      case "assign": {
        if (!payload.assigneeId) {
          return NextResponse.json({ error: "assigneeId required" }, { status: 400 });
        }
        // Verify assignee is the owner OR a team member of the owner's account
        const isOwner = payload.assigneeId === conv.account_id;
        let isValidAssignee = isOwner;
        if (!isOwner) {
          const { data: tm } = await admin
            .from("team_members")
            .select("id, name, display_name, invited_email")
            .eq("user_id", payload.assigneeId)
            .eq("account_id", conv.account_id)
            .eq("invite_status", "accepted")
            .eq("status", "active")
            .maybeSingle();
          isValidAssignee = !!tm;
        }
        if (!isValidAssignee) {
          return NextResponse.json({ error: "Assignee not found in this team" }, { status: 404 });
        }
        update.assigned_to = payload.assigneeId;
        update.assigned_at = new Date().toISOString();
        update.assigned_by = user.id;
        eventMeta = { assigneeId: payload.assigneeId };
        break;
      }
      case "unassign":
        update.assigned_to = null;
        update.assigned_at = null;
        update.assigned_by = null;
        break;
      case "snooze": {
        if (!payload.until) {
          return NextResponse.json({ error: "until (ISO date) required" }, { status: 400 });
        }
        const untilDate = new Date(payload.until);
        if (isNaN(untilDate.getTime())) {
          return NextResponse.json({ error: "Invalid 'until' date" }, { status: 400 });
        }
        update.snoozed_until = untilDate.toISOString();
        update.snoozed_by = user.id;
        eventMeta = { until: update.snoozed_until };
        break;
      }
      case "unsnooze":
        update.snoozed_until = null;
        update.snoozed_by = null;
        break;
      case "close":
        update.status = "closed";
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Apply the update
    const { error: updateErr } = await admin
      .from("conversations")
      .update(update)
      .eq("id", conversationId);

    if (updateErr) {
      console.error("[CONV-CONTROL] update failed:", updateErr);
      return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
    }

    // For 'close', finalize deflection
    if (action === "close") {
      await finalizeDeflection(conversationId);
    }

    // Record event (use the conversation's account_id, not user.id, for team context)
    try {
      await admin.from("conversation_events").insert({
        conversation_id: conversationId,
        account_id: conv.account_id,
        event_type: eventType,
        actor_id: user.id,
        metadata: eventMeta,
      });
    } catch (e) {
      console.warn("[CONV-CONTROL] event insert failed:", e.message);
    }

    // On assignment, send a notification to the assignee
    if (action === "assign" && payload.assigneeId && payload.assigneeId !== user.id) {
      try {
        const { notify } = await import("@/lib/notifications");
        const actorName = await getActorName(user, conv.account_id);
        // Look up customer + conversation for a nicer notification
        const { data: convFull } = await admin
          .from("conversations")
          .select("id, customer_id, channel, customers(name)")
          .eq("id", conversationId)
          .maybeSingle();
        const custName = convFull?.customers?.name || "a customer";
        const channelLabel =
          { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", telegram: "Telegram", email: "Email" }[convFull?.channel] || convFull?.channel || "chat";
        await notify(conv.account_id, {
          category: "messages",
          type: "conversation_assigned",
          title: `Assigned to you: ${custName} on ${channelLabel}`,
          message: `${actorName} assigned a conversation to you. Take it from here!`,
          priority: "high",
          actionUrl: `/dashboard/conversations?selected=${conversationId}`,
          actionLabel: "Open conversation",
          userId: payload.assigneeId,
          related_id: conversationId,
          related_type: "conversation",
        });
      } catch (e) {
        console.warn("[CONV-CONTROL] assignee notification failed:", e.message);
      }
    }

    return NextResponse.json({ success: true, action, update });
  } catch (err) {
    console.error("[CONV-CONTROL] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
