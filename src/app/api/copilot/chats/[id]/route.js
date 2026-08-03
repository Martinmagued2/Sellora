/**
 * GET    /api/copilot/chats/[id] — get a chat with all its messages
 * PATCH  /api/copilot/chats/[id] — update title or pinned status
 * DELETE /api/copilot/chats/[id] — delete a chat + all its messages (cascade)
 * POST   /api/copilot/chats/[id] — save a message to the chat
 *
 * All require auth + canAccessAccount.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

async function verifyChatAccess(req, chatId) {
  const user = await getAuthUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const db = admin();
  const { data: chat, error } = await db
    .from("copilot_chats")
    .select("id, account_id, title, pinned, created_at, updated_at")
    .eq("id", chatId)
    .maybeSingle();

  if (error || !chat) {
    return { error: NextResponse.json({ error: "Chat not found" }, { status: 404 }) };
  }

  const hasAccess = await canAccessAccount(user, chat.account_id);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: "You do not have access to this chat" }, { status: 403 }) };
  }

  return { user, db, chat };
}

// GET — fetch chat with messages
export async function GET(req, { params }) {
  try {
    const access = await verifyChatAccess(req, params.id);
    if (access.error) return access.error;

    const { db, chat } = access;

    const { data: messages, error: msgErr } = await db
      .from("copilot_messages")
      .select("id, role, content, tool_data, created_at")
      .eq("chat_id", params.id)
      .order("created_at", { ascending: true });

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    return NextResponse.json({
      chat,
      messages: messages || [],
    });
  } catch (e) {
    console.error("[COPILOT-CHAT] GET error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH — update title or pinned
export async function PATCH(req, { params }) {
  try {
    const access = await verifyChatAccess(req, params.id);
    if (access.error) return access.error;

    const { db } = access;
    const body = await req.json();
    const updates = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.pinned !== undefined) updates.pinned = body.pinned;
    updates.updated_at = new Date().toISOString();

    const { data: chat, error } = await db
      .from("copilot_chats")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ chat });
  } catch (e) {
    console.error("[COPILOT-CHAT] PATCH error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — delete chat (messages cascade)
export async function DELETE(req, { params }) {
  try {
    const access = await verifyChatAccess(req, params.id);
    if (access.error) return access.error;

    const { db } = access;
    const { error } = await db
      .from("copilot_chats")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[COPILOT-CHAT] DELETE error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — save a message to the chat
export async function POST(req, { params }) {
  try {
    const access = await verifyChatAccess(req, params.id);
    if (access.error) return access.error;

    const { db } = access;
    const { role, content, tool_data } = await req.json();

    if (!role || !content) {
      return NextResponse.json({ error: "role and content are required" }, { status: 400 });
    }

    const { data: message, error } = await db
      .from("copilot_messages")
      .insert({
        chat_id: params.id,
        role,
        content,
        tool_data: tool_data || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update the chat's updated_at timestamp
    await db
      .from("copilot_chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", params.id);

    return NextResponse.json({ message });
  } catch (e) {
    console.error("[COPILOT-CHAT] POST message error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
