import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    inventory: { alerts: 0, errors: 0 },
    carrier: { synced: 0, errors: 0 },
    failover: { retried: 0, errors: 0 },
    priceDrop: { sent: 0, errors: 0 },
  };

  const db = admin();

  // ─── 19. INVENTORY AUTO-REORDER ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, inventory_reorder_enabled, inventory_reorder_threshold, inventory_reorder_qty, inventory_reorder_notify, currency')
      .eq('inventory_reorder_enabled', true);

    for (const account of accounts || []) {
      try {
        const threshold = account.inventory_reorder_threshold || 5;
        const reorderQty = account.inventory_reorder_qty || 20;

        // Find products at or below threshold that don't have a pending alert
        const { data: lowStock } = await db.from('products')
          .select('id, name, stock, price, category, image_urls')
          .eq('account_id', account.id)
          .eq('status', 'active')
          .lte('stock', threshold);

        for (const product of (lowStock || [])) {
          const { data: existing } = await db.from('inventory_reorder_alerts')
            .select('id').eq('product_id', product.id).eq('status', 'pending').maybeSingle();
          if (existing) continue;

          await db.from('inventory_reorder_alerts').insert({
            account_id: account.id, product_id: product.id,
            current_stock: product.stock, threshold,
            suggested_qty: reorderQty, status: 'pending',
          });
          results.inventory.alerts++;

          // Notify owner via dashboard notification
          if (account.inventory_reorder_notify) {
            await db.from('notifications').insert({
              account_id: account.id,
              type: 'inventory_alert',
              title: 'Low Stock Alert',
              message: `${product.name} is at ${product.stock} units (threshold: ${threshold}). Suggested reorder: ${reorderQty} units.`,
              data: { product_id: product.id, current_stock: product.stock, suggested_qty: reorderQty },
              priority: product.stock === 0 ? 'high' : 'medium',
            });
          }
        }
      } catch (e) {
        console.error('[operational] inventory error', account.id, e.message);
        results.inventory.errors++;
      }
    }
  } catch (e) { results.inventory.errors++; }

  // ─── 21. CARRIER STATUS SYNC ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, carrier_sync_enabled, carrier_arjamex_api_key, carrier_bosta_api_key, carrier_mylerz_api_key')
      .eq('carrier_sync_enabled', true);

    for (const account of accounts || []) {
      try {
        // Find shipments not synced in last 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: shipments } = await db.from('carrier_shipments')
          .select('id, order_id, carrier, tracking_number, last_status, history')
          .eq('account_id', account.id)
          .or(`last_synced_at.is.null,last_synced_at.lt.${twoHoursAgo}`)
          .limit(50);

        for (const shipment of (shipments || [])) {
          // Simulate carrier API call (would be real API integration in production)
          // For now, just mark as synced and check if status changed
          let newStatus = shipment.last_status;
          try {
            newStatus = await fetchCarrierStatus(shipment, account);
          } catch (e) {
            // API call failed — skip this shipment
            continue;
          }

          const history = Array.isArray(shipment.history) ? shipment.history : [];
          const statusChanged = newStatus && newStatus !== shipment.last_status;

          if (statusChanged) {
            history.push({
              status: newStatus,
              timestamp: new Date().toISOString(),
            });

            await db.from('carrier_shipments').update({
              last_status: newStatus,
              last_status_at: new Date().toISOString(),
              last_synced_at: new Date().toISOString(),
              history,
              customer_notified: false,
            }).eq('id', shipment.id);

            // Notify customer of status change
            const { data: order } = await db.from('orders')
              .select('id, customer_id, customer:customers(name, channel)')
              .eq('id', shipment.order_id).maybeSingle();

            if (order?.customer) {
              const msg = getCarrierStatusMessage(shipment.carrier, newStatus, shipment.tracking_number);
              const { data: conv } = await db.from('conversations')
                .select('id, channel').eq('customer_id', order.customer_id).eq('account_id', account.id)
                .order('last_message_at', { ascending: false }).limit(1).maybeSingle();

              if (conv) {
                try {
                  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversationId: conv.id, content: msg, type: 'text', channel: conv.channel }),
                  });
                  await db.from('carrier_shipments').update({ customer_notified: true }).eq('id', shipment.id);
                } catch (e) {}
              }
            }
          } else {
            await db.from('carrier_shipments').update({
              last_synced_at: new Date().toISOString(),
            }).eq('id', shipment.id);
          }
          results.carrier.synced++;
        }
      } catch (e) {
        console.error('[operational] carrier error', account.id, e.message);
        results.carrier.errors++;
      }
    }
  } catch (e) { results.carrier.errors++; }

  // ─── 3. PRICE DROP ALERTS ───
  // Find products whose price has dropped, notify customers who showed interest
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, price_drop_alerts_enabled, price_drop_message_template, currency')
      .eq('price_drop_alerts_enabled', true);

    for (const account of accounts || []) {
      try {
        // Find products with a recorded price_at_interest higher than current price
        const { data: interests } = await db.from('product_interest')
          .select(`
            id, customer_id, product_id, price_at_interest,
            customer:customers(id, name, channel),
            product:products(id, name, price, stock)
          `)
          .eq('account_id', account.id)
          .limit(200);

        for (const interest of (interests || [])) {
          if (!interest.product || !interest.customer) continue;
          const currentPrice = parseFloat(interest.product.price || 0);
          const oldPrice = parseFloat(interest.price_at_interest || 0);
          // Only alert if price dropped by at least 10%
          if (oldPrice <= 0 || currentPrice >= oldPrice * 0.9) continue;
          // Skip out of stock
          if (interest.product.stock <= 0) continue;

          // Check if we already sent a price drop alert for this product+customer recently
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: existing } = await db.from('price_drop_alerts')
            .select('id').eq('customer_id', interest.customer_id)
            .eq('product_id', interest.product_id)
            .gte('sent_at', oneWeekAgo).maybeSingle();
          if (existing) continue;

          const message = (account.price_drop_message_template || '')
            .replace('{name}', interest.customer.name || 'there')
            .replace('{product}', interest.product.name)
            .replace('{old_price}', oldPrice.toFixed(2))
            .replace('{new_price}', currentPrice.toFixed(2))
            .replace('{currency}', account.currency || 'EGP')
            .replace('{store_url}', process.env.NEXT_PUBLIC_APP_URL || '');

          // Find conversation
          const { data: conv } = await db.from('conversations')
            .select('id, channel').eq('customer_id', interest.customer_id).eq('account_id', account.id)
            .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
          if (!conv) continue;

          try {
            const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId: conv.id, content: message, type: 'text', channel: conv.channel }),
            });
            if (!sendRes.ok) continue;
          } catch (e) { continue; }

          await db.from('price_drop_alerts').insert({
            account_id: account.id, customer_id: interest.customer_id,
            product_id: interest.product_id, old_price: oldPrice, new_price: currentPrice,
            message_sent: message,
          });
          results.priceDrop.sent++;
        }
      } catch (e) {
        console.error('[operational] price drop error', account.id, e.message);
        results.priceDrop.errors++;
      }
    }
  } catch (e) { results.priceDrop.errors++; }

  return NextResponse.json({ success: true, results, ts: new Date().toISOString() });
}

// Stub — real implementation would call carrier API
async function fetchCarrierStatus(shipment, account) {
  // In production, implement real API calls for each carrier:
  // - Aramex: https://www.aramex.com/api/shipment/tracking
  // - Bosta: https://bosta.co/api/v1/shipments/tracking
  // - Mylerz: https://mylerz.net/api/track
  // For now, return the existing status (no change)
  return shipment.last_status;
}

function getCarrierStatusMessage(carrier, status, tracking) {
  const messages = {
    picked_up: `📦 Your order has been picked up by ${carrier}. Tracking: ${tracking}`,
    in_transit: `🚚 Your package is on the way! Current status: In Transit. Track it: ${tracking}`,
    out_for_delivery: `📍 Great news! Your package is out for delivery and should arrive today.`,
    delivered: `✅ Your order has been delivered! We'd love to hear your feedback.`,
    failed_delivery: `⚠️ Delivery attempt failed. The carrier will try again. Please check your tracking: ${tracking}`,
    returned: `↩️ Your package has been returned to sender. Please contact us to resolve.`,
  };
  return messages[status] || `📦 Shipment update (${carrier}): ${status}. Tracking: ${tracking}`;
}
