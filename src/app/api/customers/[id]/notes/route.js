import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { notify } from '@/lib/notifications';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// GET — list notes for a customer
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const db = admin();

    // Verify customer belongs to user
    const { data: customer } = await db.from('customers')
      .select('id').eq('id', id).eq('account_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { data: notes, error } = await db.from('customer_notes')
      .select('*').eq('customer_id', id).order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notes });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST — create a note
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const { body, pinned = false } = await req.json();
    if (!body || !body.trim()) return NextResponse.json({ error: 'Note body is required' }, { status: 400 });

    const db = admin();

    // Verify ownership
    const { data: customer } = await db.from('customers')
      .select('id, name').eq('id', id).eq('account_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Get author name
    const { data: account } = await db.from('accounts')
      .select('business_name').eq('id', user.id).maybeSingle();

    const { data: note, error } = await db.from('customer_notes').insert({
      account_id: user.id,
      customer_id: id,
      author_id: user.id,
      author_name: account?.business_name || 'Team Member',
      body: body.slice(0, 5000),
      pinned,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add to timeline
    await db.from('customer_timeline').insert({
      account_id: user.id,
      customer_id: id,
      event_type: 'note',
      title: 'Note added',
      description: body.slice(0, 100),
      actor_id: user.id,
      actor_name: account?.business_name || 'Team Member',
    });

    return NextResponse.json({ note });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

// PATCH — update a note (pin/unpin, edit body)
export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { note_id, ...updates } = body;
    if (!note_id) return NextResponse.json({ error: 'note_id required' }, { status: 400 });

    const db = admin();
    const { data: note, error } = await db.from('customer_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', note_id).eq('account_id', user.id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ note });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE — delete a note
export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('note_id');
    if (!noteId) return NextResponse.json({ error: 'note_id required' }, { status: 400 });

    const db = admin();
    const { error } = await db.from('customer_notes')
      .delete().eq('id', noteId).eq('account_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
