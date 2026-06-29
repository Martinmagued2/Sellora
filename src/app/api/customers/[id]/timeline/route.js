import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// GET — unified timeline for a customer (merges timeline table + orders + messages + reviews)
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const db = admin();

    // Verify ownership
    const { data: customer } = await db.from('customers')
      .select('id').eq('id', id).eq('account_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Fetch from multiple sources in parallel
    const [timelineRes, ordersRes, messagesRes, reviewsRes, notesRes, tasksRes] = await Promise.all([
      db.from('customer_timeline').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
      db.from('orders').select('id, order_number, total, status, payment_status, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(10),
      db.from('messages').select('content, direction, is_ai, created_at, conversation_id').eq('conversation_id',
        // subquery isn't supported in select — use a simpler approach
        '').limit(1).maybeSingle().then(() => null).catch(() => null), // skip for now — messages need conversation_id lookup
      db.from('product_reviews').select('id, rating, title, body, created_at, product_id').eq('customer_id', id).order('created_at', { ascending: false }).limit(5),
      db.from('customer_notes').select('id, body, author_name, pinned, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(10),
      db.from('customer_tasks').select('id, title, status, priority, due_date, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(10),
    ]);

    // Merge all events into a unified timeline
    const events = [];

    // Explicit timeline events
    for (const t of (timelineRes.data || [])) {
      events.push({
        type: t.event_type,
        title: t.title,
        description: t.description,
        metadata: t.metadata,
        actor: t.actor_name,
        created_at: t.created_at,
      });
    }

    // Orders
    for (const o of (ordersRes.data || [])) {
      events.push({
        type: 'order',
        title: `Order ${o.order_number} — ${o.total} EGP`,
        description: `Status: ${o.status} · Payment: ${o.payment_status}`,
        created_at: o.created_at,
      });
    }

    // Reviews
    for (const r of (reviewsRes.data || [])) {
      events.push({
        type: 'review',
        title: `${r.rating}-star review`,
        description: r.title || (r.body || '').slice(0, 100),
        created_at: r.created_at,
      });
    }

    // Notes (already in timeline, but include if not there)
    // Skip — already added via timeline

    // Tasks
    for (const t of (tasksRes.data || [])) {
      events.push({
        type: 'task',
        title: `Task: ${t.title}`,
        description: `Status: ${t.status}${t.due_date ? ` · Due: ${new Date(t.due_date).toLocaleDateString()}` : ''}`,
        created_at: t.created_at,
      });
    }

    // Sort all events by date (newest first)
    events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json({ events: events.slice(0, 50) });
  } catch (e) {
    console.error('[timeline]', e);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}
