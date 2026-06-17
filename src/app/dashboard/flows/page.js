"use client";

import { useState, useEffect } from "react";
import { Plus, Play, Pause, Trash2, Zap, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FlowBuilderPage() {
  const router = useRouter();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newFlow, setNewFlow] = useState({ name: "", description: "", trigger_type: "keyword" });

  const load = () => {
    fetch("/api/flows").then(r => r.json()).then(d => { setFlows(d.flows || []); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newFlow.name) return;
    await fetch("/api/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newFlow) });
    setShowCreate(false); setNewFlow({ name: "", description: "", trigger_type: "keyword" }); load();
  };

  const toggle = async (id, currentStatus) => {
    await fetch(`/api/flows/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: currentStatus === "active" ? "paused" : "active" }) });
    load();
  };

  const del = async (id) => {
    await fetch(`/api/flows/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ padding: "var(--space-xl)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, margin: 0 }}>Flow Builder</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Create rule-based automation flows with visual triggers and actions.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <Plus size={16} /> New Flow
        </button>
      </div>

      {showCreate && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <input type="text" placeholder="Flow name (e.g. 'Welcome new customers')" value={newFlow.name} onChange={e => setNewFlow({ ...newFlow, name: e.target.value })} style={{ width: "100%", padding: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", marginBottom: 10 }} />
          <input type="text" placeholder="Description (optional)" value={newFlow.description} onChange={e => setNewFlow({ ...newFlow, description: e.target.value })} style={{ width: "100%", padding: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", marginBottom: 10 }} />
          <select value={newFlow.trigger_type} onChange={e => setNewFlow({ ...newFlow, trigger_type: e.target.value })} style={{ width: "100%", padding: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", marginBottom: 12 }}>
            <option value="keyword">Keyword trigger</option>
            <option value="intent">Intent trigger</option>
            <option value="channel">Channel trigger</option>
            <option value="schedule">Schedule trigger</option>
            <option value="manual">Manual trigger</option>
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={create} className="btn btn-primary">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>Loading...</div>
      ) : flows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
          <Zap size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p>No automation flows yet. Create your first flow to automate repetitive tasks.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {flows.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{f.description || "No description"} · {f.trigger_type} trigger · {f.total_runs} runs</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: f.status === "active" ? "rgba(59,165,92,0.15)" : f.status === "paused" ? "rgba(248,165,50,0.15)" : "rgba(255,255,255,0.05)", color: f.status === "active" ? "var(--accent-green)" : f.status === "paused" ? "var(--accent-orange)" : "var(--text-tertiary)" }}>{f.status}</span>
                <button onClick={() => toggle(f.id, f.status)} className="topbar-btn" title={f.status === "active" ? "Pause" : "Activate"}>{f.status === "active" ? <Pause size={14} /> : <Play size={14} />}</button>
                <button onClick={() => del(f.id)} className="topbar-btn" title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: "rgba(88,101,242,0.05)", border: "1px solid rgba(88,101,242,0.15)", borderRadius: 12 }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          💡 <strong>Flow Builder</strong> lets you create visual automation flows with triggers, conditions, and actions. This is the list management view — a full drag-and-drop canvas editor is coming soon.
        </p>
      </div>
    </div>
  );
}
