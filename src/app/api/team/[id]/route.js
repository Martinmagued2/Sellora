/**
 * Team member management API
 * PATCH /api/team/[id]  — update role, status, resend invite
 * DELETE /api/team/[id] — remove team member
 *
 * [id] is the team_members.id (UUID), NOT the user_id.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { sendTeamInviteEmail, isEmailConfigured } from "@/lib/email";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: memberId } = await params;
    const body = await req.json();
    const { role, status, resendInvite, businessName } = body;

    const db = admin();

    // Look up the team member row
    const { data: member, error: memberErr } = await db
      .from("team_members")
      .select("id, account_id, invited_email, role, status, invite_status")
      .eq("id", memberId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Only the owner can manage their team members
    if (member.account_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates = {};

    // Role change
    if (role && ["admin", "agent"].includes(role) && role !== member.role) {
      updates.role = role;
    }

    // Status change (active / disabled)
    if (status && ["active", "disabled"].includes(status)) {
      updates.status = status;
      // Sync invite_status for clarity
      if (status === "disabled" && member.invite_status === "accepted") {
        updates.invite_status = "revoked";
      } else if (status === "active" && member.invite_status === "revoked") {
        updates.invite_status = "accepted";
      }
    }

    // Resend invite email (only for pending invites)
    if (resendInvite && member.invite_status === "pending") {
      if (!isEmailConfigured()) {
        return NextResponse.json({ error: "Email not configured" }, { status: 500 });
      }
      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/login?invite=${member.id}`;
      const result = await sendTeamInviteEmail({
        to: member.invited_email,
        businessName: businessName || "your team",
        inviteLink,
        accountId: user.id,
      });
      if (!result.success) {
        return NextResponse.json({ error: "Failed to resend invite: " + result.error }, { status: 500 });
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { data: updated, error: updateErr } = await db
        .from("team_members")
        .update(updates)
        .eq("id", memberId)
        .select()
        .single();
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, member: updated });
    }

    return NextResponse.json({ success: true, member });
  } catch (e) {
    console.error("[TEAM PATCH]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: memberId } = await params;
    const db = admin();

    // Look up the team member row
    const { data: member } = await db
      .from("team_members")
      .select("id, account_id, invited_email, role")
      .eq("id", memberId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Only the owner can remove team members
    if (member.account_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await db.from("team_members").delete().eq("id", memberId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[TEAM DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
