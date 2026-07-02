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

    // 3. Accept the invite — link the user ID to the team member row
    const { error: updateErr } = await db.from('team_members')
      .update({
        user_id: userId || user.id,
        invite_status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
      .eq('invite_status', 'pending');

    if (updateErr) {
      console.error('[accept-invite] Update failed:', updateErr.message);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    // 4. Create an accounts row for the team member (if they don't have one)
    //    This lets them access the dashboard with the team member's account_id
    const { data: existingAccount } = await db.from('accounts')
      .select('id')
      .eq('id', userId || user.id)
      .maybeSingle();

    if (!existingAccount) {
      // Create a minimal accounts row that references the owner's account
      await db.from('accounts').insert({
        id: userId || user.id,
        email: user.email,
        role: invite.role || 'agent',
        plan: 'team_member', // Special plan that doesn't get billed
      });
    } else {
      // Update their role to agent if they already have an account
      await db.from('accounts')
        .update({ role: invite.role || 'agent' })
        .eq('id', userId || user.id);
    }

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
