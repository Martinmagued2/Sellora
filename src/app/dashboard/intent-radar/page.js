'use client';

import { useState } from 'react';
import { 
  Radar, Activity, Zap, ShoppingCart, AlertTriangle, 
  CheckCircle2, ArrowRight, ShieldAlert, Sparkles, Filter 
} from 'lucide-react';

export default function IntentRadarPage() {
  const [sessions, setSessions] = useState([
    { id: 'sess_1', name: 'Sophia R.', page: '/checkout/step-2', cartValue: '$240.00', score: 88, status: 'hesitating', time: '12s ago', issue: 'Hovering on Shipping Policy' },
    { id: 'sess_2', name: 'Marcus K.', page: '/products/silk-shirt', cartValue: '$89.00', score: 94, status: 'high_intent', time: '4s ago', issue: 'Viewed 4 photos' },
    { id: 'sess_3', name: 'Elena B.', page: '/cart', cartValue: '$410.00', score: 45, status: 'cart_risk', time: '45s ago', issue: 'Inactive cursor near exit' },
    { id: 'sess_4', name: 'David W.', page: '/onboarding', cartValue: '$0.00', score: 62, status: 'browsing', time: '2m ago', issue: 'Reading reviews' }
  ]);

  const [activeNotification, setActiveNotification] = useState(null);

  const triggerIntervention = (sessionId, type) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, status: 'converted', score: 99, issue: `Intervention Sent: ${type}` };
      }
      return s;
    }));
    setActiveNotification(`🚀 Micro-Offer (${type}) automatically dispatched to visitor session ${sessionId}!`);
    setTimeout(() => setActiveNotification(null), 4000);
  };

  return (
    <div style={{ paddingBottom: "var(--space-2xl)" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Radar size={28} style={{ color: "var(--accent-primary-light)" }} />
            Predictive Intent Radar
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 4 }}>
            Real-Time Live Visitor Scoring &amp; One-Click Autonomous Conversion Interventions
          </p>
        </div>
        <div className="page-header-actions">
          <span className="badge badge-success" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-green)" }}></span>
            4 Active Streamers
          </span>
        </div>
      </div>

      {activeNotification && (
        <div style={{
          padding: "var(--space-md) var(--space-lg)",
          background: "rgba(108, 92, 231, 0.15)",
          border: "1px solid rgba(108, 92, 231, 0.3)",
          borderRadius: "var(--radius-md)",
          color: "var(--accent-primary-light)",
          marginBottom: "var(--space-lg)",
          display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500
        }}>
          <Sparkles size={18} />
          {activeNotification}
        </div>
      )}

      {/* Analytics Cards */}
      <div className="stats-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--space-md)",
        marginBottom: "var(--space-xl)"
      }}>
        <div className="dashboard-panel" style={{ padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-tertiary)", fontSize: 12 }}>
            <span>High Intent Buyers</span>
            <Zap size={16} style={{ color: "var(--accent-green)" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>2 Visitors</div>
          <div style={{ fontSize: 12, color: "var(--accent-green)", marginTop: 4 }}>90%+ Conversion Probability</div>
        </div>

        <div className="dashboard-panel" style={{ padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-tertiary)", fontSize: 12 }}>
            <span>Hesitating at Checkout</span>
            <AlertTriangle size={16} style={{ color: "var(--accent-orange)" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>1 Visitor</div>
          <div style={{ fontSize: 12, color: "var(--accent-orange)", marginTop: 4 }}>Needs Shipping / Discount Push</div>
        </div>

        <div className="dashboard-panel" style={{ padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-tertiary)", fontSize: 12 }}>
            <span>High Cart Abandon Risk</span>
            <ShieldAlert size={16} style={{ color: "var(--accent-red)" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>$410.00 At Risk</div>
          <div style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 4 }}>1 Idle Cart Session</div>
        </div>

        <div className="dashboard-panel" style={{ padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-tertiary)", fontSize: 12 }}>
            <span>Auto Interventions</span>
            <Activity size={16} style={{ color: "var(--accent-primary-light)" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>94.2% Success</div>
          <div style={{ fontSize: 12, color: "var(--accent-primary-light)", marginTop: 4 }}>+ $1,280 Recovered Today</div>
        </div>
      </div>

      {/* Live Stream Panel */}
      <div className="dashboard-panel">
        <div className="dashboard-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} style={{ color: "var(--accent-primary-light)" }} />
            Live Visitor Intent Radar &amp; Direct Actions
          </h3>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Auto-refreshing live telemetry</span>
        </div>

        <div className="dashboard-panel-body" style={{ padding: 0 }}>
          {sessions.map((session) => (
            <div key={session.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "var(--space-lg)", borderBottom: "1px solid var(--border-subtle)",
              gap: "var(--space-md)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "var(--radius-md)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 16,
                  background: session.score > 80 ? "rgba(0, 230, 118, 0.12)" : session.score > 60 ? "rgba(255, 145, 0, 0.12)" : "rgba(255, 82, 82, 0.12)",
                  color: session.score > 80 ? "var(--accent-green)" : session.score > 60 ? "var(--accent-orange)" : "var(--accent-red)",
                  border: `1px solid ${session.score > 80 ? "rgba(0, 230, 118, 0.3)" : session.score > 60 ? "rgba(255, 145, 0, 0.3)" : "rgba(255, 82, 82, 0.3)"}`
                }}>
                  {session.score}%
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{session.name}</strong>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 10,
                      background: "var(--bg-glass)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)"
                    }}>
                      {session.page}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>Cart: <strong style={{ color: "var(--text-secondary)" }}>{session.cartValue}</strong></span>
                    <span>•</span>
                    <span style={{ color: "var(--accent-primary-light)", fontWeight: 500 }}>{session.issue}</span>
                    <span>•</span>
                    <span>{session.time}</span>
                  </div>
                </div>
              </div>

              <div>
                {session.status === 'converted' ? (
                  <span className="badge badge-success" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}>
                    <CheckCircle2 size={14} /> Intervention Active
                  </span>
                ) : (
                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    <button 
                      onClick={() => triggerIntervention(session.id, 'Free Shipping Popup')}
                      className="btn btn-primary btn-sm"
                    >
                      Offer Free Shipping
                    </button>
                    <button 
                      onClick={() => triggerIntervention(session.id, 'AI Dynamic Discount')}
                      className="btn btn-secondary btn-sm"
                    >
                      10% AI Coupon
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

