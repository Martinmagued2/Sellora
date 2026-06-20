/**
 * Team members API — used by conversation assignment dropdown.
 * GET /api/team-members — list all team members for the authenticated account.
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

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminClient();

    // The account owner is always a potential assignee
    const { data: owner } = await admin
      .from("accounts")
      .select("id, email, owner_name, role")
      .eq("id", user.id)
      .single();

    // Team members (from team_members table)
    const { data: team, error } = await admin
      .from("team_members")
      .select("id, email, name, role, status")
      .eq("account_id", user.id)
      .order("created_at", { ascending: true });

    const assignees = [
      { id: owner.id, email: owner.email, name: owner.owner_name || owner.email, role: "owner", status: "active" },
      ...(team || []).map((t) => ({
        id: t.id,
        email: t.email,
        name: t.name || t.email,
        role: t.role || "agent",
        status: t.status || "active",
      })),
    ].filter((a) => a.status === "active");

    return NextResponse.json({ assignees });
  } catch (err) {
    console.error("[TEAM] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
