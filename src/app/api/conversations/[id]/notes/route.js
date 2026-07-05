/**
 * Conversation Internal Notes API
 * GET    /api/conversations/[id]/notes        — list notes
 * POST   /api/conversations/[id]/notes        — create note { body, pinned? }
 *
 * Notes are PRIVATE — they are never sent to the customer or shown to the AI.
 * Team-aware: any team member of the owner's account can read/write notes.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";

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

async function getConversation(admin, conversationId, userId) {
  const { data: conv } = await admin
    .from("conversations")
    .select("account_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;
  const hasAccess = await canAccessAccount({ id: userId }, conv.account_id);
  if (!hasAccess) return null;
  return conv;
}

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const admin = getAdminClient();

    const conv = await getConversation(admin, conversationId, user.id);
    if (!conv) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: notes, error } = await admin
      .from("conversation_notes")
      .select("id, body, pinned, author_id, created_at, updated_at")
      .eq("conversation_id", conversationId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[NOTES] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const { body, pinned = false } = await req.json();

    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Note body is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const conv = await getConversation(admin, conversationId, user.id);
    if (!conv) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use the conversation's account_id (the owner's) — not user.id — so RLS
    // and team-context queries work correctly.
    const { data: note, error } = await admin
      .from("conversation_notes")
      .insert({
        conversation_id: conversationId,
        account_id: conv.account_id,
        author_id: user.id,
        body: body.trim(),
        pinned: !!pinned,
      })
      .select("id, body, pinned, author_id, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record event
    try {
      await admin.from("conversation_events").insert({
        conversation_id: conversationId,
        account_id: conv.account_id,
        event_type: "note_added",
        actor_id: user.id,
        metadata: { noteId: note.id },
      });
    } catch (e) { /* ignore */ }

    return NextResponse.json({ note });
  } catch (err) {
    console.error("[NOTES] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
