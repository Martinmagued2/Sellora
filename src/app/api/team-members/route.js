/**
 * Team members API — used by conversation assignment dropdown.
 * GET /api/team-members — list all team members + owner for the effective account.
 *
 * Uses resolveEffectiveAccount so team members can also fetch the list
 * (they'll see the same list as the owner).
 */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount, getTeamMembers } from "@/lib/team-auth";

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const assignees = await getTeamMembers(effectiveAccountId);
    return NextResponse.json({ assignees });
  } catch (err) {
    console.error("[TEAM] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
