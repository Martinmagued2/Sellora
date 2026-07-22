/**
 * Team members API — used by conversation assignment dropdown.
 * GET /api/team-members — list all team members + owner for the effective account.
 *
 * Uses resolveEffectiveAccount so team members can also fetch the list
 * (they'll see the same list as the owner).
 *
 * Previously this endpoint did .eq("account_id", user.id) which ONLY worked
 * for owners. Team members (whose user.id is NOT the account_id) got an
 * empty list — breaking the assignee dropdown, the @ mention feature, etc.
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
      // FALLBACK: try user.id directly (covers the case where the user is an
      // owner with no team_members entries — resolveEffectiveAccount may return
      // null in edge cases).
      const assignees = await getTeamMembers(user.id);
      return NextResponse.json({ assignees });
    }

    const assignees = await getTeamMembers(effectiveAccountId);
    return NextResponse.json({ assignees });
  } catch (err) {
    console.error("[TEAM] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
