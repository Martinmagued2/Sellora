/** POST /api/round-robin — auto-assign a conversation to the next available agent */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { conversationId } = await req.json();
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

    const admin = getAdminClient();

    // Get all team members (owner + team)
    const { data: owner } = await admin.from("accounts").select("id, email, owner_name").eq("id", user.id).single();
    const { data: team } = await admin.from("team_members").select("id, email, name, status").eq("account_id", user.id).eq("status", "active");

    const agents = [
      { id: owner.id, name: owner.owner_name || owner.email },
      ...(team || []).map(t => ({ id: t.id, name: t.name || t.email })),
    ];

    if (agents.length === 0) return NextResponse.json({ error: "No agents available" }, { status: 400 });

    // Count active conversations per agent
    const agentWorkloads = await Promise.all(agents.map(async (a) => {
      const { count } = await admin.from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("account_id", user.id)
        .eq("assigned_to", a.id)
        .in("status", ["new", "open", "in_progress"]);
      return { ...a, activeCount: count || 0 };
    }));

    // Sort by least active conversations
    agentWorkloads.sort((a, b) => a.activeCount - b.activeCount);
    const nextAgent = agentWorkloads[0];

    // Assign
    await admin.from("conversations").update({ assigned_to: nextAgent.id }).eq("id", conversationId).eq("account_id", user.id);

    return NextResponse.json({ success: true, assignedTo: nextAgent });
  } catch (e) { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
