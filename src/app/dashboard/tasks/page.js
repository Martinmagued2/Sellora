"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEffectiveAccount } from "@/lib/account-context";
import {
  CheckCircle2, Circle, Calendar, Plus, X, Loader2,
  CheckSquare, Filter, User, AlertCircle, Clock,
} from "lucide-react";
import { useToast } from "../components/ToastProvider";

const PRIORITY_COLORS = {
  urgent: "var(--accent-red)",
  high: "var(--accent-orange)",
  normal: "var(--text-tertiary)",
  low: "var(--text-tertiary)",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const ASSIGNEE_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "me", label: "Me" },
  { value: "unassigned", label: "Unassigned" },
];

export default function TasksPage() {
  const supabase = createClient();
  const { effectiveAccountId, role } = useEffectiveAccount();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "normal",
    assigned_to: "",
    customer_id: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, [supabase]);

  const loadTasks = useCallback(async () => {
    if (!effectiveAccountId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_tasks")
        .select("*, customer:customers(id, name, email)")
        .eq("account_id", effectiveAccountId)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (e) {
      console.error("[TASKS] load error:", e);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [effectiveAccountId, supabase, toast]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/team-members");
      const data = await res.json();
      setTeamMembers(data.assignees || []);
    } catch (e) {
      console.warn("[TASKS] team-members load failed", e);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadTeamMembers();
  }, [loadTasks, loadTeamMembers]);

  // Load customers when create modal opens
  useEffect(() => {
    if (showCreate && effectiveAccountId && customers.length === 0) {
      supabase
        .from("customers")
        .select("id, name, email")
        .eq("account_id", effectiveAccountId)
        .order("name", { ascending: true })
        .limit(100)
        .then(({ data }) => setCustomers(data || []));
    }
  }, [showCreate, effectiveAccountId, supabase, customers.length]);

  const getAssigneeInfo = (userId) => {
    if (!userId) return null;
    return teamMembers.find((m) => m.id === userId) || null;
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (assigneeFilter === "me" && t.assigned_to !== user?.id) return false;
    if (assigneeFilter === "unassigned" && t.assigned_to) return false;
    return true;
  });

  // Group tasks by status
  const grouped = {
    pending: filteredTasks.filter((t) => t.status === "pending"),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
    completed: filteredTasks.filter((t) => t.status === "completed"),
  };

  const handleToggleStatus = async (taskId, currentStatus) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      // Find the task to get its customer_id
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const res = await fetch(`/api/customers/${task.customer_id}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null } : t))
        );
      } else {
        toast.error("Failed to update task");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleReassign = async (taskId, newAssigneeId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      const res = await fetch(`/api/customers/${task.customer_id}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, assigned_to: newAssigneeId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...data.task } : t)));
        toast.success("Reassigned");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleCreate = async () => {
    if (!newTask.title.trim() || !newTask.customer_id) {
      toast.error("Title and customer are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...newTask };
      if (!payload.assigned_to) delete payload.assigned_to;
      if (!payload.due_date) delete payload.due_date;
      const res = await fetch(`/api/customers/${newTask.customer_id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks((prev) => [...prev, data.task]);
        setNewTask({ title: "", description: "", due_date: "", priority: "normal", assigned_to: "", customer_id: "" });
        setShowCreate(false);
        toast.success("Task created");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
            <CheckSquare size={28} /> Tasks
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
            All customer follow-up tasks across your team.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Pending" count={grouped.pending.length} color="var(--accent-orange)" icon={<Clock size={18} />} />
        <StatCard label="In Progress" count={grouped.in_progress.length} color="var(--accent-secondary)" icon={<Loader2 size={18} />} />
        <StatCard label="Completed" count={grouped.completed.length} color="var(--accent-green)" icon={<CheckCircle2 size={18} />} />
        <StatCard
          label="My Tasks"
          count={tasks.filter((t) => t.assigned_to === user?.id && t.status !== "completed").length}
          color="var(--accent-primary)"
          icon={<User size={18} />}
        />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginRight: 4 }}>Status:</span>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            style={{
              padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600,
              border: `1px solid ${statusFilter === s.value ? "var(--accent-primary)" : "var(--border-subtle)"}`,
              background: statusFilter === s.value ? "var(--accent-primary)" : "transparent",
              color: statusFilter === s.value ? "white" : "var(--text-tertiary)",
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 4px 0 12px" }}>Assignee:</span>
        {ASSIGNEE_OPTIONS.map((a) => (
          <button
            key={a.value}
            onClick={() => setAssigneeFilter(a.value)}
            style={{
              padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600,
              border: `1px solid ${assigneeFilter === a.value ? "var(--accent-primary)" : "var(--border-subtle)"}`,
              background: assigneeFilter === a.value ? "var(--accent-primary)" : "transparent",
              color: assigneeFilter === a.value ? "white" : "var(--text-tertiary)",
              cursor: "pointer",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-tertiary)" }}>
          <Loader2 size={32} className="spin" style={{ margin: "0 auto 12px" }} />
          Loading tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 64, color: "var(--text-tertiary)",
          border: "1px dashed var(--border-medium)", borderRadius: 12,
        }}>
          <CheckSquare size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <h3 style={{ marginBottom: 6 }}>No tasks here</h3>
          <p style={{ fontSize: 13, marginBottom: 16 }}>
            {tasks.length === 0 ? "Create your first task to get started." : "Try changing the filters above."}
          </p>
          {tasks.length === 0 && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Task
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredTasks.map((task) => {
            const assignee = getAssigneeInfo(task.assigned_to);
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";
            const isMine = task.assigned_to === user?.id;
            return (
              <div
                key={task.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "14px 16px", borderRadius: 12,
                  background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                  opacity: task.status === "completed" ? 0.6 : 1,
                }}
              >
                <button
                  onClick={() => handleToggleStatus(task.id, task.status)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2,
                    color: task.status === "completed" ? "var(--accent-green)" : "var(--text-tertiary)",
                  }}
                >
                  {task.status === "completed" ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    textDecoration: task.status === "completed" ? "line-through" : "none",
                  }}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {task.description}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "var(--text-tertiary)", flexWrap: "wrap", alignItems: "center" }}>
                    {/* Customer */}
                    {task.customer && (
                      <a href={`/dashboard/customers/${task.customer.id}`} style={{ color: "var(--accent-primary-light)", textDecoration: "none" }}>
                        👤 {task.customer.name || task.customer.email || "Customer"}
                      </a>
                    )}
                    {/* Due date */}
                    {task.due_date && (
                      <span style={{ color: isOverdue ? "var(--accent-red)" : "inherit", fontWeight: isOverdue ? 700 : 500 }}>
                        <Calendar size={10} /> {new Date(task.due_date).toLocaleDateString()}
                        {isOverdue && " · OVERDUE"}
                      </span>
                    )}
                    {/* Priority */}
                    <span style={{ textTransform: "capitalize", color: PRIORITY_COLORS[task.priority], fontWeight: 600 }}>
                      {task.priority}
                    </span>
                  </div>
                </div>
                {/* Assignee dropdown */}
                <select
                  value={task.assigned_to || ""}
                  onChange={(e) => handleReassign(task.id, e.target.value)}
                  style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 12,
                    background: task.assigned_to ? (isMine ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.06)") : "transparent",
                    color: task.assigned_to ? (isMine ? "var(--accent-primary-light)" : "var(--text-secondary)") : "var(--text-tertiary)",
                    border: "1px solid var(--border-subtle)", cursor: "pointer",
                    fontFamily: "inherit", fontWeight: 600,
                  }}
                  title="Reassign task"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name || m.name || m.email}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Create task modal */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-secondary)", borderRadius: 16, padding: 24,
              maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto",
              border: "1px solid var(--border-medium)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Task</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Customer *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                <select
                  className="form-input"
                  value={newTask.customer_id}
                  onChange={(e) => setNewTask((p) => ({ ...p, customer_id: e.target.value }))}
                >
                  <option value="">Select a customer...</option>
                  {customers
                    .filter((c) => !customerSearch || (c.name || "").toLowerCase().includes(customerSearch.toLowerCase()) || (c.email || "").toLowerCase().includes(customerSearch.toLowerCase()))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name || c.email}</option>
                    ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Follow up about order..."
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Optional details..."
                  value={newTask.description}
                  onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                  style={{ resize: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newTask.due_date?.split("T")[0] || ""}
                    onChange={(e) => setNewTask((p) => ({ ...p, due_date: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                  />
                </div>
                <div style={{ width: 120 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Priority</label>
                  <select
                    className="form-input"
                    value={newTask.priority}
                    onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Assign To</label>
                <select
                  className="form-input"
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask((p) => ({ ...p, assigned_to: e.target.value }))}
                >
                  <option value="">Myself</option>
                  {teamMembers.filter((m) => m.role !== "owner").map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name || m.name || m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={saving || !newTask.title.trim() || !newTask.customer_id}
                style={{ marginTop: 8, justifyContent: "center" }}
              >
                {saving ? <><Loader2 size={14} className="spin" /> Creating...</> : <><Plus size={14} /> Create Task</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, count, color, icon }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12, background: "var(--bg-glass)",
      border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{count}</div>
    </div>
  );
}
