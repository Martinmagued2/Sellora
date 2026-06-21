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
    churn: { flagged: 0, saveCampaigns: 0, errors: 0 },
    recommendations: { pairs: 0, errors: 0 },
    sendTime: { updated: 0, errors: 0 },
  };

  const db = admin();

  // ─── 8. CHURN PREDICTION ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, business_name, churn_prediction_enabled, churn_threshold_days, churn_save_discount, currency')
      .eq('churn_prediction_enabled', true);

    for (const account of accounts || []) {
      try {
        const thresholdDays = account.churn_threshold_days || 45;
        const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();

        // Find customers who haven't ordered in threshold days
        const { data: atRisk } = await db.from('customers')
          .select('id, name, channel, total_orders, total_spent, last_order_at, created_at')
          .eq('account_id', account.id)
          .gt('total_orders', 0)
          .lt('last_order_at', thresholdDate)
          .limit(100);

        for (const customer of (atRisk || [])) {
          // Calculate risk score (0-100)
          const daysSinceOrder = Math.floor((Date.now() - new Date(customer.last_order_at).getTime()) / (24 * 60 * 60 * 1000));
          const orderFreq = customer.total_orders / Math.max(1, (Date.now() - new Date(customer.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000));
          const riskScore = Math.min(100, Math.max(0,
            (daysSinceOrder / thresholdDays) * 50 +  // 50% weight on recency
            (1 - Math.min(orderFreq, 1)) * 30 +      // 30% weight on frequency
            (customer.total_spent < 200 ? 20 : 0)     // 20% weight on value
          ));

          const riskLevel = riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';

          // Upsert risk score
          const { data: existing } = await db.from('churn_risk_scores')
            .select('id, save_campaign_sent').eq('account_id', account.id).eq('customer_id', customer.id).maybeSingle();

          if (existing) {
            await db.from('churn_risk_scores').update({
              risk_score: riskScore, risk_level: riskLevel,
              factors: { daysSinceOrder, orderFreq, totalSpent: customer.total_spent },
              calculated_at: new Date().toISOString(),
            }).eq('id', existing.id);
          } else {
            await db.from('churn_risk_scores').insert({
              account_id: account.id, customer_id: customer.id,
              risk_score: riskScore, risk_level: riskLevel,
              factors: { daysSinceOrder, orderFreq, totalSpent: customer.total_spent },
            });
          }
          results.churn.flagged++;

          // Trigger save campaign for high+ risk customers who haven't been contacted
          if ((riskLevel === 'high' || riskLevel === 'critical') && existing && !existing.save_campaign_sent) {
            const code = generateDiscountCode('SAVE');
            const discount = account.churn_save_discount || 15;
            const message = `Hi ${customer.name || 'there'}! We've missed you at ${account.business_name || 'our store'}. Here's a special ${discount}% off to welcome you back: ${code}. Valid for 7 days. We'd love to see you again! 💜`;

            const { data: conv } = await db.from('conversations')
              .select('id, channel').eq('customer_id', customer.id).eq('account_id', account.id)
              .order('last_message_at', { ascending: false }).limit(1).maybeSingle();

            if (conv) {
              try {
                const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ conversationId: conv.id, content: message, type: 'text', channel: conv.channel }),
                });
                if (sendRes.ok) {
                  await db.from('churn_risk_scores').update({
                    save_campaign_sent: true, save_campaign_sent_at: new Date().toISOString(),
                  }).eq('id', existing.id);
                  results.churn.saveCampaigns++;
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.error('[ai-ext] churn error', account.id, e.message);
        results.churn.errors++;
      }
    }
  } catch (e) { results.churn.errors++; }

  // ─── 9. SMART PRODUCT RECOMMENDATIONS (co-purchase analysis) ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id').eq('product_recommendations_enabled', true);

    for (const account of accounts || []) {
      try {
        // Get all orders with items for this account
        const { data: orders } = await db.from('orders')
          .select('id, items')
          .eq('account_id', account.id)
          .not('items', 'is', null)
          .limit(500);

        // Build co-purchase map
        const coPurchaseMap = new Map(); // key: "productAId|productBId" → count
        for (const order of (orders || [])) {
          const items = Array.isArray(order.items) ? order.items : [];
          const productNames = items.map(i => i.name).filter(Boolean);
          // For each pair of products in the same order, increment co-purchase count
          for (let i = 0; i < productNames.length; i++) {
            for (let j = i + 1; j < productNames.length; j++) {
              const key = [productNames[i], productNames[j]].sort().join('|');
              coPurchaseMap.set(key, (coPurchaseMap.get(key) || 0) + 1);
            }
          }
        }

        // Get product name → id map
        const { data: products } = await db.from('products')
          .select('id, name, category').eq('account_id', account.id);
        const productMap = new Map((products || []).map(p => [p.name, p]));

        // Upsert recommendations
        let pairsAdded = 0;
        for (const [key, count] of coPurchaseMap) {
          if (count < 1) continue;
          const [nameA, nameB] = key.split('|');
          const prodA = productMap.get(nameA);
          prodB = productMap.get(nameB);
          if (!prodA || !prodB) continue;

          const { error } = await db.from('product_recommendations')
            .upsert({
              account_id: account.id,
              product_id: prodA.id,
              recommended_product_id: prodB.id,
              co_purchase_count: count,
              last_co_purchase_at: new Date().toISOString(),
              recommendation_type: 'bought_together',
              score: count,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'account_id,product_id,recommended_product_id,recommendation_type' });

          if (!error) {
            // Also add the reverse (B → A)
            await db.from('product_recommendations')
              .upsert({
                account_id: account.id,
                product_id: prodB.id,
                recommended_product_id: prodA.id,
                co_purchase_count: count,
                last_co_purchase_at: new Date().toISOString(),
                recommendation_type: 'bought_together',
                score: count,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'account_id,product_id,recommended_product_id,recommendation_type' });
            pairsAdded++;
          }
        }

        // Also add "similar_category" recommendations (top products in same category)
        const categoryMap = new Map();
        for (const p of (products || [])) {
          if (!p.category) continue;
          if (!categoryMap.has(p.category)) categoryMap.set(p.category, []);
          categoryMap.get(p.category).push(p);
        }
        for (const [category, prods] of categoryMap) {
          for (const p of prods) {
            const similar = prods.filter(x => x.id !== p.id).slice(0, 3);
            for (const s of similar) {
              await db.from('product_recommendations')
                .upsert({
                  account_id: account.id,
                  product_id: p.id,
                  recommended_product_id: s.id,
                  recommendation_type: 'similar_category',
                  score: 0.5,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'account_id,product_id,recommended_product_id,recommendation_type' });
              pairsAdded++;
            }
          }
        }
        results.recommendations.pairs += pairsAdded;
      } catch (e) {
        console.error('[ai-ext] recs error', account.id, e.message);
        results.recommendations.errors++;
      }
    }
  } catch (e) { results.recommendations.errors++; }

  // ─── 17. OPTIMAL SEND-TIME AI ───
  // Analyze when each customer responds and update their best_hour
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id').eq('send_time_optimization_enabled', true);

    for (const account of accounts || []) {
      try {
        // Get last 30 days of incoming messages (responses) per customer
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: messages } = await db.from('messages')
          .select('conversation_id, created_at, direction')
          .eq('account_id', account.id)
          .eq('direction', 'incoming')
          .gte('created_at', thirtyDaysAgo)
          .limit(1000);

        if (!messages || messages.length === 0) continue;

        // Get conversation → customer map
        const convIds = [...new Set(messages.map(m => m.conversation_id))];
        const { data: convs } = await db.from('conversations')
          .select('id, customer_id').in('id', convIds);
        const convToCustomer = new Map((convs || []).map(c => [c.id, c.customer_id]));

        // Aggregate: for each customer, count responses by hour
        const customerHourMap = new Map(); // customer_id → { hour → count }
        for (const msg of messages) {
          const customerId = convToCustomer.get(msg.conversation_id);
          if (!customerId) continue;
          const hour = new Date(msg.created_at).getHours();
          if (!customerHourMap.has(customerId)) customerHourMap.set(customerId, {});
          const hourMap = customerHourMap.get(customerId);
          hourMap[hour] = (hourMap[hour] || 0) + 1;
        }

        // Upsert best_hour for each customer
        for (const [customerId, hourMap] of customerHourMap) {
          let bestHour = null;
          let maxCount = 0;
          let totalResponses = 0;
          for (const [hour, count] of Object.entries(hourMap)) {
            totalResponses += count;
            if (count > maxCount) {
              maxCount = count;
              bestHour = parseInt(hour);
            }
          }
          if (bestHour === null || totalResponses < 3) continue; // need at least 3 samples

          const confidence = maxCount / totalResponses;
          await db.from('customer_send_times')
            .upsert({
              account_id: account.id,
              customer_id: customerId,
              best_hour: bestHour,
              confidence,
              response_samples: totalResponses,
              last_updated: new Date().toISOString(),
            }, { onConflict: 'account_id,customer_id' });
          results.sendTime.updated++;
        }
      } catch (e) {
        console.error('[ai-ext] send-time error', account.id, e.message);
        results.sendTime.errors++;
      }
    }
  } catch (e) { results.sendTime.errors++; }

  return NextResponse.json({ success: true, results, ts: new Date().toISOString() });
}
