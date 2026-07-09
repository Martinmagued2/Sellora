/**
 * GET /api/team/pending-invites
 *
 * Returns all pending team invitations addressed to the current user's email.
 * Used by the InviteAcceptPopup to proactively show pending invites — even if
 * the user doesn't have a localStorage entry (e.g. they clicked the email link
 * while already logged in, or they cleared their browser storage).
 *
 * Returns: { invites: [{ id, account_id, business_name, role, invited_email }] }
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ invites: [] }, { status: 200 });
    }

    const db = admin();

    // Find pending invites where invited_email matches the user's email
    const { data: invites, error } = await db
      .from("team_members")
      .select("id, account_id, invited_email, role, status, invite_status, created_at")
      .eq("invited_email", user.email)
      .eq("invite_status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PENDING-INVITES] query error:", error.message);
      return NextResponse.json({ invites: [] }, { status: 200 });
    }

    // Filter out any invites the user has already accepted under a different account
    // (i.e. they're already a member of that team)
    const { data: acceptedMemberships } = await db
      .from("team_members")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("invite_status", "accepted");
    const acceptedAccountIds = new Set((acceptedMemberships || []).map((m) => m.account_id));

    const filteredInvites = (invites || []).filter((inv) => !acceptedAccountIds.has(inv.account_id));

    // Hydrate with business_name from the owner's account
    const hydrated = await Promise.all(
      filteredInvites.map(async (inv) => {
        try {
          const { data: owner } = await db
            .from("accounts")
            .select("business_name, owner_name")
            .eq("id", inv.account_id)
            .maybeSingle();
          return {
            ...inv,
            business_name: owner?.business_name || "a team",
            owner_name: owner?.owner_name || null,
          };
        } catch {
          return { ...inv, business_name: "a team" };
        }
      })
    );

    return NextResponse.json({ invites: hydrated });
  } catch (e) {
    console.error("[PENDING-INVITES] error:", e);
    return NextResponse.json({ invites: [], error: "Server error" }, { status: 500 });
  }
}
