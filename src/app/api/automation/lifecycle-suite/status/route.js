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
        birthday_enabled, birthday_discount_percent, birthday_message_template,
        welcome_series_enabled, welcome_discount_percent,
        reorder_reminders_enabled, reorder_reminder_days, reorder_message_template,
        review_optimization_enabled,
        segment_auto_update_enabled,
        smart_routing_enabled, routing_rules,
        faq_auto_generate_enabled,
        negative_review_response_enabled, negative_review_message_template
      `)
      .eq('id', user.id).maybeSingle();

    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const [birthday, welcome, reorder, review, routing, faq, negReview] = await Promise.all([
      getAutomationStats(db, 'birthday_rewards', user.id),
      getAutomationStats(db, 'welcome_series', user.id),
      getAutomationStats(db, 'reorder_reminders', user.id),
      getAutomationStats(db, 'review_requests', user.id),
      getAutomationStats(db, 'routing_assignments', user.id),
      getAutomationStats(db, 'faq_drafts', user.id),
      getAutomationStats(db, 'negative_review_responses', user.id),
    ]);

    return NextResponse.json({
      settings: account,
      stats: { birthday, welcome, reorder, review, routing, faq, negReview },
    });
  } catch (e) {
    console.error('[lifecycle-suite/status]', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}
