import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { getAutomationStats } from '@/lib/automation/helpers';

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}

// GET — returns all 5 automation settings + stats for the authenticated user
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = admin();
    const { data: account } = await db.from('accounts')
      .select(`
        winback_enabled, winback_days_threshold, winback_discount_percent, winback_message_template,
        back_in_stock_enabled, back_in_stock_message_template,
        upsell_enabled, upsell_delay_days, upsell_discount_percent, upsell_message_template,
        payment_recovery_enabled, payment_recovery_discount_percent, payment_recovery_message_template,
        vip_enabled, vip_threshold, vip_welcome_message
      `)
      .eq('id', user.id)
      .maybeSingle();

    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const [winback, backinstock, upsell, payrec, vip] = await Promise.all([
      getAutomationStats(db, 'win_back_campaigns', user.id),
      getAutomationStats(db, 'back_in_stock_requests', user.id),
      getAutomationStats(db, 'upsell_flows', user.id),
      getAutomationStats(db, 'payment_recoveries', user.id),
      getAutomationStats(db, 'vip_customers', user.id),
    ]);

    return NextResponse.json({
      settings: account,
      stats: { winback, backinstock, upsell, payrec, vip },
    });
  } catch (e) {
    console.error('[revenue-suite/status]', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}
