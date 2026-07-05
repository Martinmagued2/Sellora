/**
 * Server-side team authentication helper.
 *
 * Resolves the "effective account ID" for a logged-in user:
 *   - If they're a store owner → returns their own user.id
 *   - If they're a team member (agent/admin) → returns the owner's account_id
 *   - If they're a platform admin → returns their own user.id
 *
 * Also provides:
 *   - resolveEffectiveAccount(user) → { effectiveAccountId, role, isTeamMember, ownerAccount }
 *   - canAccessAccount(user, accountId) → boolean
 *   - getTeamMembers(accountId) → list of members for assignment UIs
 */

import { createClient } from "@supabase/supabase-js";

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

/**
 * Resolve the effective account ID + role for a user.
 *
 * @param {object} user - the auth.user() object (must have .id and .email)
 * @returns {Promise<{
 *   effectiveAccountId: string,
 *   role: 'owner' | 'admin' | 'agent',
 *   isTeamMember: boolean,
 *   ownerAccount: object|null,
 *   teamMember: object|null
 * }>}
 */
export async function resolveEffectiveAccount(user) {
  if (!user) {
    return {
      effectiveAccountId: null,
      role: null,
      isTeamMember: false,
      ownerAccount: null,
      teamMember: null,
    };
  }

  const db = admin();

  // 1. Check if this user is a team member of someone else's account.
  // We use or('status.is.null') because older members who accepted before
  // migration 060 added the 'status' column may have NULL instead of 'active'.
  const { data: teamMembers } = await db
    .from("team_members")
    .select("id, account_id, role, status, invite_status, name, email, display_name")
    .eq("user_id", user.id)
    .eq("invite_status", "accepted")
    .or("status.is.null,status.eq.active")
    .order("created_at", { ascending: false })
    .limit(1);

  const teamMember = teamMembers?.[0];

  if (teamMember?.account_id) {
    // Fetch the owner's account info
    const { data: ownerAccount } = await db
      .from("accounts")
      .select("id, email, business_name, owner_name, plan, currency, role")
      .eq("id", teamMember.account_id)
      .maybeSingle();

    return {
      effectiveAccountId: teamMember.account_id,
      role: teamMember.role || "agent",
      isTeamMember: true,
      ownerAccount,
      teamMember,
    };
  }

  // 2. Not a team member — they're an owner (or platform admin)
  return {
    effectiveAccountId: user.id,
    role: "owner",
    isTeamMember: false,
    ownerAccount: null,
    teamMember: null,
  };
}

/**
 * Check if a user can access a given account's data.
 * Returns true if:
 *   - They're the account owner (user.id === accountId)
 *   - They're an accepted team member of that account
 *   - They're a platform admin
 */
export async function canAccessAccount(user, accountId) {
  if (!user || !accountId) return false;
  if (user.id === accountId) return true;

  const db = admin();
  // Use or('status.is.null') for backward compat — older members who accepted
  // before migration 060 may have status=NULL instead of 'active'.
  const { data: teamMember } = await db
    .from("team_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("invite_status", "accepted")
    .or("status.is.null,status.eq.active")
    .maybeSingle();

  if (teamMember) return true;

  // Platform admin override
  const { data: account } = await db
    .from("accounts")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return account?.role === "admin";
}

/**
 * Get all team members for an account (for assignment dropdowns).
 * Includes the owner as the first entry.
 *
 * @param {string} accountId - the OWNER's account ID
 * @returns {Promise<Array<{id, email, name, role, status, display_name, avatar_url}>>}
 */
export async function getTeamMembers(accountId) {
  if (!accountId) return [];
  const db = admin();

  // Owner first
  const { data: owner } = await db
    .from("accounts")
    .select("id, email, owner_name")
    .eq("id", accountId)
    .maybeSingle();

  const ownerEntry = owner
    ? {
        id: owner.id,
        email: owner.email,
        name: owner.owner_name || owner.email,
        display_name: owner.owner_name || owner.email?.split("@")[0] || "Owner",
        role: "owner",
        status: "active",
        avatar_url: null,
      }
    : null;

  // Team members
  const { data: members } = await db
    .from("team_members")
    .select("id, user_id, invited_email, email, name, display_name, role, status, avatar_url, invite_status")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  const memberEntries = (members || [])
    .filter((m) => m.invite_status === "accepted" && (m.status === "active" || m.status === null || m.status === undefined))
    .map((m) => ({
      id: m.user_id || m.id,
      email: m.email || m.invited_email,
      name: m.name || m.display_name || m.invited_email,
      display_name: m.display_name || m.name || m.invited_email?.split("@")[0] || "Member",
      role: m.role || "agent",
      status: m.status || "active",
      avatar_url: m.avatar_url || null,
    }));

  return ownerEntry ? [ownerEntry, ...memberEntries] : memberEntries;
}

/**
 * Resolve "who is the actor?" for an audit-log style event.
 * Returns the user's name within the team context.
 */
export async function getActorName(user, accountId) {
  const db = admin();
  if (user.id === accountId) {
    const { data: owner } = await db
      .from("accounts")
      .select("owner_name, email")
      .eq("id", user.id)
      .maybeSingle();
    return owner?.owner_name || owner?.email || "Owner";
  }

  const { data: tm } = await db
    .from("team_members")
    .select("name, display_name, invited_email")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .maybeSingle();

  return tm?.name || tm?.display_name || tm?.invited_email || "Team Member";
}
