import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { notify } from '@/lib/notifications';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// GET — list tasks for a customer
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const db = admin();

    const { data: customer } = await db.from('customers')
      .select('id').eq('id', id).eq('account_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { data: tasks, error } = await db.from('customer_tasks')
      .select('*').eq('customer_id', id).order('status', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST — create a task
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const { title, description, due_date, priority = 'normal' } = await req.json();
    if (!title || !title.trim()) return NextResponse.json({ error: 'Task title is required' }, { status: 400 });

    const db = admin();

    const { data: customer } = await db.from('customers')
      .select('id, name').eq('id', id).eq('account_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { data: account } = await db.from('accounts')
      .select('business_name').eq('id', user.id).maybeSingle();

    const { data: task, error } = await db.from('customer_tasks').insert({
      account_id: user.id,
      customer_id: id,
      assigned_to: user.id,
      assigned_name: account?.business_name || 'Team Member',
      title: title.slice(0, 200),
      description: description ? description.slice(0, 2000) : null,
      due_date: due_date || null,
      priority,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update customer's next_followup_at if due_date is set
    if (due_date) {
      await db.from('customers').update({ next_followup_at: due_date }).eq('id', id);
    }

    // Add to timeline
    await db.from('customer_timeline').insert({
      account_id: user.id,
      customer_id: id,
      event_type: 'task',
      title: `Task created: ${title}`,
      description: description ? description.slice(0, 100) : null,
      metadata: { task_id: task.id, priority, due_date },
      actor_id: user.id,
      actor_name: account?.business_name || 'Team Member',
    });

    return NextResponse.json({ task });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PATCH — update task status
export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { task_id, status, ...otherUpdates } = body;
    if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 });

    const updates = { ...otherUpdates, updated_at: new Date().toISOString() };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (status === 'pending' || status === 'in_progress') {
      updates.completed_at = null;
    }

    const db = admin();
    const { data: task, error } = await db.from('customer_tasks')
      .update(updates).eq('id', task_id).eq('account_id', user.id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add to timeline if completed
    if (status === 'completed') {
      await db.from('customer_timeline').insert({
        account_id: user.id,
        customer_id: task.customer_id,
        event_type: 'task',
        title: `Task completed: ${task.title}`,
        actor_id: user.id,
      });
    }

    return NextResponse.json({ task });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE — delete a task
export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('task_id');
    if (!taskId) return NextResponse.json({ error: 'task_id required' }, { status: 400 });

    const db = admin();
    const { error } = await db.from('customer_tasks')
      .delete().eq('id', taskId).eq('account_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
