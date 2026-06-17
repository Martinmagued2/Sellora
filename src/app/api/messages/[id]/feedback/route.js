/**
 * AI Message Feedback API
 * POST /api/messages/[id]/feedback
 *   body: { rating: "up" | "down", reason?: string }
 *
 * Records operator feedback on an AI message. Used to:
 *   - Identify poorly performing AI replies (weekly review)
 *   - Train/fine-tune future models
 *   - Track AI quality over time
 *
 * One feedback per message (UNIQUE constraint on message_id).
 * If feedback already exists, it's updated.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

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

    const { id: messageId } = await params;
    const { rating, reason } = await req.json();

    if (!rating || !["up", "down"].includes(rating)) {
      return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Look up the message + its conversation to verify ownership
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, conversation_id, account_id, is_ai")
      .eq("id", messageId)
      .single();

    if (msgErr || !msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (msg.account_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!msg.is_ai) {
      return NextResponse.json({ error: "Feedback can only be recorded for AI messages" }, { status: 400 });
    }

    // Upsert feedback (one per message)
    const { data: feedback, error: upsertErr } = await admin
      .from("ai_message_feedback")
      .upsert(
        {
          account_id: user.id,
          message_id: messageId,
          conversation_id: msg.conversation_id,
          rating,
          reason: reason || null,
          operator_id: user.id,
        },
        { onConflict: "message_id" }
      )
      .select("id, rating, reason, created_at")
      .single();

    if (upsertErr) {
      console.error("[FEEDBACK] upsert failed:", upsertErr);
      return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
    }

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("[FEEDBACK] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * GET /api/messages/[id]/feedback
 * Returns existing feedback for a message (if any).
 */
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: messageId } = await params;
    const admin = getAdminClient();

    const { data: feedback } = await admin
      .from("ai_message_feedback")
      .select("id, rating, reason, created_at")
      .eq("message_id", messageId)
      .single();

    return NextResponse.json({ feedback: feedback || null });
  } catch (err) {
    return NextResponse.json({ feedback: null });
  }
}
