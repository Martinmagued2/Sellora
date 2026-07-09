import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// POST — broadcast typing status
// Body: { isTyping: boolean, isCustomer?: boolean }
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: conversationId } = params;
    const { isTyping, isCustomer = false } = await req.json();

    const db = admin();

    if (isTyping) {
      // Insert a typing indicator (will auto-expire via query filter)
      await db.from('typing_indicators').upsert({
        account_id: user.id,
        conversation_id: conversationId,
        user_id: user.id,
        is_customer: isCustomer,
        is_team_member: !isCustomer,
        created_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id,user_id' });
    } else {
      // Delete typing indicator
      await db.from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update typing status' }, { status: 500 });
  }
}

// GET — check who is typing in this conversation
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: conversationId } = params;
    const db = admin();

    // Get typing indicators from last 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    const { data: typers } = await db.from('typing_indicators')
      .select('is_customer, is_team_member, created_at')
      .eq('conversation_id', conversationId)
      .gte('created_at', fiveSecondsAgo);

    // Clean up old indicators
    await db.from('typing_indicators')
      .lt('created_at', fiveSecondsAgo)
      .delete();

    return NextResponse.json({
      typers: typers || [],
      customerTyping: (typers || []).some(t => t.is_customer),
      teamTyping: (typers || []).some(t => t.is_team_member),
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch typing status' }, { status: 500 });
  }
}
