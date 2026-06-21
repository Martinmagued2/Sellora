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

// PUT — update revenue automation settings
// Body: { automation: 'winback'|'backinstock'|'upsell'|'payment_recovery'|'vip', ...fields }
export async function PUT(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { automation, ...fields } = body;

    if (!automation) return NextResponse.json({ error: 'automation required' }, { status: 400 });

    // Map automation name to allowed columns (prevent mass assignment)
    const ALLOWED = {
      winback: ['winback_enabled', 'winback_days_threshold', 'winback_discount_percent', 'winback_message_template'],
      backinstock: ['back_in_stock_enabled', 'back_in_stock_message_template'],
      upsell: ['upsell_enabled', 'upsell_delay_days', 'upsell_discount_percent', 'upsell_message_template'],
      payment_recovery: ['payment_recovery_enabled', 'payment_recovery_discount_percent', 'payment_recovery_message_template'],
      vip: ['vip_enabled', 'vip_threshold', 'vip_welcome_message'],
    };

    const allowed = ALLOWED[automation];
    if (!allowed) return NextResponse.json({ error: 'Invalid automation name' }, { status: 400 });

    const update = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        // Type validation
        if (key.includes('days_threshold') || key.includes('delay_days')) {
          update[key] = Math.max(1, Math.min(365, Number(fields[key]) || 1));
        } else if (key.includes('discount_percent')) {
          update[key] = Math.max(0, Math.min(100, Number(fields[key]) || 0));
        } else if (key.includes('threshold')) {
          update[key] = Math.max(0, Number(fields[key]) || 0);
        } else if (key.includes('enabled')) {
          update[key] = Boolean(fields[key]);
        } else {
          // String fields — cap at 1000 chars
          update[key] = String(fields[key]).slice(0, 1000);
        }
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
    console.error('[revenue-suite/settings]', e);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
