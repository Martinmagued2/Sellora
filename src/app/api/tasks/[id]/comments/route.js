/**
 * Task Comments API
 * GET  /api/tasks/[id]/comments — list comments for a task
 * POST /api/tasks/[id]/comments — add a comment { body?, link_url?, link_label?, file_url?, file_name?, file_size?, file_mime_type?, is_internal? }
 *
 * Team-aware: any team member of the task's account can read + post comments.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount, getActorName } from "@/lib/team-auth";
import { notify } from "@/lib/notifications";
import { sendCustomEmail, isEmailConfigured } from "@/lib/email";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

async function getTaskIfAccessible(db, taskId, userId) {
  const { data: task } = await db
    .from("customer_tasks")
    .select("id, account_id, customer_id, title, assigned_to, status, assigned_name")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return null;
  const hasAccess = await canAccessAccount({ id: userId }, task.account_id);
  if (!hasAccess) return null;
  return task;
}

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    const db = admin();

    const task = await getTaskIfAccessible(db, taskId, user.id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data: comments, error } = await db
      .from("task_comments")
      .select("id, author_id, author_name, body, link_url, link_label, file_url, file_name, file_size, file_mime_type, is_internal, created_at, updated_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ comments, task });
  } catch (e) {
    console.error("[TASK-COMMENTS] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    const body = await req.json();
    const {
      body: text,
      link_url,
      link_label,
      file_url,
      file_name,
      file_size,
      file_mime_type,
      is_internal = false,
    } = body;

    if (!text && !link_url && !file_url) {
      return NextResponse.json({ error: "Comment must have body, link, or file" }, { status: 400 });
    }

    const db = admin();
    const task = await getTaskIfAccessible(db, taskId, user.id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const authorName = await getActorName(user, task.account_id);

    const { data: comment, error } = await db
      .from("task_comments")
      .insert({
        task_id: taskId,
        account_id: task.account_id,
        author_id: user.id,
        author_name: authorName,
        body: text ? text.slice(0, 5000) : null,
        link_url: link_url ? link_url.slice(0, 2000) : null,
        link_label: link_label ? link_label.slice(0, 200) : null,
        file_url: file_url ? file_url.slice(0, 2000) : null,
        file_name: file_name ? file_name.slice(0, 300) : null,
        file_size: file_size || null,
        file_mime_type: file_mime_type ? file_mime_type.slice(0, 100) : null,
        is_internal: !!is_internal,
      })
      .select("id, author_id, author_name, body, link_url, link_label, file_url, file_name, file_size, file_mime_type, is_internal, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the other party (assignee if owner commented, owner if assignee commented)
    const otherUserId = user.id === task.assigned_to ? task.account_id : task.assigned_to;
    if (otherUserId && otherUserId !== user.id) {
      try {
        let otherEmail = null;
        let otherName = null;
        if (otherUserId === task.account_id) {
          // Owner
          const { data: owner } = await db.from("accounts").select("email, owner_name").eq("id", otherUserId).maybeSingle();
          otherEmail = owner?.email;
          otherName = owner?.owner_name || owner?.email;
        } else {
          const { data: tm } = await db.from("team_members")
            .select("email, invited_email, name, display_name")
            .eq("user_id", otherUserId)
            .eq("account_id", task.account_id)
            .maybeSingle();
          otherEmail = tm?.email || tm?.invited_email;
          otherName = tm?.name || tm?.display_name || tm?.invited_email;
        }

        const preview = text
          ? text.slice(0, 100)
          : link_url
          ? `Shared a link: ${link_label || link_url}`
          : file_url
          ? `Shared a file: ${file_name || "attachment"}`
          : "New comment";

        await notify(task.account_id, {
          category: "team",
          type: "task_comment",
          title: `New comment on: ${task.title?.slice(0, 60) || "task"}`,
          message: `${authorName}: ${preview}`,
          priority: "normal",
          actionUrl: `/dashboard/tasks/${taskId}`,
          actionLabel: "View comment",
          userId: otherUserId,
          related_id: taskId,
          related_type: "task",
        });

        // Always send email for task comments
        if (otherEmail && isEmailConfigured()) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sellorachat.com";
          let attachmentHtml = "";
          if (file_url) {
            attachmentHtml = `
              <div style="margin:14px 0;padding:12px;border:1px solid var(--border-subtle,#e5e7eb);border-radius:8px;background:#fafafa;">
                <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">📎 Attachment</div>
                <a href="${file_url}" download style="color:#6C5CE7;font-weight:600;text-decoration:none;">${file_name || "Download file"}</a>
                ${file_size ? `<span style="font-size:11px;color:#9ca3af;margin-left:8px;">(${Math.round(file_size / 1024)} KB)</span>` : ""}
              </div>`;
          }
          let linkHtml = "";
          if (link_url) {
            linkHtml = `
              <div style="margin:14px 0;padding:12px;border:1px solid var(--border-subtle,#e5e7eb);border-radius:8px;background:#fafafa;">
                <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">🔗 Link</div>
                <a href="${link_url}" target="_blank" rel="noopener" style="color:#6C5CE7;font-weight:600;text-decoration:none;">${link_label || link_url}</a>
              </div>`;
          }
          await sendCustomEmail({
            to: otherEmail,
            subject: `[Sellora] New comment on: ${task.title?.slice(0, 50) || "task"}`,
            html: `
              <h1>New comment on a task 💬</h1>
              <p>Hi ${otherName || "there"},</p>
              <p><strong>${authorName}</strong> commented on a task you're involved in:</p>
              <div class="info-box">
                <div class="info-label">Task</div>
                <div class="info-text"><strong>${task.title || "Untitled"}</strong></div>
              </div>
              ${text ? `<p style="color:#374151;font-size:14px;line-height:1.6;">${text.replace(/\n/g, "<br>")}</p>` : ""}
              ${linkHtml}
              ${attachmentHtml}
              <p style="margin-top:20px;"><a href="${appUrl}/dashboard/tasks/${taskId}" class="btn">Open Task →</a></p>
              <p style="font-size:13px;color:#6b7280;margin-top:16px;">You received this email because you are involved in this task on Sellora.</p>
            `,
            templateName: "task_comment",
            accountId: task.account_id,
            metadata: { taskId, commentId: comment.id },
          });
        }
      } catch (e) {
        console.warn("[TASK-COMMENTS] notify/email failed:", e.message);
      }
    }

    return NextResponse.json({ comment });
  } catch (e) {
    console.error("[TASK-COMMENTS] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
