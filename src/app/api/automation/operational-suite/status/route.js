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

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = admin();
    const { data: account } = await db.from('accounts')
      .select(`
        channel_failover_enabled, sms_provider, sms_sender_id,
        inventory_reorder_enabled, inventory_reorder_threshold, inventory_reorder_qty, inventory_reorder_notify,
        carrier_sync_enabled,
        churn_prediction_enabled, churn_threshold_days, churn_save_discount,
        product_recommendations_enabled,
        send_time_optimization_enabled,
        extended_drip_enabled,
        price_drop_alerts_enabled, price_drop_message_template
      `)
      .eq('id', user.id).maybeSingle();

    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const [failover, reorder, carrier, churn, recs, sendTime, drips, priceDrop] = await Promise.all([
      getAutomationStats(db, 'channel_failovers', user.id),
      getAutomationStats(db, 'inventory_reorder_alerts', user.id),
      getAutomationStats(db, 'carrier_shipments', user.id),
      getAutomationStats(db, 'churn_risk_scores', user.id),
      getAutomationStats(db, 'product_recommendations', user.id),
      getAutomationStats(db, 'customer_send_times', user.id),
      getAutomationStats(db, 'drip_campaign_steps', user.id),
      getAutomationStats(db, 'price_drop_alerts', user.id),
    ]);

    return NextResponse.json({
      settings: account,
      stats: { failover, reorder, carrier, churn, recs, sendTime, drips, priceDrop },
    });
  } catch (e) {
    console.error('[operational-suite/status]', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}
