/**
 * GET  /api/copilot/chats — list all chats for the user's account
 * POST /api/copilot/chats — create a new chat
 *
 * Both require authentication. Uses resolveEffectiveAccount so team
 * members can access the same chats as the owner.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

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

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();
    const { data: chats, error } = await db
      .from("copilot_chats")
      .select("id, title, pinned, created_at, updated_at")
      .eq("account_id", effectiveAccountId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ chats: chats || [] });
  } catch (e) {
    console.error("[COPILOT-CHATS] GET error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const title = body.title || "New Chat";

    const db = admin();

    // ─── Enforce 3-chat limit ───
    // Count non-pinned chats. If at limit, delete the oldest non-pinned chat.
    const MAX_CHATS = 3;
    const { data: existingChats } = await db
      .from("copilot_chats")
      .select("id, pinned, updated_at")
      .eq("account_id", effectiveAccountId)
      .eq("pinned", false)
      .order("updated_at", { ascending: true });

    if (existingChats && existingChats.length >= MAX_CHATS) {
      // Delete the oldest non-pinned chat
      const oldest = existingChats[0];
      console.log(`[COPILOT-CHATS] Chat limit reached — deleting oldest chat: ${oldest.id}`);
      await db.from("copilot_chats").delete().eq("id", oldest.id);
    }

    const { data: chat, error } = await db
      .from("copilot_chats")
      .insert({
        account_id: effectiveAccountId,
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ chat });
  } catch (e) {
    console.error("[COPILOT-CHATS] POST error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
