/**
 * GET /api/analytics/team-leaderboard
 * Per-team-member performance metrics.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const db = admin();

    // Fetch team members
    const { data: team } = await db
      .from("team_members")
      .select("user_id, name, display_name, email, role, avatar_url")
      .eq("account_id", effectiveAccountId)
      .eq("invite_status", "accepted");

    // Add owner to the list
    const { data: owner } = await db
      .from("accounts")
      .select("id, email, owner_name")
      .eq("id", effectiveAccountId)
      .maybeSingle();

    const allMembers = [
      { user_id: owner?.id, name: owner?.owner_name || owner?.email, display_name: owner?.owner_name || owner?.email, email: owner?.email, role: "owner" },
      ...(team || []).map(t => ({ user_id: t.user_id, name: t.display_name || t.name || t.email, display_name: t.display_name || t.name, email: t.email, role: t.role })),
    ];

    // Fetch messages sent by each team member (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: messages } = await db
      .from("messages")
      .select("id, direction, is_ai, created_at, conversation_id, sender_id")
      .eq("account_id", effectiveAccountId)
      .eq("direction", "outgoing")
      .eq("is_ai", false)
      .gte("created_at", thirtyDaysAgo);

    // Fetch conversations assigned to each member
    const { data: conversations } = await db
      .from("conversations")
      .select("id, assigned_to, status, converted")
      .eq("account_id", effectiveAccountId);

    // Fetch tasks completed by each member
    const { data: tasks } = await db
      .from("customer_tasks")
      .select("id, completed_by, status")
      .eq("account_id", effectiveAccountId)
      .eq("status", "done");

    // Build leaderboard
    const leaderboard = allMembers.map(member => {
      const memberMessages = (messages || []).filter(m => m.sender_id === member.user_id || m.conversation_id === null);
      const memberConvs = (conversations || []).filter(c => c.assigned_to === member.user_id);
      const memberTasks = (tasks || []).filter(t => t.completed_by === member.user_id);
      const conversions = memberConvs.filter(c => c.converted).length;

      return {
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
        avatar_url: member.avatar_url,
        messages_sent: memberMessages.length,
        conversations_assigned: memberConvs.length,
        conversations_resolved: memberConvs.filter(c => c.status === "closed").length,
        tasks_completed: memberTasks.length,
        conversions,
        conversion_rate: memberConvs.length > 0 ? Math.round((conversions / memberConvs.length) * 100) : 0,
      };
    });

    // Sort by messages_sent (most active first)
    leaderboard.sort((a, b) => b.messages_sent - a.messages_sent);

    return NextResponse.json({
      leaderboard,
      period: "30 days",
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[TEAM-LEADERBOARD] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
