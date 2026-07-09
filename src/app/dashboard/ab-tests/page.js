"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FlaskConical, Plus, Play, Pause, Square, BarChart3,
  Users, TrendingUp, AlertCircle, CheckCircle, Loader2,
  X, ChevronRight, Eye, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "var(--text-tertiary)", bg: "rgba(255,255,255,0.05)" },
  running: { label: "Running", color: "var(--accent-green)", bg: "rgba(0,230,118,0.1)" },
  paused: { label: "Paused", color: "var(--accent-orange)", bg: "rgba(255,145,0,0.1)" },
  completed: { label: "Completed", color: "var(--accent-secondary)", bg: "rgba(0,210,255,0.1)" },
};

const METRIC_LABELS = {
  conversion: "Conversion Rate",
  response_rate: "Response Rate",
  order_value: "Order Value",
  customer_satisfaction: "Customer Satisfaction",
};

const PRESETS = [
  { label: "50 / 50", a: 50, b: 50 },
  { label: "70 / 30", a: 70, b: 30 },
  { label: "80 / 20", a: 80, b: 20 },
  { label: "90 / 10", a: 90, b: 10 },
];

export default function ABTestsPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testDetail, setTestDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState("conversion");
  const [variantA, setVariantA] = useState({ name: "A", weight: 50, system_prompt: "", greeting: "" });
  const [variantB, setVariantB] = useState({ name: "B", weight: 50, system_prompt: "", greeting: "" });
  const [creating, setCreating] = useState(false);

  const fetchTests = useCallback(async () => {
    try {
      const res = await fetch("/api/ab-tests");
      const data = await res.json();
      if (data.tests) setTests(data.tests);
    } catch (err) {
      console.error("Fetch tests error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const fetchTestDetail = async (testId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/ab-tests/${testId}`);
      const data = await res.json();
      if (data.test) {
        setTestDetail({ ...data.test, significance: data.significance });
        setSelectedTest(testId);
      }
    } catch (err) {
      console.error("Fetch test detail error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateTest = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          metric,
          variants: [variantA, variantB],
        }),
      });
      const data = await res.json();
      if (data.test) {
        setShowCreateModal(false);
        resetForm();
        fetchTests();
      }
    } catch (err) {
      console.error("Create test error:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (testId, newStatus) => {
    try {
      const res = await fetch(`/api/ab-tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.test) {
        fetchTests();
        if (selectedTest === testId) {
          fetchTestDetail(testId);
        }
      }
    } catch (err) {
      console.error("Status change error:", err);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setMetric("conversion");
    setVariantA({ name: "A", weight: 50, system_prompt: "", greeting: "" });
    setVariantB({ name: "B", weight: 50, system_prompt: "", greeting: "" });
  };

  const applyPreset = (preset) => {
    setVariantA({ ...variantA, weight: preset.a });
    setVariantB({ ...variantB, weight: preset.b });
  };

  const activeTest = tests.find((t) => t.id === selectedTest);
  const detail = testDetail;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlaskConical size={28} style={{ color: "var(--accent-primary-light)" }} />
          A/B Tests
        </h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Test
          </button>
        </div>
      </div>

      <div className="ab-tests-layout">
        {/* Left: Test List */}
        <div className="ab-tests-list">
          {tests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FlaskConical size={36} /></div>
              <h3>No A/B Tests Yet</h3>
              <p>Create your first A/B test to compare different AI prompt versions and optimize conversions.</p>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} /> Create First Test
              </button>
            </div>
          ) : (
            tests.map((test) => {
              const cfg = STATUS_CONFIG[test.status] || STATUS_CONFIG.draft;
              const isSelected = selectedTest === test.id;
              return (
                <div
                  key={test.id}
                  className={`ab-test-card ${isSelected ? "active" : ""}`}
                  onClick={() => fetchTestDetail(test.id)}
                >
                  <div className="ab-test-card-header">
                    <div className="ab-test-card-name">{test.name}</div>
                    <span className="ab-test-status-badge" style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                  </div>
                  {test.description && (
                    <div className="ab-test-card-desc">{test.description}</div>
                  )}
                  <div className="ab-test-card-meta">
                    <span>{METRIC_LABELS[test.metric] || test.metric}</span>
                    <span>{test.variants?.length || 0} variants</span>
                    <span>{test.results ? Object.values(test.results).reduce((s, r) => s + (r.impressions || 0), 0) : 0} impressions</span>
                  </div>
                  <ChevronRight size={16} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                </div>
              );
            })
          )}
        </div>

        {/* Right: Test Detail / Results */}
        <div className="ab-tests-detail">
          {detailLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
              <Loader2 size={28} className="spin" style={{ color: "var(--accent-primary)" }} />
            </div>
          ) : detail ? (
            <div className="ab-test-detail-content">
              {/* Header */}
              <div className="ab-test-detail-header">
                <div>
                  <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: 4 }}>{detail.name}</h2>
                  {detail.description && <p style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>{detail.description}</p>}
                  <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-sm)", fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    <span>Metric: {METRIC_LABELS[detail.metric]}</span>
                    {detail.started_at && <span>Started: {new Date(detail.started_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="ab-test-controls">
                  {detail.status === "draft" && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(detail.id, "running")}>
                      <Play size={14} /> Start Test
                    </button>
                  )}
                  {detail.status === "running" && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(detail.id, "paused")}>
                        <Pause size={14} /> Pause
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(detail.id, "completed")}>
                        <Square size={14} /> Stop
                      </button>
                    </>
                  )}
                  {detail.status === "paused" && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(detail.id, "running")}>
                        <Play size={14} /> Resume
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(detail.id, "completed")}>
                        <Square size={14} /> Stop
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Significance Indicator */}
              {detail.significance && (
                <div className={`ab-significance-banner ${detail.significance.status}`}>
                  <div className="ab-significance-icon">
                    {detail.significance.status === "significant" ? <CheckCircle size={20} /> :
                     detail.significance.status === "trending" ? <TrendingUp size={20} /> :
                     <AlertCircle size={20} />}
                  </div>
                  <div>
                    <div className="ab-significance-message">{detail.significance.message}</div>
                    {detail.significance.confidence > 0 && (
                      <div className="ab-significance-confidence">
                        Confidence: {detail.significance.confidence}%
                        {detail.significance.winner && ` — Winner: Variant ${detail.significance.winner}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Variant Comparison */}
              <div className="ab-variants-comparison">
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--space-md)" }}>
                  <BarChart3 size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  Variant Comparison
                </h3>

                <div className="ab-variants-grid">
                  {(detail.variants || []).map((variant) => {
                    const res = detail.results?.[variant.name] || { impressions: 0, conversions: 0, revenue: 0 };
                    const rate = res.impressions > 0 ? ((res.conversions / res.impressions) * 100).toFixed(1) : "0.0";
                    const isWinner = detail.significance?.winner === variant.name;

                    return (
                      <div key={variant.name} className={`ab-variant-card ${isWinner ? "winner" : ""}`}>
                        {isWinner && <div className="ab-variant-winner-badge"><Zap size={12} /> Winner</div>}
                        <div className="ab-variant-name">Variant {variant.name}</div>
                        <div className="ab-variant-weight">{variant.weight}% traffic</div>

                        <div className="ab-variant-stats">
                          <div className="ab-variant-stat">
                            <span className="ab-variant-stat-value">{res.impressions}</span>
                            <span className="ab-variant-stat-label">Impressions</span>
                          </div>
                          <div className="ab-variant-stat">
                            <span className="ab-variant-stat-value">{res.conversions}</span>
                            <span className="ab-variant-stat-label">Conversions</span>
                          </div>
                          <div className="ab-variant-stat">
                            <span className="ab-variant-stat-value">{rate}%</span>
                            <span className="ab-variant-stat-label">Rate</span>
                          </div>
                          <div className="ab-variant-stat">
                            <span className="ab-variant-stat-value">{res.revenue > 0 ? `EGP ${res.revenue.toFixed(0)}` : "-"}</span>
                            <span className="ab-variant-stat-label">Revenue</span>
                          </div>
                        </div>

                        {/* Bar Chart */}
                        <div className="ab-variant-bar-container">
                          <div className="ab-variant-bar-bg">
                            <div
                              className="ab-variant-bar-fill"
                              style={{ width: `${Math.min(parseFloat(rate), 100)}%` }}
                            />
                          </div>
                          <span className="ab-variant-bar-label">{rate}%</span>
                        </div>

                        {/* Variant Details */}
                        {variant.greeting && (
                          <div className="ab-variant-detail">
                            <span className="ab-variant-detail-label">Greeting:</span>
                            <span className="ab-variant-detail-value">{variant.greeting.slice(0, 80)}{variant.greeting.length > 80 ? "..." : ""}</span>
                          </div>
                        )}
                        {variant.system_prompt && (
                          <div className="ab-variant-detail">
                            <span className="ab-variant-detail-label">Prompt:</span>
                            <span className="ab-variant-detail-value">{variant.system_prompt.slice(0, 80)}{variant.system_prompt.length > 80 ? "..." : ""}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><Eye size={36} /></div>
              <h3>Select a Test</h3>
              <p>Choose an A/B test from the list to view its details and results.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Test Modal */}
      {showCreateModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FlaskConical size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />Create A/B Test</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Test Name */}
              <div className="form-group">
                <label className="form-label">Test Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Greeting Style Test"
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-input form-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you testing and why?"
                  rows={2}
                />
              </div>

              {/* Metric */}
              <div className="form-group">
                <label className="form-label">Metric to Track</label>
                <select className="form-input" value={metric} onChange={(e) => setMetric(e.target.value)}>
                  <option value="conversion">Conversion Rate</option>
                  <option value="response_rate">Response Rate</option>
                  <option value="order_value">Order Value</option>
                  <option value="customer_satisfaction">Customer Satisfaction</option>
                </select>
              </div>

              {/* Traffic Split Presets */}
              <div className="form-group">
                <label className="form-label">Traffic Split</label>
                <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      className={`ab-preset-btn ${variantA.weight === p.a && variantB.weight === p.b ? "active" : ""}`}
                      onClick={() => applyPreset(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant A */}
              <div className="ab-variant-form">
                <div className="ab-variant-form-header">
                  <span className="ab-variant-form-badge" style={{ background: "rgba(108,92,231,0.15)", color: "var(--accent-primary-light)" }}>A</span>
                  <span style={{ fontWeight: 600 }}>Control (Current)</span>
                  <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)" }}>{variantA.weight}% traffic</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Custom System Prompt (optional)</label>
                  <textarea
                    className="form-input form-textarea"
                    value={variantA.system_prompt}
                    onChange={(e) => setVariantA({ ...variantA, system_prompt: e.target.value })}
                    placeholder="Leave empty to use the default AI personality prompt"
                    rows={3}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Greeting Message (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={variantA.greeting}
                    onChange={(e) => setVariantA({ ...variantA, greeting: e.target.value })}
                    placeholder="Hi! How can I help you today?"
                  />
                </div>
              </div>

              {/* Variant B */}
              <div className="ab-variant-form" style={{ borderColor: "rgba(0,230,118,0.2)" }}>
                <div className="ab-variant-form-header">
                  <span className="ab-variant-form-badge" style={{ background: "rgba(0,230,118,0.15)", color: "var(--accent-green)" }}>B</span>
                  <span style={{ fontWeight: 600 }}>Challenger (New)</span>
                  <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)" }}>{variantB.weight}% traffic</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Custom System Prompt (optional)</label>
                  <textarea
                    className="form-input form-textarea"
                    value={variantB.system_prompt}
                    onChange={(e) => setVariantB({ ...variantB, system_prompt: e.target.value })}
                    placeholder="Enter the alternative AI prompt you want to test"
                    rows={3}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Greeting Message (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={variantB.greeting}
                    onChange={(e) => setVariantB({ ...variantB, greeting: e.target.value })}
                    placeholder="Hey there! Ready to find something amazing?"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateTest} disabled={creating || !name.trim()}>
                {creating ? <><Loader2 size={16} className="spin" /> Creating...</> : <><FlaskConical size={16} /> Create Test</>}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
