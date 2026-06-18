"use client";

import { useState, useEffect } from "react";
import { Link } from "next/navigation";
import { Calendar, ArrowRight, Search } from "lucide-react";

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // SEO
    document.title = "Sellora Blog — Guides for MENA Sellers";
    fetch("/api/blog?limit=50")
      .then(r => r.json())
      .then(d => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.title || "").toLowerCase().includes(q) || (p.excerpt || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/logo.png" alt="Sellora" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>Sellora Blog</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 8 }}>Guides, tips, and stories for MENA sellers</p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          <Search size={18} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "14px 16px 14px 44px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, outline: "none" }}
          />
        </div>

        {/* Posts */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No articles yet</p>
            <p style={{ fontSize: 13 }}>Check back soon — we're writing guides for MENA sellers.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {filtered.map(post => (
              <a
                key={post.id}
                href={`/blog/${post.slug}`}
                style={{
                  display: "flex", gap: 20, padding: 20,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16, textDecoration: "none", color: "#fff",
                  transition: "all 0.2s ease", cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Cover image */}
                {post.cover_image && (
                  <div style={{ width: 120, height: 120, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                    <img src={post.cover_image} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 8, background: "rgba(88,101,242,0.15)", color: "#7E88F5", fontWeight: 600 }}>{post.category}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={11} /> {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0", lineHeight: 1.3 }}>{post.title}</h2>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
                    {post.excerpt || (post.content || "").substring(0, 120) + "..."}
                  </p>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#7E88F5", fontWeight: 600 }}>
                    Read more <ArrowRight size={13} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
          <a href="/" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>← Back to Sellora</a>
        </div>
      </div>
    </div>
  );
}
