import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateDiscountCode } from '@/lib/automation/helpers';

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}

export async function POST(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    birthday: { sent: 0, errors: 0 },
    welcome: { sent: 0, errors: 0 },
    reorder: { sent: 0, errors: 0 },
    review: { sent: 0, errors: 0 },
    segments: { updated: 0, errors: 0 },
  };

  const db = admin();
  const today = new Date();
  const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // ─── 11. BIRTHDAY REWARDS ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, birthday_enabled, birthday_discount_percent, birthday_message_template, currency')
      .eq('birthday_enabled', true);

    for (const account of accounts || []) {
      try {
        // Find customers whose birthday is today (month-day match)
        const { data: birthdayCustomers } = await db.from('customers')
          .select('id, name, channel, birthday')
          .eq('account_id', account.id)
          .not('birthday', 'is', null);

        for (const customer of (birthdayCustomers || [])) {
          if (!customer.birthday) continue;
          const custBday = new Date(customer.birthday);
          const custMonthDay = `${String(custBday.getMonth() + 1).padStart(2, '0')}-${String(custBday.getDate()).padStart(2, '0')}`;
          if (custMonthDay !== todayMonthDay) continue;

          // Check if already sent this year
          const yearStart = new Date(today.getFullYear(), 0, 1).toISOString();
          const { data: existing } = await db.from('birthday_rewards')
            .select('id').eq('account_id', account.id).eq('customer_id', customer.id)
            .gte('sent_at', yearStart).maybeSingle();
          if (existing) continue;

          const code = generateDiscountCode('BDAY');
          const discount = account.birthday_discount_percent || 20;
          const message = (account.birthday_message_template || '')
            .replace('{name}', customer.name || 'there')
            .replace('{store}', account.business_name || 'our store')
            .replace('{discount}', String(discount))
            .replace('{code}', code);

          const { data: conv } = await db.from('conversations')
            .select('id, channel').eq('customer_id', customer.id).eq('account_id', account.id)
            .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
          if (!conv) continue;

          try {
            const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId: conv.id, content: message, type: 'text', channel: conv.channel }),
            });
            if (!sendRes.ok) continue;
          } catch (e) { continue; }

          await db.from('birthday_rewards').insert({
            account_id: account.id, customer_id: customer.id,
            discount_code: code, discount_percent: discount, message_sent: message,
          });
          results.birthday.sent++;
        }
      } catch (e) {
        console.error('[lifecycle] birthday error', account.id, e.message);
        results.birthday.errors++;
      }
    }
  } catch (e) { results.birthday.errors++; }

  // ─── 12. FIRST-ORDER WELCOME SERIES ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, welcome_series_enabled, welcome_discount_percent, currency')
      .eq('welcome_series_enabled', true);

    for (const account of accounts || []) {
      try {
        // Step 1: customers with first_order_at 1 day ago, no welcome step 1 sent
        const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
        const { data: step1Customers } = await db.from('customers')
          .select('id, name, channel, first_order_at')
          .eq('account_id', account.id)
          .not('first_order_at', 'is', null)
          .lte('first_order_at', oneDayAgo)
          .order('first_order_at', { ascending: false })
          .limit(50);

        for (const customer of (step1Customers || [])) {
          const { data: existing } = await db.from('welcome_series')
            .select('id').eq('account_id', account.id).eq('customer_id', customer.id).eq('step', 1)
            .maybeSingle();
          if (existing) continue;

          const code = generateDiscountCode('WELCOME');
          const discount = account.welcome_discount_percent || 10;
          const message = `Welcome to ${account.business_name || 'our store'}, ${customer.name || 'there'}! 🎉 Thanks for your first order. Here's ${discount}% off your next purchase with code: ${code}. Reply if you need anything!`;

          const { data: conv } = await db.from('conversations')
            .select('id, channel').eq('customer_id', customer.id).eq('account_id', account.id)
            .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
          if (!conv) continue;

          try {
            const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId: conv.id, content: message, type: 'text', channel: conv.channel }),
            });
            if (!sendRes.ok) continue;
          } catch (e) { continue; }

          await db.from('welcome_series').insert({
            account_id: account.id, customer_id: customer.id, step: 1,
            message_sent: message, discount_code: code,
          });
          results.welcome.sent++;
        }

        // Step 2: 3 days after step 1
        // Step 3: 5 days after step 1
        // (simplified — could be expanded)
      } catch (e) {
        console.error('[lifecycle] welcome error', account.id, e.message);
        results.welcome.errors++;
      }
    }
  } catch (e) { results.welcome.errors++; }

  // ─── 13. REORDER REMINDERS ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, reorder_reminders_enabled, reorder_reminder_days, reorder_message_template')
      .eq('reorder_reminders_enabled', true);

    for (const account of accounts || []) {
      try {
        const reminderDays = account.reorder_reminder_days || 25;
        const cutoffStart = new Date(Date.now() - (reminderDays + 2) * 24 * 60 * 60 * 1000).toISOString();
        const cutoffEnd = new Date(Date.now() - reminderDays * 24 * 60 * 60 * 1000).toISOString();

        // Find delivered orders in the reminder window
        const { data: orders } = await db.from('orders')
          .select('id, order_number, items, customer_id, customer:customers(id, name, channel)')
          .eq('account_id', account.id)
          .eq('status', 'delivered')
          .gte('created_at', cutoffStart)
          .lte('created_at', cutoffEnd);

        for (const order of (orders || [])) {
          const { data: existing } = await db.from('reorder_reminders')
            .select('id').eq('order_id', order.id).maybeSingle();
          if (existing) continue;

          const firstItem = order.items?.[0]?.name || 'your item';
          const message = (account.reorder_message_template || '')
            .replace('{name}', order.customer?.name || 'there')
            .replace('{product}', firstItem)
            .replace('{store_url}', process.env.NEXT_PUBLIC_APP_URL || '');

          const { data: conv } = await db.from('conversations')
            .select('id, channel').eq('customer_id', order.customer_id).eq('account_id', account.id)
            .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
          if (!conv) continue;

          try {
            const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId: conv.id, content: message, type: 'text', channel: conv.channel }),
            });
            if (!sendRes.ok) continue;
          } catch (e) { continue; }

          await db.from('reorder_reminders').insert({
            account_id: account.id, customer_id: order.customer_id,
            order_id: order.id, product_name: firstItem, message_sent: message,
          });
          results.reorder.sent++;
        }
      } catch (e) {
        console.error('[lifecycle] reorder error', account.id, e.message);
        results.reorder.errors++;
      }
    }
  } catch (e) { results.reorder.errors++; }

  // ─── 14. REVIEW TIMING OPTIMIZATION ───
  // Find review_requests scheduled for now, send them
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id').eq('review_optimization_enabled', true);

    for (const account of accounts || []) {
      try {
        const nowIso = new Date().toISOString();
        const { data: due } = await db.from('review_requests')
          .select('id, order_id, customer_id, customer:customers(id, name, channel)')
          .eq('account_id', account.id)
          .eq('status', 'scheduled')
          .lte('scheduled_for', nowIso)
          .limit(50);

        for (const req of (due || [])) {
          const message = `Hi ${req.customer?.name || 'there'}! How was your recent order? We'd love to hear your feedback. Reply with a rating 1-5 ⭐ or leave a review: ${process.env.NEXT_PUBLIC_APP_URL}/review?order=${req.order_id}`;

          const { data: conv } = await db.from('conversations')
            .select('id, channel').eq('customer_id', req.customer_id).eq('account_id', account.id)
            .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
          if (!conv) continue;

          try {
            const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId: conv.id, content: message, type: 'text', channel: conv.channel }),
            });
            if (!sendRes.ok) continue;
          } catch (e) { continue; }

          await db.from('review_requests')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', req.id);
          results.review.sent++;
        }
      } catch (e) {
        console.error('[lifecycle] review error', account.id, e.message);
        results.review.errors++;
      }
    }
  } catch (e) { results.review.errors++; }

  // ─── 15. SMART SEGMENTATION AUTO-UPDATE ───
  // Update dynamic segments for accounts that have it enabled
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id').eq('segment_auto_update_enabled', true);

    for (const account of accounts || []) {
      try {
        // Trigger segment recompute via internal API
        const { data: segments } = await db.from('customer_segments')
          .select('id').eq('account_id', account.id).eq('is_dynamic', true);

        for (const segment of (segments || [])) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/segments/${segment.id}/compute`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
            });
            results.segments.updated++;
          } catch (e) {}
        }
      } catch (e) {
        console.error('[lifecycle] segments error', account.id, e.message);
        results.segments.errors++;
      }
    }
  } catch (e) { results.segments.errors++; }

  return NextResponse.json({ success: true, results, ts: new Date().toISOString() });
}
