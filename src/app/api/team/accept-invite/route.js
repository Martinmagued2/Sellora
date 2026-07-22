import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

/**
 * POST /api/team/accept-invite
 * Body: { inviteId, userId }
 *
 * Accepts a team invitation by:
 * 1. Looking up the team_members row by invite ID
 * 2. Verifying the invite is still pending
 * 3. Updating the row with the user's ID + status "accepted"
 */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { inviteId, userId } = await req.json();
    if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });

    const db = admin();

    // 1. Find the invite
    const { data: invite, error: inviteErr } = await db.from('team_members')
      .select('id, account_id, invited_email, invite_status, user_id, role')
      .eq('id', inviteId)
      .maybeSingle();

    if (inviteErr || !invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // 2. Check if already accepted
    if (invite.invite_status === 'accepted') {
      return NextResponse.json({ 
        success: true, 
        message: 'Invitation already accepted',
        accountId: invite.account_id,
      });
    }

    if (invite.invite_status !== 'pending') {
      return NextResponse.json({ error: `Invitation is ${invite.invite_status}` }, { status: 400 });
    }

    // SECURITY: Verify the authenticated user's email matches the invited email.
    // Without this check, ANY authenticated user who learns/guesses an invite
    // UUID could join that team and gain access to the account's data.
    const invitedEmail = (invite.invited_email || '').toLowerCase().trim();
    const userEmail = (user.email || '').toLowerCase().trim();
    if (!invitedEmail || invitedEmail !== userEmail) {
      return NextResponse.json(
        { error: `This invitation was sent to ${invite.invited_email}. Sign in with that email address to accept it.` },
        { status: 403 }
      );
    }

    // 3. Accept the invite — link the user ID to the team member row
    // SECURITY: Always use the authenticated user's ID, not a body-supplied userId.
    const { error: updateErr } = await db.from('team_members')
      .update({
        user_id: user.id,
        invite_status: 'accepted',
        status: 'active',
        email: user.email,
        // Pull name from user_metadata if available
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : null),
      })
      .eq('id', inviteId)
      .eq('invite_status', 'pending');

    if (updateErr) {
      console.error('[accept-invite] Update failed:', updateErr.message);
      return NextResponse.json({ error: 'Failed to accept invitation: ' + updateErr.message }, { status: 500 });
    }

    // 4. Create an accounts row for the team member (if they don't have one).
    //    BUG FIX: do NOT overwrite an existing owner's role to 'agent' —
    //    that would destroy their account if they were already a store owner
    //    of another business. Only insert a minimal accounts row if they
    //    don't have one, and don't touch role on existing rows.
    const { data: existingAccount } = await db.from('accounts')
      .select('id, role, plan')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingAccount) {
      // Create a minimal accounts row so the user can log in.
      // Role stays as the default 'owner' (meaningless for team members since
      // we use team_members.role for actual permissions).
      // Plan is 'team_member' so billing knows not to charge them.
      await db.from('accounts').insert({
        id: user.id,
        email: user.email,
        plan: 'team_member',
        // Don't set role — let it default
      });
    }
    // If existingAccount exists, leave their role + plan alone.
    // The team_members row is the source of truth for their team membership.

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted! Welcome to the team.',
      accountId: invite.account_id,
      role: invite.role || 'agent',
    });
  } catch (e) {
    console.error('[accept-invite] Error:', e);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
