"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, Eye, Tag as TagIcon } from "lucide-react";

export default function BlogPostPage() {
  const params = useParams();
  const slug = params?.slug;

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    // Fetch blog post + SEO metadata
    Promise.all([
      fetch(`/api/blog/${slug}`).then(r => r.ok ? r.json() : Promise.reject(new Error("Not found"))),
      fetch(`/api/seo/blog?slug=${slug}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([postData, seoData]) => {
        setPost(postData.post);
        if (seoData) {
          document.title = seoData.title;
          setMeta("description", seoData.description);
          setOg("og:title", seoData.title);
          setOg("og:description", seoData.description);
          setOg("og:type", seoData.type);
          if (seoData.image) setOg("og:image", seoData.image);
          setMeta("twitter:card", "summary_large_image");
          setMeta("twitter:title", seoData.title);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#5865F2", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 48, fontWeight: 800, color: "rgba(255,255,255,0.1)" }}>404</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Article not found</p>
          <a href="/blog" style={{ color: "#7E88F5", textDecoration: "none", fontSize: 14 }}>← Back to Blog</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Cover image */}
      {post.cover_image && (
        <div style={{
          width: "100%", maxHeight: 400, overflow: "hidden",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <img src={post.cover_image} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        {/* Back link */}
        <a href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 14, marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back to Blog
        </a>

        {/* Meta */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {post.category && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: "rgba(88,101,242,0.15)", color: "#7E88F5", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {post.category}
            </span>
          )}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={12} /> {post.published_at ? new Date(post.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 4 }}>
            <Eye size={12} /> {(post.views || 0) + 1} views
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
          {post.title}
        </h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 32, fontStyle: "italic" }}>
            {post.excerpt}
          </p>
        )}

        {/* Author */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #5865F2, #00D2FF)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
            {(post.author || "S")[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>By {post.author || "Sellora Team"}</span>
        </div>

        {/* Content */}
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
          {post.content}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div style={{ marginTop: 40, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {post.tags.map((tag, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                <TagIcon size={11} /> {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 48, padding: 32, background: "linear-gradient(135deg, rgba(88,101,242,0.08), rgba(0,210,255,0.04))", border: "1px solid rgba(88,101,242,0.15)", borderRadius: 20, textAlign: "center" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ready to automate your sales?</h3>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 20 }}>Start your free 14-day trial. No credit card required.</p>
          <a href="/signup" style={{ display: "inline-block", padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #5865F2, #00D2FF)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
            Get Started Free
          </a>
        </div>
      </div>
    </div>
  );
}

// SEO helpers
function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function setOg(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
