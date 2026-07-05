"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Plus, Users, Star, Crown, Heart, Shield, Zap, Target, Gift,
  X, Trash2, Edit, RefreshCw, Megaphone, Loader2, ChevronLeft,
  Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/ToastProvider";
import { useConfirm } from "../components/ConfirmProvider";

const ICON_MAP = { Users, Star, Crown, Heart, Shield, Zap, Target, Gift };

const PRESET_COLORS = [
  { name: "Purple", value: "#5865F2" },
  { name: "Blue", value: "#00D2FF" },
  { name: "Green", value: "#3BA55C" },
  { name: "Orange", value: "#F8A532" },
  { name: "Pink", value: "#EB459E" },
  { name: "Red", value: "#ED4245" },
  { name: "Cyan", value: "#00BCD4" },
];

const SEGMENT_TEMPLATES = [
  {
    name: "VIP Customers",
    description: "High spenders with multiple orders",
    icon: "Crown",
    color: "#F8A532",
    rules: { operator: "AND", conditions: [{ field: "total_spent", operator: "greater_than", value: 5000 }, { field: "total_orders", operator: "greater_than", value: 5 }] },
  },
  {
    name: "New Customers",
    description: "Joined in the last 7 days",
    icon: "Star",
    color: "#00D2FF",
    rules: { operator: "AND", conditions: [{ field: "created_at", operator: "within_days", value: 7 }] },
  },
  {
    name: "At-Risk",
    description: "Inactive customers with previous orders",
    icon: "Shield",
    color: "#ED4245",
    rules: { operator: "AND", conditions: [{ field: "last_active_at", operator: "not_within_days", value: 30 }, { field: "total_orders", operator: "greater_than", value: 0 }] },
  },
  {
    name: "High-Value",
    description: "Customers who spent over 2,000",
    icon: "Crown",
    color: "#5865F2",
    rules: { operator: "AND", conditions: [{ field: "total_spent", operator: "greater_than", value: 2000 }] },
  },
  {
    name: "WhatsApp Users",
    description: "Customers on WhatsApp channel",
    icon: "Heart",
    color: "#3BA55C",
    rules: { operator: "AND", conditions: [{ field: "channel", operator: "equals", value: "whatsapp" }] },
  },
  {
    name: "Repeat Buyers",
    description: "Customers with more than 2 orders",
    icon: "Zap",
    color: "#EB459E",
    rules: { operator: "AND", conditions: [{ field: "total_orders", operator: "greater_than", value: 2 }] },
  },
];

const FIELD_OPTIONS = [
  { value: "total_spent", label: "Total Spent", type: "number" },
  { value: "total_orders", label: "Total Orders", type: "number" },
  { value: "channel", label: "Channel", type: "text" },
  { value: "tags", label: "Tags", type: "text" },
  { value: "last_active_at", label: "Last Active", type: "date" },
  { value: "created_at", label: "Joined Date", type: "date" },
];

const OPERATOR_OPTIONS = {
  number: [
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
  ],
  text: [
    { value: "equals", label: "Equals" },
    { value: "contains", label: "Contains" },
  ],
  date: [
    { value: "within_days", label: "Within last (days)" },
    { value: "not_within_days", label: "More than (days) ago" },
  ],
};

export default function SegmentsPage() {
  const toast = useToast();
  const router = useRouter();
  
  const confirmAction = useConfirm();
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentCustomers, setSegmentCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "#5865F2",
    icon: "Users",
    rules: { operator: "AND", conditions: [] },
  });

  const supabase = createClient();

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/segments");
      const data = await res.json();
      if (data.success) {
        setSegments(data.segments || []);
      }
    } catch (err) {
      console.error("Failed to fetch segments:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/segments");
        const data = await res.json();
        if (!cancelled && data.success) {
          setSegments(data.segments || []);
        }
      } catch (err) {
        console.error("Failed to fetch segments:", err);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Preview count when rules change
  const fetchPreviewCount = useCallback(async () => {
    if (!form.rules.conditions || form.rules.conditions.length === 0) {
      setPreviewCount(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase.from("customers").select("id", { count: "exact", head: true }).eq("account_id", user.id);
      for (const cond of form.rules.conditions) {
        if (!cond.field || !cond.operator || cond.value === undefined || cond.value === "") continue;
        switch (cond.operator) {
          case "greater_than": query = query.gte(cond.field, Number(cond.value)); break;
          case "less_than": query = query.lte(cond.field, Number(cond.value)); break;
          case "equals": query = cond.field === "tags" ? query.contains("tags", [cond.value]) : query.eq(cond.field, cond.value); break;
          case "contains": query = cond.field === "tags" ? query.contains("tags", [cond.value]) : query.ilike(cond.field, `%${cond.value}%`); break;
          case "within_days": { const d = new Date(); d.setDate(d.getDate() - Number(cond.value)); query = query.gte(cond.field, d.toISOString()); break; }
          case "not_within_days": { const d = new Date(); d.setDate(d.getDate() - Number(cond.value)); query = query.lt(cond.field, d.toISOString()); break; }
        }
      }
      const { count } = await query;
      setPreviewCount(count || 0);
    } catch (err) {
      console.error("Preview count error:", err);
    }
    setPreviewLoading(false);
  }, [form.rules, supabase]);

  useEffect(() => {
    if (showCreateModal) {
      const debounce = setTimeout(fetchPreviewCount, 400);
      return () => clearTimeout(debounce);
    }
  }, [showCreateModal, fetchPreviewCount]);

  const handleCreateSegment = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        resetForm();
        fetchSegments();
      } else {
        toast.error(data.error || "Failed to create segment");
      }
    } catch (err) {
      toast.error("Failed to create segment");
    }
    setSaving(false);
  };

  const handleCreateFromTemplate = async (template) => {
    setSaving(true);
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          color: template.color,
          icon: template.icon,
          rules: template.rules,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSegments();
      } else {
        toast.error(data.error || "Failed to create segment");
      }
    } catch (err) {
      toast.error("Failed to create segment from template");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction("Delete this segment?"))) return;
    try {
      const res = await fetch(`/api/segments/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedSegment?.id === id) setSelectedSegment(null);
        fetchSegments();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleCompute = async (segment) => {
    setComputing(true);
    try {
      const res = await fetch(`/api/segments/${segment.id}/compute`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchSegments();
        if (selectedSegment?.id === segment.id) {
          fetchSegmentDetail(segment.id);
        }
      }
    } catch (err) {
      console.error("Compute error:", err);
    }
    setComputing(false);
  };

  const fetchSegmentDetail = async (id) => {
    setCustomersLoading(true);
    try {
      const res = await fetch(`/api/segments/${id}/customers?limit=20`);
      const data = await res.json();
      if (data.success) {
        setSegmentCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Fetch segment detail error:", err);
    }
    setCustomersLoading(false);
  };

  const handleSelectSegment = (segment) => {
    setSelectedSegment(segment);
    fetchSegmentDetail(segment.id);
  };

  const addCondition = () => {
    setForm({
      ...form,
      rules: {
        ...form.rules,
        conditions: [...(form.rules.conditions || []), { field: "total_spent", operator: "greater_than", value: "" }],
      },
    });
  };

  const removeCondition = (index) => {
    const newConditions = form.rules.conditions.filter((_, i) => i !== index);
    setForm({ ...form, rules: { ...form.rules, conditions: newConditions } });
  };

  const updateCondition = (index, key, value) => {
    const newConditions = [...form.rules.conditions];
    newConditions[index] = { ...newConditions[index], [key]: value };
    // Reset operator when field type changes
    if (key === "field") {
      const fieldType = FIELD_OPTIONS.find(f => f.value === value)?.type || "number";
      const ops = OPERATOR_OPTIONS[fieldType] || [];
      newConditions[index].operator = ops[0]?.value || "greater_than";
      newConditions[index].value = "";
    }
    setForm({ ...form, rules: { ...form.rules, conditions: newConditions } });
  };

  const resetForm = () => {
    setForm({ name: "", description: "", color: "#5865F2", icon: "Users", rules: { operator: "AND", conditions: [] } });
    setPreviewCount(null);
  };

  const formatRelative = (d) => {
    if (!d) return "Never";
    const diff = new Date().getTime() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <>
      <div className="page-header">
        <h1>Segments</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            <Plus size={16} /> Create Segment
          </button>
        </div>
      </div>

      {/* Templates */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h3 style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-md)" }}>
          Quick Templates
        </h3>
        <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
          {SEGMENT_TEMPLATES.map((tmpl, i) => {
            const IconComp = ICON_MAP[tmpl.icon] || Users;
            return (
              <button
                key={i}
                onClick={() => handleCreateFromTemplate(tmpl)}
                disabled={saving}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                  background: `${tmpl.color}12`, border: `1px solid ${tmpl.color}33`,
                  borderRadius: "var(--radius-full)", cursor: "pointer", color: tmpl.color,
                  fontSize: "var(--font-size-sm)", fontWeight: 600, fontFamily: "var(--font-family)",
                  transition: "all 0.2s",
                }}
              >
                <IconComp size={14} />
                {tmpl.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Segments Grid */}
      {loading ? (
        <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>Loading segments...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selectedSegment ? "1fr 1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-lg)" }}>
          {segments.map((segment) => {
            const IconComp = ICON_MAP[segment.icon] || Users;
            const isSelected = selectedSegment?.id === segment.id;
            return (
              <div
                key={segment.id}
                className="dashboard-panel"
                style={{
                  cursor: "pointer",
                  borderColor: isSelected ? segment.color : undefined,
                  boxShadow: isSelected ? `0 0 20px ${segment.color}22` : undefined,
                }}
                onClick={() => handleSelectSegment(segment)}
              >
                <div style={{ padding: "var(--space-xl)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: "var(--radius-md)",
                        background: `${segment.color}18`, color: segment.color,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <IconComp size={22} />
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, fontSize: "var(--font-size-base)" }}>{segment.name}</h3>
                        {segment.description && (
                          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{segment.description}</p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="topbar-btn"
                        title="Recompute"
                        onClick={(e) => { e.stopPropagation(); handleCompute(segment); }}
                        style={{ width: 28, height: 28 }}
                      >
                        <RefreshCw size={13} className={computing ? "spin" : ""} />
                      </button>
                      <button
                        className="topbar-btn"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(segment.id); }}
                        style={{ width: 28, height: 28, color: "var(--accent-red)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
                    <div>
                      <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: segment.color, lineHeight: 1.2 }}>
                        {segment.customer_count || 0}
                      </div>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>customers</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: "auto" }}>
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: segment.is_dynamic ? "rgba(0,210,255,0.1)" : "rgba(255,255,255,0.05)",
                        color: segment.is_dynamic ? "var(--accent-secondary)" : "var(--text-tertiary)",
                        border: `1px solid ${segment.is_dynamic ? "rgba(0,210,255,0.2)" : "var(--border-subtle)"}`,
                        textAlign: "center",
                      }}>
                        {segment.is_dynamic ? "Dynamic" : "Static"}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)", textAlign: "center" }}>
                        {formatRelative(segment.last_computed_at)}
                      </span>
                    </div>
                  </div>

                  {/* Rules preview */}
                  {segment.rules?.conditions?.length > 0 && (
                    <div style={{ marginTop: "var(--space-md)", padding: "var(--space-sm) var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                        <Filter size={11} style={{ color: "var(--text-tertiary)" }} />
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>
                          {segment.rules.operator} Rules
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {segment.rules.conditions.map((cond, ci) => (
                          <span key={ci} style={{
                            padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                            background: `${segment.color}10`, color: segment.color,
                          }}>
                            {FIELD_OPTIONS.find(f => f.value === cond.field)?.label || cond.field} {OPERATOR_OPTIONS[FIELD_OPTIONS.find(f => f.value === cond.field)?.type || "number"]?.find(o => o.value === cond.operator)?.label || cond.operator} {cond.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Segment Detail Panel */}
          {selectedSegment && (
            <div className="dashboard-panel" style={{ gridColumn: "span 1" }}>
              <div style={{ padding: "var(--space-xl)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-lg)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <button className="topbar-btn" style={{ width: 28, height: 28 }} onClick={() => setSelectedSegment(null)}>
                      <ChevronLeft size={16} />
                    </button>
                    <h3 style={{ fontWeight: 700 }}>Customers in {selectedSegment.name}</h3>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCompute(selectedSegment)}
                      disabled={computing}
                    >
                      <RefreshCw size={12} className={computing ? "spin" : ""} /> Recompute
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => router.push(`/dashboard/campaigns?segment=${selectedSegment.id}`)}
                    >
                      <Megaphone size={12} /> Send Campaign
                    </button>
                  </div>
                </div>

                {customersLoading ? (
                  <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-tertiary)" }}>
                    <Loader2 size={16} className="spin" style={{ display: "inline-block" }} /> Loading...
                  </div>
                ) : segmentCustomers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                    No customers in this segment yet. Click Recompute to refresh.
                  </div>
                ) : (
                  <div className="table-scroll-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Channel</th>
                          <th>Spent</th>
                          <th>Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {segmentCustomers.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: "50%", background: "var(--accent-gradient)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                                }}>
                                  {c.name?.split(" ").map(n => n[0]).join("") || "?"}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{c.name || "Unknown"}</div>
                                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{c.email || c.phone || ""}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`channel-badge ${c.channel || "whatsapp"}`} style={{ fontSize: 10 }}>
                                {c.channel || "N/A"}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>{(c.total_spent || 0).toLocaleString()} EGP</td>
                            <td>{c.total_orders || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {segments.length === 0 && !loading && (
            <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
              <div className="empty-state-icon"><Target size={32} /></div>
              <h3>No segments yet</h3>
              <p>Create your first customer segment to group and target customers effectively.</p>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
                <Plus size={16} /> Create Segment
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Segment Modal */}
      {showCreateModal && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Create Segment</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSegment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Segment Name</label>
                  <input
                    type="text" className="form-input" placeholder="e.g. VIP Customers"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input form-textarea" placeholder="Describe this segment..."
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                  {/* Color Picker */}
                  <div className="form-group">
                    <label className="form-label">Color</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.value} type="button"
                          onClick={() => setForm({ ...form, color: c.value })}
                          style={{
                            width: 28, height: 28, borderRadius: "50%", background: c.value,
                            border: form.color === c.value ? "3px solid white" : "2px solid transparent",
                            cursor: "pointer", outline: "none", transition: "all 0.15s",
                            boxShadow: form.color === c.value ? `0 0 12px ${c.value}66` : "none",
                          }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Icon Picker */}
                  <div className="form-group">
                    <label className="form-label">Icon</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.entries(ICON_MAP).map(([name, Comp]) => (
                        <button
                          key={name} type="button"
                          onClick={() => setForm({ ...form, icon: name })}
                          style={{
                            width: 32, height: 32, borderRadius: "var(--radius-sm)",
                            background: form.icon === name ? `${form.color}22` : "var(--bg-glass)",
                            border: form.icon === name ? `1px solid ${form.color}44` : "1px solid var(--border-subtle)",
                            color: form.icon === name ? form.color : "var(--text-tertiary)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}
                        >
                          <Comp size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rule Builder */}
                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Segmentation Rules</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addCondition}>
                      <Plus size={12} /> Add Condition
                    </button>
                  </label>

                  {/* AND/OR toggle */}
                  {form.rules.conditions.length > 1 && (
                    <div style={{ display: "flex", gap: 4, marginBottom: "var(--space-sm)" }}>
                      {["AND", "OR"].map((op) => (
                        <button
                          key={op} type="button"
                          onClick={() => setForm({ ...form, rules: { ...form.rules, operator: op } })}
                          style={{
                            padding: "2px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                            background: form.rules.operator === op ? "var(--accent-primary)" : "var(--bg-glass)",
                            color: form.rules.operator === op ? "white" : "var(--text-tertiary)",
                            border: "1px solid var(--border-subtle)", cursor: "pointer", fontFamily: "var(--font-family)",
                          }}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                    {form.rules.conditions.map((cond, index) => {
                      const fieldType = FIELD_OPTIONS.find(f => f.value === cond.field)?.type || "number";
                      const operators = OPERATOR_OPTIONS[fieldType] || [];
                      return (
                        <div key={index} style={{
                          display: "flex", gap: 6, alignItems: "center", padding: "var(--space-sm) var(--space-md)",
                          background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                        }}>
                          <select
                            className="form-input" style={{ flex: 1, padding: "6px 8px", fontSize: "var(--font-size-xs)" }}
                            value={cond.field}
                            onChange={(e) => updateCondition(index, "field", e.target.value)}
                          >
                            {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <select
                            className="form-input" style={{ flex: 1, padding: "6px 8px", fontSize: "var(--font-size-xs)" }}
                            value={cond.operator}
                            onChange={(e) => updateCondition(index, "operator", e.target.value)}
                          >
                            {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <input
                            type={fieldType === "number" ? "number" : "text"}
                            className="form-input"
                            style={{ flex: 1, padding: "6px 8px", fontSize: "var(--font-size-xs)" }}
                            placeholder="Value"
                            value={cond.value}
                            onChange={(e) => updateCondition(index, "value", e.target.value)}
                          />
                          <button
                            type="button" onClick={() => removeCondition(index)}
                            style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: 4 }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {form.rules.conditions.length === 0 && (
                      <div style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)" }}>
                        No conditions added. All customers will be included.
                      </div>
                    )}
                  </div>

                  {/* Preview count */}
                  {form.rules.conditions.length > 0 && (
                    <div style={{
                      marginTop: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
                      background: `${form.color}12`, borderRadius: "var(--radius-sm)", border: `1px solid ${form.color}22`,
                      fontSize: "var(--font-size-sm)", color: form.color, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <Users size={14} />
                      {previewLoading ? "Counting..." : `${previewCount ?? "?"} customers match these rules`}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
                  {saving ? <><Loader2 size={14} className="spin" /> Creating...</> : "Create Segment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </>
  );
}
