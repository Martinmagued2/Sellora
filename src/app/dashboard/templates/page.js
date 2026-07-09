"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Store, Loader2, Check, Sparkles, Package, HelpCircle, FileText,
  Tag, Bot, MessageCircle, Search, X, AlertCircle, RefreshCw, Download,
} from "lucide-react";
import { useToast } from "../components/ToastProvider";
import { PageSkeleton } from "@/components/SkeletonLoader";

const CATEGORIES = [
  { value: "all", label: "All Categories", icon: Store },
  { value: "fashion", label: "Fashion", icon: Store },
  { value: "cosmetics", label: "Cosmetics", icon: Store },
  { value: "electronics", label: "Electronics", icon: Store },
  { value: "restaurant", label: "Restaurant", icon: Store },
  { value: "realestate", label: "Real Estate", icon: Store },
];

const CATEGORY_COLORS = {
  fashion: "#EB459E",
  cosmetics: "#F8A532",
  electronics: "#00D2FF",
  restaurant: "#3BA55C",
  realestate: "#5865F2",
  general: "#6c5ce7",
};

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState(null); // templateId being installed
  const [confirmTpl, setConfirmTpl] = useState(null); // template object for the confirm modal

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates?type=store");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      toast.error("Failed to load templates: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = templates.filter((t) => {
    if (filter !== "all" && t.category !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (t.name || "").toLowerCase().includes(s) ||
        (t.description || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleInstall = async (template, options = {}) => {
    setInstalling(template.id);
    try {
      const res = await fetch("/api/templates?type=store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: template.id, options }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Install failed");
      const s = data.installed || {};
      toast.success(
        `Installed "${template.name}" — ${s.products || 0} products, ${s.faqs || 0} FAQs, ${s.policies || 0} policies, ${s.coupons || 0} coupons added.`
      );
      setConfirmTpl(null);
      fetchTemplates();
    } catch (e) {
      toast.error("Install failed: " + e.message);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Store size={24} /> Templates Marketplace
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Install a pre-configured storefront to instantly add products, FAQs, policies, coupons, AI personality, and a greeting message to your account.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="filter-tabs" style={{ flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = filter === c.value;
            return (
              <button
                key={c.value}
                className={`filter-tab ${active ? "active" : ""}`}
                onClick={() => setFilter(c.value)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Icon size={12} /> {c.label}
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-tertiary)", pointerEvents: "none",
          }} />
          <input
            className="form-input"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: "100%" }}
          />
        </div>
      </div>

      {/* Templates grid */}
      {loading ? (
        <PageSkeleton />
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 60, textAlign: "center" }}>
          <Store size={48} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
          <h3 style={{ marginBottom: 6 }}>No templates found</h3>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            {search || filter !== "all"
              ? "Try adjusting your filters or search."
              : "Templates will appear here once they are seeded."}
          </p>
        </div>
      ) : (
        <div className="products-grid">
          {filtered.map((tpl, i) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              index={i}
              installing={installing === tpl.id}
              onInstallClick={() => setConfirmTpl(tpl)}
            />
          ))}
        </div>
      )}

      {/* Confirm install modal */}
      {confirmTpl && createPortal(
        <InstallConfirmModal
          template={confirmTpl}
          installing={installing === confirmTpl.id}
          onConfirm={(options) => handleInstall(confirmTpl, options)}
          onClose={() => !installing && setConfirmTpl(null)}
        />,
        document.body
      )}
    </>
  );
}

// ─── Template Card ───
function TemplateCard({ template, index, installing, onInstallClick }) {
  const color = template.color || CATEGORY_COLORS[template.category] || "#6c5ce7";
  return (
    <div
      className="product-card"
      style={{ animationDelay: `${index * 0.05}s`, display: "flex", flexDirection: "column" }}
    >
      {/* Header / banner */}
      <div style={{
        position: "relative",
        padding: "20px 16px",
        background: `linear-gradient(135deg, ${color}22, ${color}08)`,
        borderBottom: `1px solid ${color}33`,
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -20, right: -20, width: 80, height: 80,
          borderRadius: "50%", background: `${color}22`, filter: "blur(28px)",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `${color}22`, color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, border: `1px solid ${color}44`,
          }}>
            {template.icon || "🏪"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              color, letterSpacing: 1, marginBottom: 2,
            }}>
              {template.category}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
              {template.name}
            </div>
          </div>
          {template.installed && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
              background: "rgba(59,165,92,0.15)", color: "#3BA55C",
              border: "1px solid rgba(59,165,92,0.3)",
              flexShrink: 0,
            }}>
              <Check size={10} /> INSTALLED
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="product-card-body" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <p style={{
          fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5,
          margin: 0, marginBottom: 12, display: "-webkit-box",
          WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {template.description}
        </p>

        {/* Stats row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
          marginBottom: 12,
        }}>
          <StatChip icon={Package} count={template.product_count} label="Products" color="#6c5ce7" />
          <StatChip icon={HelpCircle} count={template.faq_count} label="FAQs" color="#00D2FF" />
          <StatChip icon={FileText} count={template.policy_count} label="Policies" color="#F8A532" />
          <StatChip icon={Tag} count={template.coupon_count} label="Coupons" color="#3BA55C" />
        </div>

        {/* Includes list */}
        <div style={{
          fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12,
          display: "flex", flexWrap: "wrap", gap: 6,
        }}>
          {template.config?.ai_personality && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 8,
              background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
            }}>
              <Bot size={10} /> AI Personality
            </span>
          )}
          {template.config?.greeting_message && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 8,
              background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
            }}>
              <MessageCircle size={10} /> Greeting Msg
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="product-card-footer" style={{ marginTop: "auto", borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {template.installed
              ? `Installed ${template.installed_at ? new Date(template.installed_at).toLocaleDateString() : ""}`
              : "Ready to install"}
          </span>
          <button
            className={`btn ${template.installed ? "btn-secondary" : "btn-primary"} btn-sm`}
            onClick={onInstallClick}
            disabled={installing}
            style={{ minWidth: 110 }}
          >
            {installing ? (
              <><Loader2 size={14} className="spin" /> Installing...</>
            ) : template.installed ? (
              <><RefreshCw size={14} /> Re-install</>
            ) : (
              <><Download size={14} /> Install</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Chip ───
function StatChip({ icon: Icon, count, label, color }) {
  return (
    <div style={{
      textAlign: "center", padding: "6px 4px",
      background: "var(--bg-glass)", borderRadius: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 2 }}>
        <Icon size={10} style={{ color }} />
        <div style={{ fontSize: 13, fontWeight: 800 }}>{count}</div>
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ─── Install Confirm Modal ───
function InstallConfirmModal({ template, installing, onConfirm, onClose }) {
  const [options, setOptions] = useState({
    skip_products: false,
    skip_faqs: false,
    skip_policies: false,
    skip_coupons: false,
    skip_personality: false,
    skip_greeting: false,
  });

  const color = template.color || CATEGORY_COLORS[template.category] || "#6c5ce7";
  const config = template.config || {};

  const toggle = (key) => setOptions((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{template.icon || "🏪"}</span>
            Install "{template.name}"
          </h3>
          <button className="modal-close" onClick={onClose} disabled={installing}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {template.installed && (
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(248,165,50,0.1)", border: "1px solid rgba(248,165,50,0.3)",
              fontSize: 12, color: "var(--accent-orange)", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertCircle size={14} />
              You've already installed this template. Re-installing will duplicate the products, FAQs, policies, and coupons. Coupon codes are auto-suffixed to avoid collisions.
            </div>
          )}

          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
            {template.description}
          </p>

          {/* What will be installed */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, textTransform: "uppercase",
              color: "var(--text-tertiary)", letterSpacing: 1, marginBottom: 8,
            }}>
              This will add to your account:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <InstallRow icon={Package} color="#6c5ce7" label="Products" count={template.product_count}
                items={(config.products || []).map((p) => p.name)} />
              <InstallRow icon={HelpCircle} color="#00D2FF" label="FAQs" count={template.faq_count}
                items={(config.faqs || []).map((f) => f.question)} />
              <InstallRow icon={FileText} color="#F8A532" label="Policies" count={template.policy_count}
                items={(config.policies || []).map((p) => p.title)} />
              <InstallRow icon={Tag} color="#3BA55C" label="Coupons" count={template.coupon_count}
                items={(config.coupons || []).map((c) => c.code)} />
              {config.ai_personality && (
                <InstallRow icon={Bot} color="#EB459E" label="AI Personality" count={1}
                  items={[`Tone: ${config.ai_personality.tone || "friendly"}`]} />
              )}
              {config.greeting_message && (
                <InstallRow icon={MessageCircle} color="#5865F2" label="Greeting Message" count={1}
                  items={[config.greeting_message]} />
              )}
            </div>
          </div>

          {/* Selective install options */}
          <div style={{
            padding: 12, borderRadius: 12, background: "var(--bg-glass)",
            border: "1px solid var(--border-subtle)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, textTransform: "uppercase",
              color: "var(--text-tertiary)", letterSpacing: 1, marginBottom: 8,
            }}>
              Skip sections (optional):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <ToggleOption label="Products" checked={options.skip_products} onChange={() => toggle("skip_products")} />
              <ToggleOption label="FAQs" checked={options.skip_faqs} onChange={() => toggle("skip_faqs")} />
              <ToggleOption label="Policies" checked={options.skip_policies} onChange={() => toggle("skip_policies")} />
              <ToggleOption label="Coupons" checked={options.skip_coupons} onChange={() => toggle("skip_coupons")} />
              <ToggleOption label="AI Personality" checked={options.skip_personality} onChange={() => toggle("skip_personality")} />
              <ToggleOption label="Greeting Message" checked={options.skip_greeting} onChange={() => toggle("skip_greeting")} />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={installing}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(options)}
            disabled={installing}
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            {installing ? (
              <><Loader2 size={16} className="spin" /> Installing...</>
            ) : (
              <><Download size={16} /> {template.installed ? "Re-install Template" : "Install Template"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Install Row ───
function InstallRow({ icon: Icon, color, label, count, items }) {
  if (count === 0) return null;
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10,
      background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: `${color}22`, color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={12} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6,
          background: `${color}22`, color, marginLeft: "auto",
        }}>{count}</span>
      </div>
      {items && items.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 32, lineHeight: 1.5 }}>
          {items.slice(0, 4).join(" · ")}
          {items.length > 4 && ` +${items.length - 4} more`}
        </div>
      )}
    </div>
  );
}

// ─── Toggle Option ───
function ToggleOption({ label, checked, onChange }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 8px", borderRadius: 8, cursor: "pointer",
      background: "var(--bg-glass)", fontSize: 12, fontWeight: 600,
      border: `1px solid ${checked ? "var(--accent-red)" : "var(--border-subtle)"}`,
      color: checked ? "var(--accent-red)" : "var(--text-secondary)",
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ margin: 0 }} />
      {checked ? "Skip " : "Include "}{label}
    </label>
  );
}
