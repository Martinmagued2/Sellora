import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// GET — list custom field definitions for this account
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = admin();
    const { data: fields, error } = await db.from('customer_custom_fields')
      .select('*').eq('account_id', user.id).eq('is_visible', true)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ fields });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch custom fields' }, { status: 500 });
  }
}

// POST — create a new custom field definition
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { field_name, field_label, field_type, field_options, is_required } = await req.json();
    if (!field_name || !field_label) {
      return NextResponse.json({ error: 'field_name and field_label are required' }, { status: 400 });
    }

    const db = admin();
    const { data: field, error } = await db.from('customer_custom_fields').insert({
      account_id: user.id,
      field_name: field_name.slice(0, 50).replace(/\s/g, '_').toLowerCase(),
      field_label: field_label.slice(0, 100),
      field_type: field_type || 'text',
      field_options: field_options || [],
      is_required: Boolean(is_required),
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ field });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 });
  }
}

// DELETE — remove a custom field
export async function DELETE(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fieldId = searchParams.get('field_id');
    if (!fieldId) return NextResponse.json({ error: 'field_id required' }, { status: 400 });

    const db = admin();
    const { error } = await db.from('customer_custom_fields')
      .delete().eq('id', fieldId).eq('account_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete custom field' }, { status: 500 });
  }
}
