/**
 * Customer Tasks API — team-aware.
 * GET    /api/customers/[id]/tasks        — list tasks for a customer
 * POST   /api/customers/[id]/tasks        — create task { title, description, due_date, priority, assigned_to? }
 * PATCH  /api/customers/[id]/tasks        — update { task_id, status?, assigned_to?, ... }
 * DELETE /api/customers/[id]/tasks?task_id=...
 *
 * Team members can read/write tasks just like the owner.
 * assigned_to can now be any team member's user_id (was hard-coded to creator).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { canAccessAccount, getActorName } from '@/lib/team-auth';
import { notify } from '@/lib/notifications';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

async function getCustomerIfAccessible(db, customerId, userId) {
  const { data: customer } = await db.from('customers')
    .select('id, account_id, name')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return null;
  const hasAccess = await canAccessAccount({ id: userId }, customer.account_id);
  if (!hasAccess) return null;
  return customer;
}

// GET — list tasks for a customer
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = admin();

    const customer = await getCustomerIfAccessible(db, id, user.id);
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

    const { id } = await params;
    const {
      title, description, due_date, priority = 'normal',
      assigned_to: assignedTo, // optional — defaults to creator
    } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const db = admin();
    const customer = await getCustomerIfAccessible(db, id, user.id);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Resolve assignee
    let finalAssignee = assignedTo || user.id;
    let assigneeName = await getActorName({ id: finalAssignee }, customer.account_id);

    // If assignee is someone other than creator, verify they're on the team
    if (assignedTo && assignedTo !== user.id) {
      const { data: tm } = await db.from('team_members')
        .select('id, name, display_name, invited_email')
        .eq('user_id', assignedTo)
        .eq('account_id', customer.account_id)
        .eq('invite_status', 'accepted')
        .eq('status', 'active')
        .maybeSingle();
      if (!tm && assignedTo !== customer.account_id) {
        return NextResponse.json({ error: 'Assignee is not a team member' }, { status: 400 });
      }
      assigneeName = tm?.name || tm?.display_name || tm?.invited_email || assigneeName;
    }

    const { data: task, error } = await db.from('customer_tasks').insert({
      account_id: customer.account_id,
      customer_id: id,
      assigned_to: finalAssignee,
      assigned_name: assigneeName,
      assigned_at: new Date().toISOString(),
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
    const creatorName = await getActorName(user, customer.account_id);
    await db.from('customer_timeline').insert({
      account_id: customer.account_id,
      customer_id: id,
      event_type: 'task',
      title: `Task created: ${title}`,
      description: description ? description.slice(0, 100) : null,
      metadata: { task_id: task.id, priority, due_date, assigned_to: finalAssignee },
      actor_id: user.id,
      actor_name: creatorName,
    });

    // Notify the assignee (if not the creator)
    if (finalAssignee !== user.id) {
      // Look up assignee email
      let assigneeEmail = null;
      let assigneeName = finalAssigneeName;
      try {
        if (finalAssignee === customer.account_id) {
          // Owner
          const { data: owner } = await db.from('accounts').select('email, owner_name').eq('id', finalAssignee).maybeSingle();
          assigneeEmail = owner?.email;
          assigneeName = owner?.owner_name || assigneeName;
        } else {
          const { data: tm } = await db.from('team_members')
            .select('email, invited_email, name, display_name')
            .eq('user_id', finalAssignee)
            .eq('account_id', customer.account_id)
            .maybeSingle();
          assigneeEmail = tm?.email || tm?.invited_email;
          assigneeName = tm?.name || tm?.display_name || assigneeName;
        }
      } catch (e) { /* ignore */ }

      try {
        await notify(customer.account_id, {
          category: 'team',
          type: 'task_assigned',
          title: `New task assigned: ${title.slice(0, 80)}`,
          message: `${creatorName} assigned you a task for customer ${customer.name || ''}. Due ${due_date ? new Date(due_date).toLocaleDateString() : 'whenever'}.`,
          priority: 'high',
          actionUrl: `/dashboard/customers/${id}`,
          actionLabel: 'Open task',
          userId: finalAssignee,
          related_id: task.id,
          related_type: 'task',
          data: { _force_email: assigneeEmail }, // hint for notify() to email
        });
      } catch (e) {
        console.warn('[TASKS] assignee notify failed:', e.message);
      }

      // ALWAYS send email for task assignments (bypass prefs)
      if (assigneeEmail) {
        try {
          const { sendCustomEmail, isEmailConfigured } = await import('@/lib/email');
          if (isEmailConfigured()) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sellorachat.com';
            await sendCustomEmail({
              to: assigneeEmail,
              subject: `[Sellora] New task assigned: ${title.slice(0, 60)}`,
              html: `
                <h1>New task assigned to you ✅</h1>
                <p>Hi ${assigneeName || 'there'},</p>
                <p>${creatorName} assigned you a task on Sellora:</p>
                <div class="info-box">
                  <div class="info-label">Task</div>
                  <div class="info-text"><strong>${title}</strong></div>
                </div>
                ${description ? `<p style="color:#374151;font-size:14px;">${description}</p>` : ''}
                <table class="data">
                  <tr><td class="label">Customer</td><td class="value">${customer.name || customer.email || 'N/A'}</td></tr>
                  <tr><td class="label">Due</td><td class="value">${due_date ? new Date(due_date).toLocaleDateString() : 'No due date'}</td></tr>
                  <tr><td class="label">Priority</td><td class="value" style="text-transform:capitalize;">${priority}</td></tr>
                </table>
                <p style="margin-top:20px;"><a href="${appUrl}/dashboard/customers/${id}" class="btn">Open Task →</a></p>
                <p style="font-size:13px;color:#6b7280;margin-top:16px;">You received this email because a task was assigned to you on Sellora.</p>
              `,
              templateName: 'task_assigned',
              accountId: customer.account_id,
              metadata: { taskId: task.id, customerId: id, title },
            });
          }
        } catch (e) {
          console.warn('[TASKS] assignee email failed:', e.message);
        }
      }
    }

    return NextResponse.json({ task });
  } catch (e) {
    console.error('[TASKS] POST error:', e);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PATCH — update task status / assignment
export async function PATCH(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { task_id, status, assigned_to, ...otherUpdates } = body;
    if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 });

    const updates = { ...otherUpdates, updated_at: new Date().toISOString() };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (status === 'pending' || status === 'in_progress') {
      updates.completed_at = null;
    }

    // Reassignment tracking
    if (assigned_to) {
      updates.assigned_to = assigned_to;
      updates.reassigned_by = user.id;
      updates.reassigned_at = new Date().toISOString();
    }

    const db = admin();

    // First fetch the task to verify access (via the customer's account_id)
    const { data: existingTask } = await db.from('customer_tasks')
      .select('id, account_id, customer_id, title')
      .eq('id', task_id)
      .maybeSingle();
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const hasAccess = await canAccessAccount(user, existingTask.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: task, error } = await db.from('customer_tasks')
      .update(updates).eq('id', task_id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If reassigned, notify the new assignee
    if (assigned_to && assigned_to !== user.id) {
      try {
        const actorName = await getActorName(user, existingTask.account_id);
        // Look up the new assignee's display name for the assigned_name column
        const newAssigneeName = await getActorName({ id: assigned_to }, existingTask.account_id);
        await db.from('customer_tasks').update({ assigned_name: newAssigneeName }).eq('id', task_id);

        // Look up the assignee's email for direct email
        let assigneeEmail = null;
        if (assigned_to === existingTask.account_id) {
          const { data: owner } = await db.from('accounts').select('email').eq('id', assigned_to).maybeSingle();
          assigneeEmail = owner?.email;
        } else {
          const { data: tm } = await db.from('team_members')
            .select('email, invited_email')
            .eq('user_id', assigned_to)
            .eq('account_id', existingTask.account_id)
            .maybeSingle();
          assigneeEmail = tm?.email || tm?.invited_email;
        }

        await notify(existingTask.account_id, {
          category: 'team',
          type: 'task_reassigned',
          title: `Task reassigned to you: ${existingTask.title?.slice(0, 80) || 'Untitled'}`,
          message: `${actorName} reassigned a task to you.`,
          priority: 'high',
          actionUrl: `/dashboard/customers/${existingTask.customer_id}`,
          actionLabel: 'Open task',
          userId: assigned_to,
          related_id: task_id,
          related_type: 'task',
        });

        // ALWAYS send email for task reassignment (bypass prefs)
        if (assigneeEmail) {
          try {
            const { sendCustomEmail, isEmailConfigured } = await import('@/lib/email');
            if (isEmailConfigured()) {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sellorachat.com';
              await sendCustomEmail({
                to: assigneeEmail,
                subject: `[Sellora] Task reassigned: ${existingTask.title?.slice(0, 60) || 'Untitled'}`,
                html: `
                  <h1>Task reassigned to you 🔄</h1>
                  <p>Hi ${newAssigneeName || 'there'},</p>
                  <p>${actorName} reassigned a task to you on Sellora:</p>
                  <div class="info-box">
                    <div class="info-label">Task</div>
                    <div class="info-text"><strong>${existingTask.title || 'Untitled'}</strong></div>
                  </div>
                  <p style="margin-top:20px;"><a href="${appUrl}/dashboard/customers/${existingTask.customer_id}" class="btn">Open Task →</a></p>
                  <p style="font-size:13px;color:#6b7280;margin-top:16px;">You received this email because a task was reassigned to you on Sellora.</p>
                `,
                templateName: 'task_reassigned',
                accountId: existingTask.account_id,
                metadata: { taskId: task_id },
              });
            }
          } catch (e) {
            console.warn('[TASKS] reassign email failed:', e.message);
          }
        }
      } catch (e) {
        console.warn('[TASKS] reassign notify failed:', e.message);
      }
    }

    // Add to timeline if completed
    if (status === 'completed') {
      const actorName = await getActorName(user, existingTask.account_id);
      await db.from('customer_timeline').insert({
        account_id: existingTask.account_id,
        customer_id: existingTask.customer_id,
        event_type: 'task',
        title: `Task completed: ${existingTask.title}`,
        actor_id: user.id,
        actor_name: actorName,
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

    // Verify access via the task's account_id
    const { data: existingTask } = await db.from('customer_tasks')
      .select('id, account_id')
      .eq('id', taskId)
      .maybeSingle();
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const hasAccess = await canAccessAccount(user, existingTask.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await db.from('customer_tasks').delete().eq('id', taskId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
