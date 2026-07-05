import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// POST — get invite details (for the popup)
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { inviteId } = await req.json();
    if (!inviteId) return NextResponse.json({ error: 'inviteId required' }, { status: 400 });

    const db = admin();

    // Get the invite
    const { data: invite, error } = await db.from('team_members')
      .select('id, account_id, invited_email, invite_status, user_id, role')
      .eq('id', inviteId)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Get the business name from the owner's account
    const { data: ownerAccount } = await db.from('accounts')
      .select('business_name')
      .eq('id', invite.account_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      invite: {
        ...invite,
        business_name: ownerAccount?.business_name || 'a team',
      },
    });
  } catch (e) {
    console.error('[invite-details]', e);
    return NextResponse.json({ error: 'Failed to fetch invite' }, { status: 500 });
  }
}
