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
  failover: ['channel_failover_enabled', 'sms_provider', 'sms_sender_id'],
  inventory: ['inventory_reorder_enabled', 'inventory_reorder_threshold', 'inventory_reorder_qty', 'inventory_reorder_notify'],
  carrier: ['carrier_sync_enabled'],
  churn: ['churn_prediction_enabled', 'churn_threshold_days', 'churn_save_discount'],
  recommendations: ['product_recommendations_enabled'],
  send_time: ['send_time_optimization_enabled'],
  drip: ['extended_drip_enabled'],
  price_drop: ['price_drop_alerts_enabled', 'price_drop_message_template'],
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
      if (key.includes('threshold') || key.includes('qty') || key.includes('days') || key.includes('discount')) {
        update[key] = Math.max(0, Math.min(36500, Number(fields[key]) || 0));
      } else if (key.includes('enabled') || key.includes('notify')) {
        update[key] = Boolean(fields[key]);
      } else {
        update[key] = String(fields[key]).slice(0, 500);
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
    console.error('[operational-suite/settings]', e);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
