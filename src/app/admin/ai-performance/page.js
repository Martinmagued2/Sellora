"use client";

import { useState, useEffect } from "react";
import {
  Bot, Clock, AlertTriangle, CheckCircle, Activity, Wrench, RefreshCw,
} from "lucide-react";

const ADMIN_ACCOUNT_ID = "0643bcc3-d5ef-43e1-a1be-0b36de04ef92";

export default function AdminAIPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/ai-performance", {
          headers: { "x-account-id": ADMIN_ACCOUNT_ID },
        });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to load data");
        }
      } catch (e) {
        setError("Network error");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
        <RefreshCw size={24} className="spin" style={{ display: "inline-block", marginBottom: "var(--space-md)" }} />
        <div>Loading AI performance data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--accent-red)" }}>
        <h3>Error</h3>
        <p>{error || "No data"}</p>
      </div>
    );
  }

  const formatTime = (seconds) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const maxAiUsage = Math.max(...data.dailyAiUsage.map((d) => d.aiReplies), 1);

  const sentimentColors = {
    positive: "var(--accent-green)",
    neutral: "var(--text-tertiary)",
    negative: "var(--accent-red)",
    urgent: "var(--accent-orange)",
  };

  const intentColors = [
    "#E84327", "#F8A532", "#5865F2", "#00D2FF", "#3BA55C",
    "#EB459E", "#7E88F5", "#25D366", "#ED4245", "#a29bfe",
  ];

  const toolColors = [
    "#E84327", "#5865F2", "#3BA55C", "#F8A532", "#00D2FF",
    "#EB459E", "#25D366", "#7E88F5", "#ED4245", "#a29bfe",
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total AI Replies</span>
            <div className="stat-card-icon admin-red"><Bot size={18} /></div>
          </div>
          <div className="stat-card-value">{data.totalAiReplies.toLocaleString()}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>Last 30 days</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Avg Response Time</span>
            <div className="stat-card-icon blue"><Clock size={18} /></div>
          </div>
          <div className="stat-card-value">{formatTime(data.avgResponseTime)}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>Average across all AI replies</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Error Rate</span>
            <div className="stat-card-icon admin-orange"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-card-value">{data.errorRate}%</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {data.failedActions} / {data.totalActions} actions failed
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">AI Resolution Rate</span>
            <div className="stat-card-icon green"><CheckCircle size={18} /></div>
          </div>
          <div className="stat-card-value">{data.aiResolutionRate}%</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {data.aiOnlyClosedConversations} / {data.closedConversations} conversations
          </div>
        </div>
      </div>

      {/* Intent Distribution + Sentiment */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Intent Distribution */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Intent Distribution</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {data.intentDistribution.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No intent data</div>
            ) : (
              data.intentDistribution.map((item, i) => {
                const total = data.intentDistribution.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={i} style={{ marginBottom: i < data.intentDistribution.length - 1 ? "var(--space-md)" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", textTransform: "capitalize" }}>
                        {item.intent.replace(/_/g, " ")}
                      </span>
                      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, width: `${pct}%`,
                        background: intentColors[i % intentColors.length],
                        transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Sentiment Analysis</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {data.sentiment.total === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No sentiment data</div>
            ) : (
              <>
                <div className="admin-dist-bar" style={{ marginBottom: "var(--space-lg)", height: 12 }}>
                  {data.sentiment.positivePct > 0 && (
                    <div className="admin-dist-segment" style={{ width: `${data.sentiment.positivePct}%`, background: "var(--accent-green)" }} />
                  )}
                  {data.sentiment.neutralPct > 0 && (
                    <div className="admin-dist-segment" style={{ width: `${data.sentiment.neutralPct}%`, background: "var(--text-tertiary)" }} />
                  )}
                  {data.sentiment.negativePct > 0 && (
                    <div className="admin-dist-segment" style={{ width: `${data.sentiment.negativePct}%`, background: "var(--accent-red)" }} />
                  )}
                  {data.sentiment.urgentPct > 0 && (
                    <div className="admin-dist-segment" style={{ width: `${data.sentiment.urgentPct}%`, background: "var(--accent-orange)" }} />
                  )}
                </div>
                {[
                  { label: "Positive", value: data.sentiment.counts.positive, pct: data.sentiment.positivePct, color: "var(--accent-green)" },
                  { label: "Neutral", value: data.sentiment.counts.neutral, pct: data.sentiment.neutralPct, color: "var(--text-tertiary)" },
                  { label: "Negative", value: data.sentiment.counts.negative, pct: data.sentiment.negativePct, color: "var(--accent-red)" },
                  { label: "Urgent", value: data.sentiment.counts.urgent, pct: data.sentiment.urgentPct, color: "var(--accent-orange)" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)", padding: "var(--space-sm)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                      {item.label}
                    </span>
                    <span style={{ fontSize: "var(--font-size-sm)" }}>
                      <strong>{item.value}</strong>
                      <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>({item.pct}%)</span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tool Calls + Daily Usage */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Tool Calls */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Tool Calls</h3>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Total: {data.toolCalls.total.toLocaleString()}
            </span>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {data.toolCalls.distribution.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No tool call data</div>
            ) : (
              data.toolCalls.distribution.map((item, i) => {
                const maxCount = data.toolCalls.distribution[0]?.count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={i} style={{ marginBottom: i < data.toolCalls.distribution.length - 1 ? "var(--space-md)" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Wrench size={12} style={{ color: toolColors[i % toolColors.length] }} />
                        {item.tool}
                      </span>
                      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{item.count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, width: `${pct}%`,
                        background: toolColors[i % toolColors.length],
                        transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Daily AI Usage Chart */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Daily AI Usage (30 days)</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg) var(--space-md)" }}>
            <div style={{ position: "relative", height: 200 }}>
              <div className="chart-bars">
                {data.dailyAiUsage.map((day, idx) => {
                  const pct = (day.aiReplies / maxAiUsage) * 100;
                  return (
                    <div
                      key={idx}
                      className="admin-chart-bar"
                      style={{ height: `${Math.max(pct, 3)}%` }}
                      title={`${day.date}: ${day.aiReplies} AI replies, avg ${formatTime(day.avgResponseTime)}`}
                    />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, position: "absolute", bottom: -20, left: 0, right: 0 }}>
                <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{data.dailyAiUsage[0]?.date?.slice(5)}</span>
                <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{data.dailyAiUsage[Math.floor(data.dailyAiUsage.length / 2)]?.date?.slice(5)}</span>
                <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{data.dailyAiUsage[data.dailyAiUsage.length - 1]?.date?.slice(5)}</span>
              </div>
            </div>

            {/* Additional stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-md)", marginTop: "var(--space-2xl)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 800, color: "#E84327" }}>{data.handoffRate}%</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Handoff Rate</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 800, color: "var(--accent-primary-light)" }}>{data.faqMatchRate}%</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>FAQ Match Rate</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 800, color: "var(--accent-green)" }}>{data.keywordMatchRate}%</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Keyword Match Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
