"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffectiveAccount } from "@/lib/account-context";
import {
  ArrowLeft, Calendar, CheckCircle2, Circle, Clock, Eye, Loader2,
  Paperclip, Send, Link2, FileText, AlertCircle, User, X,
  RotateCcw, Check, XCircle, MessageSquare, File as FileIcon,
} from "lucide-react";
import { useToast } from "../../components/ToastProvider";

const STATUS_CONFIG = {
  unseen:      { label: "Unseen",      color: "#9ca3af", bg: "rgba(156,163,175,0.15)", icon: <Eye size={12} /> },
  seen:        { label: "Seen",        color: "#3b82f6", bg: "rgba(59,130,246,0.15)",  icon: <Check size={12} /> },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  icon: <Clock size={12} /> },
  review:      { label: "In Review",   color: "#a855f7", bg: "rgba(168,85,247,0.15)",  icon: <AlertCircle size={12} /> },
  done:        { label: "Done",        color: "#10b981", bg: "rgba(16,185,129,0.15)",  icon: <CheckCircle2 size={12} /> },
  completed:   { label: "Completed",   color: "#10b981", bg: "rgba(16,185,129,0.15)",  icon: <CheckCircle2 size={12} /> },
  rejected:    { label: "Needs Changes", color: "#ef4444", bg: "rgba(239,68,68,0.15)", icon: <RotateCcw size={12} /> },
  pending:     { label: "Pending",     color: "#9ca3af", bg: "rgba(156,163,175,0.15)", icon: <Circle size={12} /> },
  cancelled:   { label: "Cancelled",   color: "#9ca3af", bg: "rgba(156,163,175,0.15)", icon: <XCircle size={12} /> },
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id;
  const { effectiveAccountId, role } = useEffectiveAccount();
  const toast = useToast();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReviewBox, setShowReviewBox] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const fileInputRef = useRef(null);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, [supabase]);

  const loadData = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
        setTask(data.task || null);
        // Auto-mark as 'seen' if assignee is viewing and status is 'unseen'
        if (data.task?.assigned_to === user?.id && data.task?.status === "unseen") {
          await fetch(`/api/customers/${data.task.customer_id}/tasks`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: taskId, status: "seen" }),
          });
          setTask((prev) => prev ? { ...prev, status: "seen" } : prev);
        }
      } else {
        toast.error(data.error || "Failed to load task");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [taskId, user?.id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetch("/api/team-members")
      .then((r) => r.json())
      .then((d) => setTeamMembers(d.assignees || []))
      .catch(() => {});
  }, []);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [comments.length]);

  const getAssigneeInfo = (uid) => teamMembers.find((m) => m.id === uid);

  const handleAddComment = async () => {
    if (!newComment.trim() && !newLinkUrl) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: newComment.trim() || null,
          link_url: newLinkUrl.trim() || null,
          link_label: newLinkLabel.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
        setNewLinkUrl("");
        setNewLinkLabel("");
        setShowLinkInput(false);
      } else {
        toast.error(data.error || "Failed to add comment");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch(`/api/tasks/${taskId}/upload`, { method: "POST", body: formData });
      const upData = await upRes.json();
      if (!upRes.ok) {
        toast.error(upData.error || "Upload failed");
        return;
      }
      // Now post a comment with the file URL
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: `📎 Shared a file: ${upData.fileName}`,
          file_url: upData.url,
          file_name: upData.fileName,
          file_size: upData.fileSize,
          file_mime_type: upData.mimeType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
      } else {
        toast.error(data.error || "Failed to save file comment");
      }
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateStatus = async (newStatus, reviewNotes = null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${task.customer_id}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          status: newStatus,
          ...(reviewNotes !== null ? { review_notes: reviewNotes } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTask((prev) => ({ ...prev, status: newStatus, ...(data.task || {}) }));
        toast.success(`Status: ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
        setShowReviewBox(false);
        setReviewNotes("");
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const isAssignee = task?.assigned_to === user?.id;
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const canReview = isOwner || isAdmin;
  const canAct = isAssignee || isOwner || isAdmin;

  if (loading) {
    return (
      <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
        <AlertCircle size={40} style={{ margin: "0 auto 12px" }} />
        <h3>Task not found</h3>
        <button className="btn btn-primary" onClick={() => router.push("/dashboard/tasks")}>Back to Tasks</button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const assignee = getAssigneeInfo(task.assigned_to);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard/tasks")}
        style={{
          background: "none", border: "none", color: "var(--text-tertiary)",
          cursor: "pointer", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <ArrowLeft size={14} /> Back to Tasks
      </button>

      {/* Task header */}
      <div style={{
        background: "var(--bg-glass)", borderRadius: 16, padding: 24,
        border: "1px solid var(--border-subtle)", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1, lineHeight: 1.3 }}>{task.title}</h1>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 16, fontSize: 11, fontWeight: 700,
            background: statusCfg.bg, color: statusCfg.color,
            border: `1px solid ${statusCfg.color}33`,
            textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap",
          }}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        </div>
        {task.description && (
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            {task.description}
          </p>
        )}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text-tertiary)" }}>
          {assignee && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: assignee.role === "owner" ? "linear-gradient(135deg,#f59e0b,#ef4444)" : assignee.role === "admin" ? "linear-gradient(135deg,#a855f7,#6C5CE7)" : "var(--accent-gradient)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "#fff",
              }}>
                {(assignee.name || assignee.email || "?").charAt(0).toUpperCase()}
              </span>
              {isAssignee ? "You" : (assignee.display_name || assignee.name || assignee.email)}
            </span>
          )}
          {task.due_date && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={12} /> Due {new Date(task.due_date).toLocaleDateString()}
              {new Date(task.due_date) < new Date() && task.status !== "done" && task.status !== "completed" && (
                <span style={{ color: "var(--accent-red)", fontWeight: 700, marginLeft: 4 }}>OVERDUE</span>
              )}
            </span>
          )}
          <span style={{ textTransform: "capitalize", color: task.priority === "urgent" ? "var(--accent-red)" : task.priority === "high" ? "var(--accent-orange)" : "inherit", fontWeight: 600 }}>
            {task.priority} priority
          </span>
        </div>
      </div>

      {/* Status workflow actions */}
      <div style={{
        background: "var(--bg-glass)", borderRadius: 16, padding: 16,
        border: "1px solid var(--border-subtle)", marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 12 }}>
          Status Workflow
        </h3>

        {/* Workflow visualization */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap", fontSize: 11, fontWeight: 600 }}>
          {["unseen", "seen", "in_progress", "review", "done"].map((s, i, arr) => {
            const cfg = STATUS_CONFIG[s];
            const isCurrent = task.status === s;
            const isPast = arr.indexOf(task.status) > i;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  padding: "3px 8px", borderRadius: 10,
                  background: isCurrent ? cfg.color : isPast ? cfg.bg : "transparent",
                  color: isCurrent ? "#fff" : isPast ? cfg.color : "var(--text-tertiary)",
                  border: `1px solid ${isCurrent || isPast ? cfg.color : "var(--border-subtle)"}`,
                }}>
                  {cfg.label}
                </span>
                {i < arr.length - 1 && <span style={{ color: "var(--text-tertiary)" }}>→</span>}
              </div>
            );
          })}
        </div>

        {/* Action buttons — different per role + current status */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isAssignee && task.status === "unseen" && (
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => updateStatus("seen")}>
              <Eye size={14} /> Mark as seen
            </button>
          )}
          {isAssignee && (task.status === "seen" || task.status === "rejected") && (
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => updateStatus("in_progress")}>
              <Clock size={14} /> Start working
            </button>
          )}
          {isAssignee && task.status === "in_progress" && (
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => updateStatus("review")}>
              <AlertCircle size={14} /> Submit for review
            </button>
          )}
          {canReview && task.status === "review" && (
            <>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => updateStatus("done")} style={{ background: "var(--accent-green)" }}>
                <Check size={14} /> Mark as Done
              </button>
              <button className="btn btn-sm" disabled={saving} onClick={() => setShowReviewBox(!showReviewBox)} style={{ background: "rgba(239,68,68,0.15)", color: "var(--accent-red)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <RotateCcw size={14} /> Request changes
              </button>
            </>
          )}
          {showReviewBox && canReview && (
            <div style={{ width: "100%", marginTop: 8 }}>
              <textarea
                className="form-input"
                rows={2}
                placeholder="What needs to change?"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                style={{ marginBottom: 8, fontSize: 13, resize: "none" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm" disabled={saving || !reviewNotes.trim()} onClick={() => updateStatus("rejected", reviewNotes)} style={{ background: "rgba(239,68,68,0.15)", color: "var(--accent-red)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <RotateCcw size={14} /> Send back for changes
                </button>
                <button className="btn btn-sm" onClick={() => { setShowReviewBox(false); setReviewNotes(""); }}>Cancel</button>
              </div>
            </div>
          )}
          {(task.status === "done" || task.status === "completed") && canAct && (
            <button className="btn btn-sm" disabled={saving} onClick={() => updateStatus("in_progress")}>
              <RotateCcw size={14} /> Reopen
            </button>
          )}
        </div>

        {/* Review notes display */}
        {task.review_notes && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-red)", marginBottom: 4, textTransform: "uppercase" }}>Reviewer notes</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{task.review_notes}</div>
          </div>
        )}
      </div>

      {/* Comments section */}
      <div style={{
        background: "var(--bg-glass)", borderRadius: 16, padding: 16,
        border: "1px solid var(--border-subtle)",
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-tertiary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <MessageSquare size={12} /> Comments & Attachments
        </h3>

        {/* Comments list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 400, overflowY: "auto" }}>
          {comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>
              No comments yet. Start the conversation below.
            </div>
          ) : (
            comments.map((c) => {
              const isMe = c.author_id === user?.id;
              return (
                <div key={c.id} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  flexDirection: isMe ? "row-reverse" : "row",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--accent-gradient)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {(c.author_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{
                    flex: 1, maxWidth: "75%",
                    padding: "10px 14px", borderRadius: 12,
                    background: isMe ? "rgba(108,92,231,0.15)" : "var(--bg-tertiary)",
                    border: `1px solid ${isMe ? "rgba(108,92,231,0.3)" : "var(--border-subtle)"}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{isMe ? "You" : c.author_name}</span>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    {c.body && (
                      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</div>
                    )}
                    {c.link_url && (
                      <a href={c.link_url} target="_blank" rel="noopener noreferrer" style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        marginTop: 8, padding: "6px 10px", borderRadius: 8,
                        background: "rgba(108,92,231,0.1)", color: "var(--accent-primary-light)",
                        fontSize: 12, fontWeight: 600, textDecoration: "none",
                      }}>
                        <Link2 size={12} /> {c.link_label || c.link_url}
                      </a>
                    )}
                    {c.file_url && (
                      <a href={c.file_url} download target="_blank" rel="noopener noreferrer" style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        marginTop: 8, padding: "8px 12px", borderRadius: 8,
                        background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                        color: "var(--text-primary)", fontSize: 12, fontWeight: 600, textDecoration: "none",
                      }}>
                        <FileIcon size={14} color="var(--accent-primary-light)" />
                        <span>{c.file_name || "Download file"}</span>
                        {c.file_size && <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>· {Math.round(c.file_size / 1024)} KB</span>}
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment composer */}
        <div style={{
          borderTop: "1px solid var(--border-subtle)", paddingTop: 12,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Add a comment... (Shift+Enter for new line)"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            style={{ resize: "none", fontSize: 13 }}
          />
          {showLinkInput && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="url"
                className="form-input"
                placeholder="https://..."
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                style={{ flex: 1, fontSize: 12 }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Label (optional)"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                style={{ width: 140, fontSize: 12 }}
              />
              <button className="btn btn-sm" onClick={() => { setShowLinkInput(false); setNewLinkUrl(""); setNewLinkLabel(""); }}>
                <X size={12} />
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-sm" title="Attach file" disabled={uploading} onClick={() => fileInputRef.current?.click()} style={{ background: "transparent", border: "1px solid var(--border-subtle)" }}>
                {uploading ? <Loader2 size={14} className="spin" /> : <Paperclip size={14} />}
              </button>
              <button className="btn btn-sm" title="Add link" onClick={() => setShowLinkInput(!showLinkInput)} style={{ background: "transparent", border: "1px solid var(--border-subtle)" }}>
                <Link2 size={14} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }} />
            </div>
            <button
              className="btn btn-primary btn-sm"
              disabled={saving || (!newComment.trim() && !newLinkUrl.trim())}
              onClick={handleAddComment}
            >
              {saving ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
              <span style={{ marginLeft: 4 }}>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
