'use client';

import { useState } from 'react';
import { Sparkles, Palette, Send, Copy, Check, Eye, Wand2, RefreshCw } from 'lucide-react';

export default function CreativeStudioPage() {
  const [productName, setProductName] = useState('Sellora Premium Silk Shirt');
  const [targetAudience, setTargetAudience] = useState('Luxury Fashion Buyers');
  const [campaignStyle, setCampaignStyle] = useState('Luxury');
  const [loading, setLoading] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/creative-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, targetAudience, campaignStyle })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedAsset(data.asset);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ paddingBottom: "var(--space-2xl)" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={28} style={{ color: "var(--accent-orange)" }} />
            Autonomous Creative Studio
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 4 }}>
            Synthesize Multi-Style Ad Copy &amp; Dynamic Lifestyle Visual Assets in Seconds
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--space-xl)" }}>
        {/* Generator Controls */}
        <div className="dashboard-panel" style={{ padding: "var(--space-xl)" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-lg)" }}>
            <Wand2 size={18} style={{ color: "var(--accent-orange)" }} />
            Campaign Parameters
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Product Name</label>
              <input
                type="text"
                className="form-input"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Target Audience Profile</label>
              <input
                type="text"
                className="form-input"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Creative Tone / Style</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-xs)" }}>
                {['Luxury', 'FOMO / Urgent', 'Social Proof'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setCampaignStyle(style)}
                    className={`btn ${campaignStyle === style ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ fontSize: 11 }}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", justifyContent: "center" }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" /> Synthesizing Creative...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate Campaign Studio Package
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Asset Preview Canvas */}
        <div className="dashboard-panel" style={{ padding: "var(--space-xl)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-lg)" }}>
              <Eye size={18} style={{ color: "var(--accent-primary-light)" }} />
              Generated Campaign Asset Canvas
            </h3>

            {generatedAsset ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
                {/* Visual Banner Preview */}
                <div style={{
                  position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden",
                  border: "1px solid var(--border-subtle)", background: "linear-gradient(135deg, rgba(108, 92, 231, 0.2) 0%, rgba(15, 23, 42, 0.9) 100%)",
                  padding: "var(--space-xl)", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end"
                }}>
                  <div style={{
                    position: "absolute", top: 12, right: 12, background: "rgba(255, 145, 0, 0.2)",
                    border: "1px solid rgba(255, 145, 0, 0.4)", color: "var(--accent-orange)",
                    fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700
                  }}>
                    {generatedAsset.campaignStyle} Theme
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                    {generatedAsset.headline}
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
                    {generatedAsset.body}
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <button className="btn btn-primary btn-sm">
                      {generatedAsset.cta} →
                    </button>
                  </div>
                </div>

                {/* Asset Details & Copy Action */}
                <div style={{ padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Generated Ad Copy</span>
                    <button
                      onClick={() => handleCopy(`${generatedAsset.headline}\n${generatedAsset.body}`)}
                      style={{ background: "none", border: "none", color: "var(--accent-primary-light)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy Snippet'}
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace", margin: 0 }}>
                    {generatedAsset.headline} - {generatedAsset.body}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)", padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>
                <Palette size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                <p style={{ fontSize: 13 }}>Configure parameters and click generate to watch AI synthesize custom ad assets!</p>
              </div>
            )}
          </div>

          <div style={{ paddingTop: "var(--space-md)", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)" }}>
            <span>Ready to dispatch to Meta / WhatsApp / Klaviyo</span>
            <button className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Send size={14} style={{ color: "var(--accent-orange)" }} /> Launch Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

