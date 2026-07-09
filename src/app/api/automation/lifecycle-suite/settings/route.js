import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}

const ALLOWED = {
  birthday: ['birthday_enabled', 'birthday_discount_percent', 'birthday_message_template'],
  welcome: ['welcome_series_enabled', 'welcome_discount_percent'],
  reorder: ['reorder_reminders_enabled', 'reorder_reminder_days', 'reorder_message_template'],
  review: ['review_optimization_enabled'],
  segments: ['segment_auto_update_enabled'],
  routing: ['smart_routing_enabled', 'routing_rules'],
  faq: ['faq_auto_generate_enabled'],
  negative_review: ['negative_review_response_enabled', 'negative_review_message_template'],
};

export async function PUT(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { automation, ...fields } = body;
    if (!automation) return NextResponse.json({ error: 'automation required' }, { status: 400 });

    const allowed = ALLOWED[automation];
    if (!allowed) return NextResponse.json({ error: 'Invalid automation name' }, { status: 400 });

    const update = {};
    for (const key of allowed) {
      if (fields[key] === undefined) continue;
      if (key.includes('discount_percent')) {
        update[key] = Math.max(0, Math.min(100, Number(fields[key]) || 0));
      } else if (key.includes('reminder_days')) {
        update[key] = Math.max(1, Math.min(365, Number(fields[key]) || 1));
      } else if (key.includes('enabled')) {
        update[key] = Boolean(fields[key]);
      } else if (key === 'routing_rules') {
        // Validate routing rules structure
        const rules = Array.isArray(fields[key]) ? fields[key] : [];
        update[key] = rules.slice(0, 20).map(r => ({
          name: String(r.name || '').slice(0, 100),
          keywords: Array.isArray(r.keywords) ? r.keywords.slice(0, 10).map(k => String(k).slice(0, 50)) : [],
          assignee_id: r.assignee_id || null,
        }));
      } else {
        update[key] = String(fields[key]).slice(0, 1000);
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const db = admin();
    const { error } = await db.from('accounts').update(update).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, updated: update });
  } catch (e) {
    console.error('[lifecycle-suite/settings]', e);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
