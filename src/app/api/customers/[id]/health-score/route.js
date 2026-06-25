import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// POST — recalculate health score for a customer
// Health score (0-100) is based on:
//   - Recency: days since last order (40% weight)
//   - Frequency: orders per month (30% weight)
//   - Value: total spent (20% weight)
//   - Engagement: messages in last 30 days (10% weight)
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const db = admin();

    const { data: customer } = await db.from('customers')
      .select('id, total_orders, total_spent, last_order_at, created_at, account_id')
      .eq('id', id).eq('account_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Calculate score
    let score = 0;

    // 1. Recency (40 points max)
    if (customer.last_order_at) {
      const daysSinceOrder = Math.floor((Date.now() - new Date(customer.last_order_at).getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceOrder <= 7) score += 40;
      else if (daysSinceOrder <= 30) score += 32;
      else if (daysSinceOrder <= 60) score += 24;
      else if (daysSinceOrder <= 90) score += 16;
      else if (daysSinceOrder <= 180) score += 8;
    }

    // 2. Frequency (30 points max)
    const customerAgeMonths = Math.max(1, (Date.now() - new Date(customer.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000));
    const ordersPerMonth = (customer.total_orders || 0) / customerAgeMonths;
    if (ordersPerMonth >= 4) score += 30;
    else if (ordersPerMonth >= 2) score += 24;
    else if (ordersPerMonth >= 1) score += 18;
    else if (ordersPerMonth >= 0.5) score += 12;
    else if (ordersPerMonth > 0) score += 6;

    // 3. Value (20 points max)
    const totalSpent = parseFloat(customer.total_spent || 0);
    if (totalSpent >= 10000) score += 20;
    else if (totalSpent >= 5000) score += 16;
    else if (totalSpent >= 2000) score += 12;
    else if (totalSpent >= 500) score += 8;
    else if (totalSpent > 0) score += 4;

    // 4. Engagement (10 points max) — count messages in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: messageCount } = await db.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', user.id)
      .gte('created_at', thirtyDaysAgo);

    // We can't easily filter by customer_id on messages (they're linked via conversations)
    // Use conversation count as a proxy
    const { count: convCount } = await db.from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', id)
      .gte('last_message_at', thirtyDaysAgo);

    if (convCount >= 5) score += 10;
    else if (convCount >= 3) score += 8;
    else if (convCount >= 1) score += 5;

    score = Math.min(100, Math.round(score));

    // Update customer
    await db.from('customers').update({
      health_score: score,
      health_score_updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Determine health label
    let label, color;
    if (score >= 80) { label = 'Excellent'; color = '#3BA55C'; }
    else if (score >= 60) { label = 'Good'; color = '#5865F2'; }
    else if (score >= 40) { label = 'Fair'; color = '#F8A532'; }
    else if (score >= 20) { label = 'At Risk'; color = '#ED4245'; }
    else { label = 'Critical'; color = '#ED4245'; }

    return NextResponse.json({ score, label, color });
  } catch (e) {
    console.error('[health-score]', e);
    return NextResponse.json({ error: 'Failed to calculate health score' }, { status: 500 });
  }
}
