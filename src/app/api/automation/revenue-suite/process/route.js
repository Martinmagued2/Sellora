import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateDiscountCode } from '@/lib/automation/helpers';

// Unified revenue automation processor.
// Runs daily via cron. Processes all 5 automations for all accounts that have
// them enabled:
//   1. Win-back campaigns (dormant customers)
//   2. Back-in-stock notifications
//   3. Post-purchase upsell
//   4. Failed payment recovery
//   5. VIP customer tagging

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}

export async function POST(req) {
  // Auth: CRON_SECRET
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    winback: { processed: 0, sent: 0, errors: 0 },
    backInStock: { processed: 0, sent: 0, errors: 0 },
    upsell: { processed: 0, sent: 0, errors: 0 },
    paymentRecovery: { processed: 0, sent: 0, errors: 0 },
    vip: { processed: 0, tagged: 0, errors: 0 },
  };

  const db = admin();

  // ─── 1. WIN-BACK CAMPAIGNS ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, winback_enabled, winback_days_threshold, winback_discount_percent, winback_message_template, currency')
      .eq('winback_enabled', true);

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        try {
          const sent = await processWinBack(db, account);
          results.winback.sent += sent;
          results.winback.processed++;
        } catch (e) {
          console.error('[revenue-suite] winback error for account', account.id, e.message);
          results.winback.errors++;
        }
      }
    }
  } catch (e) {
    console.error('[revenue-suite] winback fatal:', e.message);
    results.winback.errors++;
  }

  // ─── 2. BACK-IN-STOCK NOTIFICATIONS ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, back_in_stock_enabled, back_in_stock_message_template')
      .eq('back_in_stock_enabled', true);

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        try {
          const sent = await processBackInStock(db, account);
          results.backInStock.sent += sent;
          results.backInStock.processed++;
        } catch (e) {
          console.error('[revenue-suite] back-in-stock error for account', account.id, e.message);
          results.backInStock.errors++;
        }
      }
    }
  } catch (e) {
    console.error('[revenue-suite] back-in-stock fatal:', e.message);
    results.backInStock.errors++;
  }

  // ─── 3. POST-PURCHASE UPSELL ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, upsell_enabled, upsell_delay_days, upsell_discount_percent, upsell_message_template, currency')
      .eq('upsell_enabled', true);

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        try {
          const sent = await processUpsell(db, account);
          results.upsell.sent += sent;
          results.upsell.processed++;
        } catch (e) {
          console.error('[revenue-suite] upsell error for account', account.id, e.message);
          results.upsell.errors++;
        }
      }
    }
  } catch (e) {
    console.error('[revenue-suite] upsell fatal:', e.message);
    results.upsell.errors++;
  }

  // ─── 4. FAILED PAYMENT RECOVERY ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, payment_recovery_enabled, payment_recovery_discount_percent, payment_recovery_message_template, currency')
      .eq('payment_recovery_enabled', true);

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        try {
          const sent = await processPaymentRecovery(db, account);
          results.paymentRecovery.sent += sent;
          results.paymentRecovery.processed++;
        } catch (e) {
          console.error('[revenue-suite] payment recovery error for account', account.id, e.message);
          results.paymentRecovery.errors++;
        }
      }
    }
  } catch (e) {
    console.error('[revenue-suite] payment recovery fatal:', e.message);
    results.paymentRecovery.errors++;
  }

  // ─── 5. VIP CUSTOMER TAGGING ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, vip_enabled, vip_threshold, vip_welcome_message, currency')
      .eq('vip_enabled', true);

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        try {
          const tagged = await processVIP(db, account);
          results.vip.tagged += tagged;
          results.vip.processed++;
        } catch (e) {
          console.error('[revenue-suite] vip error for account', account.id, e.message);
          results.vip.errors++;
        }
      }
    }
  } catch (e) {
    console.error('[revenue-suite] vip fatal:', e.message);
    results.vip.errors++;
  }

  return NextResponse.json({ success: true, results, ts: new Date().toISOString() });
}

// ════════════════════════════════════════════════════════════
// 1. WIN-BACK — find dormant customers, send "we miss you" + discount
// ════════════════════════════════════════════════════════════
async function processWinBack(db, account) {
  const threshold = account.winback_days_threshold || 60;
  const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000).toISOString();
  let sent = 0;

  // Find customers who:
  // - belong to this account
  // - have total_orders > 0 (have ordered before)
  // - last_order_at < cutoff (haven't ordered in threshold days)
  // - are NOT already in win_back_campaigns
  const { data: dormant } = await db.from('customers')
    .select('id, name, phone, channel, total_orders, total_spent, last_order_at')
    .eq('account_id', account.id)
    .gt('total_orders', 0)
    .lt('last_order_at', cutoff)
    .order('last_order_at', { ascending: true })
    .limit(50); // cap per run

  if (!dormant || dormant.length === 0) return 0;

  for (const customer of dormant) {
    // Check if already sent a win-back
    const { data: existing } = await db.from('win_back_campaigns')
      .select('id')
      .eq('account_id', account.id)
      .eq('customer_id', customer.id)
      .maybeSingle();
    if (existing) continue;

    // Generate discount code
    const code = generateDiscountCode('WB');
    const discount = account.winback_discount_percent || 10;

    // Build message
    const message = (account.winback_message_template || '')
      .replace('{name}', customer.name || 'there')
      .replace('{store}', account.business_name || 'our store')
      .replace('{discount}', String(discount))
      .replace('{code}', code);

    // Find the customer's most recent conversation to send the message
    const { data: conversation } = await db.from('conversations')
      .select('id, channel')
      .eq('customer_id', customer.id)
      .eq('account_id', account.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) continue;

    // Send the message
    try {
      const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          content: message,
          type: 'text',
          channel: conversation.channel,
        }),
      });
      if (!sendRes.ok) continue;
    } catch (e) {
      continue;
    }

    // Record the win-back
    await db.from('win_back_campaigns').insert({
      account_id: account.id,
      customer_id: customer.id,
      days_dormant: threshold,
      discount_code: code,
      discount_percent: discount,
      message_sent: message,
      status: 'sent',
    });
    sent++;
  }

  return sent;
}

// ════════════════════════════════════════════════════════════
// 2. BACK-IN-STOCK — notify customers who asked about now-restocked products
// ════════════════════════════════════════════════════════════
async function processBackInStock(db, account) {
  let sent = 0;

  // Find back_in_stock_requests that haven't been notified yet
  // where the product now has stock > 0
  const { data: requests } = await db.from('back_in_stock_requests')
    .select(`
      id, customer_id, product_id, conversation_id,
      customer:customers(id, name, channel),
      product:products(id, name, stock, price)
    `)
    .eq('account_id', account.id)
    .eq('notified', false)
    .gt('product.stock', 0);

  if (!requests || requests.length === 0) return 0;

  for (const req of requests) {
    if (!req.customer || !req.product) continue;

    const message = (account.back_in_stock_message_template || '')
      .replace('{name}', req.customer.name || 'there')
      .replace('{product}', req.product.name)
      .replace('{store_url}', process.env.NEXT_PUBLIC_APP_URL || '');

    // Find the conversation
    let conversationId = req.conversation_id;
    if (!conversationId) {
      const { data: conv } = await db.from('conversations')
        .select('id, channel')
        .eq('customer_id', req.customer_id)
        .eq('account_id', account.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!conv) continue;
      conversationId = conv.id;
    }

    // Send the message
    try {
      const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          content: message,
          type: 'text',
          channel: req.customer.channel || 'whatsapp',
        }),
      });
      if (!sendRes.ok) continue;
    } catch (e) {
      continue;
    }

    // Mark as notified
    await db.from('back_in_stock_requests')
      .update({ notified: true, notified_at: new Date().toISOString() })
      .eq('id', req.id);
    sent++;
  }

  return sent;
}

// ════════════════════════════════════════════════════════════
// 3. POST-PURCHASE UPSELL — suggest complementary products after delivery
// ════════════════════════════════════════════════════════════
async function processUpsell(db, account) {
  const delayDays = account.upsell_delay_days || 3;
  const cutoff = new Date(Date.now() - delayDays * 24 * 60 * 60 * 1000).toISOString();
  const tooOld = new Date(Date.now() - (delayDays + 7) * 24 * 60 * 60 * 1000).toISOString();
  let sent = 0;

  // Find delivered orders that are delayDays old, not too old, and don't have an upsell yet
  const { data: orders } = await db.from('orders')
    .select(`
      id, order_number, total, items, customer_id,
      customer:customers(id, name, channel)
    `)
    .eq('account_id', account.id)
    .eq('status', 'delivered')
    .gte('created_at', tooOld)
    .lte('created_at', cutoff);

  if (!orders || orders.length === 0) return 0;

  for (const order of orders) {
    // Check if upsell already sent
    const { data: existing } = await db.from('upsell_flows')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();
    if (existing) continue;

    // Find complementary products — same category, excluding what they bought
    const boughtNames = (order.items || []).map(i => i.name).filter(Boolean);
    const { data: suggestions } = await db.from('products')
      .select('id, name, price, category, image_urls')
      .eq('account_id', account.id)
      .eq('status', 'active')
      .gt('stock', 0)
      .not('name', 'in', `(${boughtNames.map(n => `"${n}"`).join(',')})`)
      .limit(3);

    if (!suggestions || suggestions.length === 0) continue;

    const code = generateDiscountCode('UP');
    const discount = account.upsell_discount_percent || 15;
    const accessory = suggestions[0]?.name || 'this accessory';

    const firstItem = order.items?.[0]?.name || 'your purchase';
    const message = (account.upsell_message_template || '')
      .replace('{name}', order.customer?.name || 'there')
      .replace('{item}', firstItem)
      .replace('{accessory}', accessory)
      .replace('{discount}', String(discount));

    // Find the conversation
    const { data: conversation } = await db.from('conversations')
      .select('id, channel')
      .eq('customer_id', order.customer_id)
      .eq('account_id', account.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conversation) continue;

    try {
      const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          content: message,
          type: 'text',
          channel: conversation.channel,
        }),
      });
      if (!sendRes.ok) continue;
    } catch (e) {
      continue;
    }

    await db.from('upsell_flows').insert({
      account_id: account.id,
      order_id: order.id,
      customer_id: order.customer_id,
      suggested_products: suggestions.map(s => ({ id: s.id, name: s.name, price: s.price })),
      discount_code: code,
      discount_percent: discount,
      message_sent: message,
      status: 'sent',
    });
    sent++;
  }

  return sent;
}

// ════════════════════════════════════════════════════════════
// 4. PAYMENT RECOVERY — message customers with failed payments
// ════════════════════════════════════════════════════════════
async function processPaymentRecovery(db, account) {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  const tooOld = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours
  let sent = 0;

  // Find orders with pending/failed payment that are 2-48 hours old
  const { data: orders } = await db.from('orders')
    .select(`
      id, order_number, total, payment_status, customer_id,
      customer:customers(id, name, channel)
    `)
    .eq('account_id', account.id)
    .in('payment_status', ['pending', 'unpaid', 'failed'])
    .gte('created_at', tooOld)
    .lte('created_at', cutoff);

  if (!orders || orders.length === 0) return 0;

  for (const order of orders) {
    // Check if recovery already sent
    const { data: existing } = await db.from('payment_recoveries')
      .select('id, attempts')
      .eq('order_id', order.id)
      .maybeSingle();
    if (existing && existing.attempts >= 2) continue; // max 2 attempts

    const code = generateDiscountCode('PR');
    const discount = account.payment_recovery_discount_percent || 5;
    const message = (account.payment_recovery_message_template || '')
      .replace('{name}', order.customer?.name || 'there')
      .replace('{discount}', String(discount))
      .replace('{code}', code);

    // Find the conversation
    const { data: conversation } = await db.from('conversations')
      .select('id, channel')
      .eq('customer_id', order.customer_id)
      .eq('account_id', account.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conversation) continue;

    try {
      const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          content: message,
          type: 'text',
          channel: conversation.channel,
        }),
      });
      if (!sendRes.ok) continue;
    } catch (e) {
      continue;
    }

    if (existing) {
      await db.from('payment_recoveries')
        .update({ attempts: existing.attempts + 1, message_sent: message })
        .eq('id', existing.id);
    } else {
      await db.from('payment_recoveries').insert({
        account_id: account.id,
        order_id: order.id,
        customer_id: order.customer_id,
        discount_code: code,
        discount_percent: discount,
        message_sent: message,
        attempts: 1,
        status: 'sent',
      });
    }
    sent++;
  }

  return sent;
}

// ════════════════════════════════════════════════════════════
// 5. VIP CUSTOMERS — tag high-spenders, send welcome message
// ════════════════════════════════════════════════════════════
async function processVIP(db, account) {
  const threshold = account.vip_threshold || 5000;
  let tagged = 0;

  // Find customers who crossed the threshold but aren't tagged VIP yet
  const { data: customers } = await db.from('customers')
    .select('id, name, channel, total_spent, total_orders')
    .eq('account_id', account.id)
    .gte('total_spent', threshold);

  if (!customers || customers.length === 0) return 0;

  for (const customer of customers) {
    const { data: existing } = await db.from('vip_customers')
      .select('id, welcome_sent_at')
      .eq('account_id', account.id)
      .eq('customer_id', customer.id)
      .maybeSingle();
    if (existing && existing.welcome_sent_at) continue; // already welcomed

    const message = (account.vip_welcome_message || '')
      .replace('{name}', customer.name || 'there');

    // Find conversation
    const { data: conversation } = await db.from('conversations')
      .select('id, channel')
      .eq('customer_id', customer.id)
      .eq('account_id', account.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let welcomeSentAt = null;
    if (conversation) {
      try {
        const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversation.id,
            content: message,
            type: 'text',
            channel: conversation.channel,
          }),
        });
        if (sendRes.ok) welcomeSentAt = new Date().toISOString();
      } catch (e) {}
    }

    if (existing) {
      if (welcomeSentAt) {
        await db.from('vip_customers')
          .update({ welcome_sent_at: welcomeSentAt, total_spent: customer.total_spent })
          .eq('id', existing.id);
      }
    } else {
      await db.from('vip_customers').insert({
        account_id: account.id,
        customer_id: customer.id,
        total_spent: customer.total_spent,
        welcome_sent_at: welcomeSentAt,
      });
      tagged++;
    }

    // Add 'vip' tag to customer
    const { data: cust } = await db.from('customers')
      .select('tags')
      .eq('id', customer.id)
      .maybeSingle();
    if (cust && Array.isArray(cust.tags) && !cust.tags.includes('vip')) {
      await db.from('customers')
        .update({ tags: [...cust.tags, 'vip'] })
        .eq('id', customer.id);
    } else if (cust && !Array.isArray(cust.tags)) {
      await db.from('customers')
        .update({ tags: ['vip'] })
        .eq('id', customer.id);
    }
  }

  return tagged;
}
