"use client";

import { useState, useEffect, useRef } from "react";
import {
  UserCircle, Clock, StickyNote, X, Send, Loader2,
  ChevronDown, Calendar, Pin, Trash2,
} from "lucide-react";

/**
 * ConversationControls — assignment + snooze + internal notes UI.
 * Rendered inside the conversation view (both desktop and mobile).
 *
 * Props:
 *   conversation: the active conversation object
 *   onRefresh: callback after a control action mutates the conversation
 */
export default function ConversationControls({ conversation, onRefresh }) {
  const [tab, setTab] = useState(null); // null | "assign" | "snooze" | "notes"
  const [assignees, setAssignees] = useState([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [acting, setActing] = useState(false);
  const popoverRef = useRef(null);

  // Load assignees when the assign tab opens
  useEffect(() => {
    if (tab === "assign" && assignees.length === 0) {
      setLoadingAssignees(true);
      fetch("/api/team-members")
        .then((r) => r.json())
        .then((d) => setAssignees(d.assignees || []))
        .finally(() => setLoadingAssignees(false));
    }
  }, [tab]);

  // Load notes when the notes tab opens
  useEffect(() => {
    if (tab === "notes" && conversation) {
      setLoadingNotes(true);
      fetch(`/api/conversations/${conversation.id}/notes`)
        .then((r) => r.json())
        .then((d) => setNotes(d.notes || []))
        .finally(() => setLoadingNotes(false));
    }
  }, [tab, conversation?.id]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!tab) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setTab(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tab]);

  if (!conversation) return null;

  const callControl = async (action, payload = {}) => {
    setActing(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      if (res.ok && onRefresh) onRefresh();
      setTab(null);
    } catch (e) {
      console.error("Control action failed:", e);
    } finally {
      setActing(false);
    }
  };

  const handleAssign = (assigneeId) => callControl("assign", { assigneeId });
  const handleUnassign = () => callControl("unassign");

  const handleSnooze = (hours) => {
    const until = new Date(Date.now() + hours * 3600_000).toISOString();
    callControl("snooze", { until });
  };
  const handleUnsnooze = () => callControl("unsnooze");

  const handleAddNote = async () => {
    if (!newNote.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes((prev) => [data.note, ...prev]);
        setNewNote("");
      }
    } catch (e) {
      console.error("Note save failed:", e);
    } finally {
      setSavingNote(false);
    }
  };

  const assignedAssignee = assignees.find((a) => a.id === conversation.assigned_to);
  const isSnoozed = conversation.snoozed_until && new Date(conversation.snoozed_until) > new Date();

  return (
    <div style={{ position: "relative" }} ref={popoverRef}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* Assign button */}
        <button
          onClick={() => setTab(tab === "assign" ? null : "assign")}
          title="Assign conversation"
          style={iconBtnStyle(assignedAssignee ? "var(--accent-primary)" : "var(--text-tertiary)")}
        >
          <UserCircle size={16} />
        </button>

        {/* Snooze button */}
        <button
          onClick={() => setTab(tab === "snooze" ? null : "snooze")}
          title="Snooze conversation"
          style={iconBtnStyle(isSnoozed ? "var(--accent-orange)" : "var(--text-tertiary)")}
        >
          <Clock size={16} />
        </button>

        {/* Notes button */}
        <button
          onClick={() => setTab(tab === "notes" ? null : "notes")}
          title="Internal notes"
          style={iconBtnStyle(notes.length > 0 ? "var(--accent-secondary)" : "var(--text-tertiary)")}
        >
          <StickyNote size={16} />
          {notes.length > 0 && (
            <span style={badgeStyle}>{notes.length}</span>
          )}
        </button>
      </div>

      {/* Popover */}
      {tab && (
        <div style={popoverStyle}>
          <div style={popoverHeaderStyle}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              {tab === "assign" ? "Assign to" : tab === "snooze" ? "Snooze for" : "Internal notes"}
            </span>
            <button onClick={() => setTab(null)} style={closeBtnStyle}>
              <X size={14} />
            </button>
          </div>

          {/* Assign tab */}
          {tab === "assign" && (
            <div style={popoverBodyStyle}>
              {loadingAssignees ? (
                <div style={{ textAlign: "center", padding: 16 }}>
                  <Loader2 size={16} className="spin" />
                </div>
              ) : assignees.length === 0 ? (
                <p style={emptyStyle}>No team members available.</p>
              ) : (
                assignees.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleAssign(a.id)}
                    style={a.id === conversation.assigned_to ? assigneeRowActiveStyle : assigneeRowStyle}
                  >
                    <div style={avatarStyle}>
                      {(a.name || a.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name || a.email}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.role}</div>
                    </div>
                    {a.id === conversation.assigned_to && <Pin size={12} color="var(--accent-primary)" />}
                  </button>
                ))
              )}
              {conversation.assigned_to && (
                <button onClick={handleUnassign} disabled={acting} style={unassignBtnStyle}>
                  Unassign
                </button>
              )}
            </div>
          )}

          {/* Snooze tab */}
          {tab === "snooze" && (
            <div style={popoverBodyStyle}>
              {isSnoozed && (
                <div style={snoozedBannerStyle}>
                  <Clock size={14} />
                  <span>Snoozed until {new Date(conversation.snoozed_until).toLocaleString()}</span>
                </div>
              )}
              {[
                { hours: 1, label: "1 hour" },
                { hours: 3, label: "3 hours" },
                { hours: 24, label: "Tomorrow (24h)" },
                { hours: 72, label: "3 days" },
                { hours: 168, label: "1 week" },
              ].map((opt) => (
                <button
                  key={opt.hours}
                  onClick={() => handleSnooze(opt.hours)}
                  disabled={acting}
                  style={snoozeRowStyle}
                >
                  <Calendar size={14} color="var(--accent-primary)" />
                  <span>{opt.label}</span>
                </button>
              ))}
              {isSnoozed && (
                <button onClick={handleUnsnooze} disabled={acting} style={unassignBtnStyle}>
                  Unsnooze now
                </button>
              )}
            </div>
          )}

          {/* Notes tab */}
          {tab === "notes" && (
            <div style={popoverBodyStyle}>
              <div style={notesListStyle}>
                {loadingNotes ? (
                  <div style={{ textAlign: "center", padding: 16 }}>
                    <Loader2 size={16} className="spin" />
                  </div>
                ) : notes.length === 0 ? (
                  <p style={emptyStyle}>No notes yet. Add the first one below.</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} style={noteCardStyle}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>
                        {n.body}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={noteComposerStyle}>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a private note (AI will not see this)…"
                  rows={2}
                  style={noteInputStyle}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || savingNote}
                  style={noteSendBtnStyle}
                >
                  {savingNote ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = (color) => ({
  background: "transparent",
  border: "none",
  color,
  cursor: "pointer",
  padding: 6,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  transition: "background 0.15s ease",
});

const badgeStyle = {
  position: "absolute",
  top: 0, right: 0,
  background: "var(--accent-secondary)",
  color: "#fff",
  fontSize: 9,
  fontWeight: 700,
  minWidth: 14, height: 14, borderRadius: 7,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "0 3px",
};

const popoverStyle = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 8,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-medium)",
  borderRadius: 12,
  boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
  width: 280,
  maxHeight: 400,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  zIndex: 100,
  animation: "scale-in 0.15s ease",
};

const popoverHeaderStyle = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--border-subtle)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  padding: 2,
};

const popoverBodyStyle = {
  padding: 8,
  overflowY: "auto",
  maxHeight: 350,
};

const assigneeRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 8,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  transition: "background 0.15s ease",
};

const assigneeRowActiveStyle = {
  ...assigneeRowStyle,
  background: "rgba(88,101,242,0.1)",
};

const avatarStyle = {
  width: 28, height: 28, borderRadius: "50%",
  background: "var(--accent-gradient)",
  color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: 700, fontSize: 12, flexShrink: 0,
};

const unassignBtnStyle = {
  width: "100%",
  padding: "8px 10px",
  marginTop: 8,
  borderRadius: 8,
  background: "rgba(237,66,69,0.1)",
  color: "var(--accent-red)",
  border: "1px solid rgba(237,66,69,0.2)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const snoozedBannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  marginBottom: 8,
  background: "rgba(248,165,50,0.1)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--accent-orange)",
};

const snoozeRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 8,
  background: "transparent",
  border: "1px solid var(--border-subtle)",
  cursor: "pointer",
  width: "100%",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  marginBottom: 4,
  transition: "background 0.15s ease",
};

const emptyStyle = {
  padding: 16,
  textAlign: "center",
  fontSize: 12,
  color: "var(--text-tertiary)",
};

const notesListStyle = {
  maxHeight: 220,
  overflowY: "auto",
  marginBottom: 8,
};

const noteCardStyle = {
  padding: 10,
  background: "rgba(255,255,255,0.03)",
  borderRadius: 8,
  marginBottom: 6,
  border: "1px solid var(--border-subtle)",
};

const noteComposerStyle = {
  display: "flex",
  gap: 6,
  paddingTop: 8,
  borderTop: "1px solid var(--border-subtle)",
};

const noteInputStyle = {
  flex: 1,
  padding: 8,
  borderRadius: 8,
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-medium)",
  color: "var(--text-primary)",
  fontSize: 12,
  resize: "none",
  outline: "none",
  fontFamily: "inherit",
};

const noteSendBtnStyle = {
  width: 32, height: 32,
  borderRadius: 8,
  background: "var(--accent-gradient)",
  color: "#fff",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
