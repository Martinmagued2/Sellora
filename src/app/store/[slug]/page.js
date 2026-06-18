"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search, MessageCircle, Star,
  ChevronRight, ArrowLeft, Package, Check, Share2, Truck, Shield,
} from "lucide-react";

// Brand icons (Instagram, Facebook) were removed from lucide-react in v1+.
// Inline SVGs preserve the brand identity without dependency risk.
function InstagramIcon({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

// Sellora logo — uses /public/logo.png (the actual brand asset)
function SelloraMark({ size = 40, withGlow = true }) {
  return (
    <img
      src="/logo.png"
      alt="Sellora"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        objectFit: "cover",
        boxShadow: withGlow ? "0 8px 24px -8px rgba(88, 101, 242, 0.5)" : "none",
        flexShrink: 0,
        display: "block",
      }}
    />
  );
}

export default function StorefrontPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [shareStatus, setShareStatus] = useState(null); // null | "sharing" | "copied" | "error"

  // Dynamic SEO meta tags + JSON-LD structured data
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/seo/store?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        document.title = data.title;
        setMetaTag("description", data.description);
        setMetaProp("og:title", data.title);
        setMetaProp("og:description", data.description);
        setMetaProp("og:url", data.url);
        setMetaProp("og:type", data.type);
        setMetaProp("og:site_name", data.siteName);
        if (data.image) setMetaProp("og:image", data.image);
        setMetaProp("twitter:card", "summary_large_image");
        setMetaProp("twitter:title", data.title);
        setMetaProp("twitter:description", data.description);

        // JSON-LD structured data for Google rich results
        const existing = document.getElementById("store-jsonld");
        if (existing) existing.remove();
        const script = document.createElement("script");
        script.id = "store-jsonld";
        script.type = "application/ld+json";
        script.textContent = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Store",
          name: data.title.split(" —")[0],
          description: data.description,
          url: data.url,
          image: data.image || undefined,
        });
        document.head.appendChild(script);
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/store?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setStore(data.store);
          setProducts(data.products || []);
          // Extract unique categories
          const cats = [...new Set((data.products || []).map((p) => p.category).filter(Boolean))];
          setCategories(cats);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const openProduct = (productId) => {
    router.push(`/store/${slug}?product=${productId}`, undefined, { shallow: true });
    fetch(`/api/store?slug=${encodeURIComponent(slug)}&productId=${productId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSelectedProduct(data);
      });
  };

  const buildWhatsAppLink = (product) => {
    const msg = product
      ? `Hi! I'm interested in ${product.name} (${product.price} ${store?.currency || "EGP"}). Is it available?`
      : `Hi! I have a question about your store.`;
    return `https://wa.me/${(store?.whatsappNumber || "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`;
  };

  // ─── Share handler — uses Web Share API on mobile, falls back to clipboard ───
  const handleShare = async () => {
    if (!selectedProduct) return;
    const p = selectedProduct.product;
    const shareUrl = window.location.href;
    const shareTitle = `${p.name} — ${store?.name || "Store"}`;
    const shareText = `Check out ${p.name} (${p.price} ${p.currency || store?.currency || "EGP"}) at ${store?.name || "this store"}:`;

    setShareStatus("sharing");

    // Try native Web Share API first (works on most mobile browsers + desktop Safari)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        setShareStatus(null); // User closed the share sheet — no need for confirmation
        return;
      } catch (err) {
        // User cancelled (AbortError) — silently exit
        if (err.name === "AbortError") {
          setShareStatus(null);
          return;
        }
        // Other errors fall through to clipboard fallback
        console.warn("Web Share failed, falling back to clipboard:", err.message);
      }
    }

    // Clipboard fallback
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Legacy fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setShareStatus("copied");
      setTimeout(() => setShareStatus(null), 2500);
    } catch (err) {
      console.error("Share failed:", err);
      setShareStatus("error");
      setTimeout(() => setShareStatus(null), 2500);
    }
  };

  const filtered = (products || []).filter((p) => {
    let matchesSearch = true;
    let matchesCategory = true;
    if (search) {
      const q = search.toLowerCase();
      matchesSearch = (p.name || "").toLowerCase().includes(q) ||
                     (p.description || "").toLowerCase().includes(q) ||
                     (p.category || "").toLowerCase().includes(q);
    }
    if (activeCategory !== "all" && p.category !== activeCategory) {
      matchesCategory = false;
    }
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>
          <SelloraMark size={56} />
          <div style={{ marginTop: 20, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Loading store…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={errorContainerStyle}>
          <SelloraMark size={64} />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "20px 0 8px 0" }}>
            {error === "Store not found" ? "Store not found" : "Couldn't load store"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 24 }}>{error}</p>
          <a href="/" style={primaryBtnStyle}>
            <ArrowLeft size={14} /> Back to Sellora
          </a>
        </div>
      </div>
    );
  }

  // Product detail view
  if (selectedProduct) {
    const p = selectedProduct.product;
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <button
            onClick={() => { setSelectedProduct(null); router.push(`/store/${slug}`); }}
            style={backBtnStyle}
          >
            <ArrowLeft size={16} /> Back to {store.name}
          </button>

          <div style={productDetailGridStyle} className="sellora-store-detail-grid">
            {/* Product image gallery */}
            <div>
              <ProductGallery images={p.image_urls || []} name={p.name} noImageStyle={noImageStyle} productImageLargeStyle={productImageLargeStyle} thumbStyle={thumbStyle} />
            </div>

            {/* Product info */}
            <div>
              {p.category && (
                <div style={{ fontSize: 11, color: "var(--accent-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                  {p.category}
                </div>
              )}
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px 0", lineHeight: 1.2 }}>{p.name}</h1>

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg, #7E88F5 0%, #00D2FF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  {p.price} {p.currency || store.currency}
                </div>
                {selectedProduct.avgRating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "rgba(245,180,0,0.1)", border: "1px solid rgba(245,180,0,0.2)" }}>
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} size={13} fill={i <= Math.round(selectedProduct.avgRating) ? "#f5b400" : "none"} color="#f5b400" />
                    ))}
                    <span style={{ color: "#f5b400", fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
                      {selectedProduct.avgRating} ({selectedProduct.reviewCount})
                    </span>
                  </div>
                )}
              </div>

              {p.description && (
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                  {p.description}
                </p>
              )}

              {/* Trust badges */}
              <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div style={trustBadgeStyle}>
                  <Check size={14} color="#3BA55C" /> In Stock
                </div>
                <div style={trustBadgeStyle}>
                  <Truck size={14} color="#5865F2" /> Fast Delivery
                </div>
                <div style={trustBadgeStyle}>
                  <Shield size={14} color="#00D2FF" /> Secure Order
                </div>
              </div>

              {/* Variants */}
              {p.variants && p.variants.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Available Options</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {p.variants.slice(0, 6).map((v, i) => (
                      <div key={i} style={variantPillStyle}>
                        {v.label || v.name} {v.price ? `· ${v.price} ${p.currency || store.currency}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <a href={buildWhatsAppLink(p)} target="_blank" rel="noopener noreferrer" style={waBtnStyle}>
                  <MessageCircle size={16} /> Order on WhatsApp
                </a>
                <button
                  onClick={handleShare}
                  disabled={shareStatus === "sharing"}
                  style={{
                    ...secondaryBtnStyle,
                    opacity: shareStatus === "sharing" ? 0.6 : 1,
                    ...(shareStatus === "copied" ? { background: "rgba(59,165,92,0.15)", color: "#3BA55C", borderColor: "rgba(59,165,92,0.3)" } : {}),
                    ...(shareStatus === "error" ? { background: "rgba(237,66,69,0.15)", color: "#ED4245", borderColor: "rgba(237,66,69,0.3)" } : {}),
                  }}
                >
                  {shareStatus === "sharing" ? (
                    <><Share2 size={14} /> Sharing…</>
                  ) : shareStatus === "copied" ? (
                    <><Check size={14} /> Link copied!</>
                  ) : shareStatus === "error" ? (
                    <><Share2 size={14} /> Try again</>
                  ) : (
                    <><Share2 size={14} /> Share</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Reviews */}
          {selectedProduct.reviews && selectedProduct.reviews.length > 0 && (
            <div style={{ marginTop: 56 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Customer Reviews</h2>
              {selectedProduct.reviews.map((r) => (
                <div key={r.id} style={reviewCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={avatarStyle}>
                        {(r.customers?.name || "A").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.customers?.name || "Anonymous"}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          {[1,2,3,4,5].map((i) => (
                            <Star key={i} size={11} fill={i <= r.rating ? "#f5b400" : "none"} color="#f5b400" />
                          ))}
                          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginLeft: 6 }}>
                            · {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {r.title && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{r.title}</div>}
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{r.body}</p>
                  {r.reply && (
                    <div style={{ marginTop: 12, padding: 12, background: "linear-gradient(135deg, rgba(88,101,242,0.08), rgba(0,210,255,0.04))", border: "1px solid rgba(88,101,242,0.2)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <SelloraMark size={20} />
                        <span style={{ fontWeight: 600, fontSize: 12, color: "#7E88F5" }}>Store reply</span>
                      </div>
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{r.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Storefront list view
  return (
    <div style={pageStyle}>
      {/* Hero banner with gradient backdrop */}
      <div style={heroBannerStyle}>
        {/* Decorative gradient blobs */}
        <div style={{ ...blobStyle, top: "-50px", left: "10%", background: "radial-gradient(circle, rgba(88,101,242,0.3), transparent 70%)" }} />
        <div style={{ ...blobStyle, top: "20px", right: "5%", background: "radial-gradient(circle, rgba(0,210,255,0.2), transparent 70%)" }} />

        <div style={{ ...containerStyle, position: "relative", zIndex: 1 }}>
          {/* Top bar with Sellora branding */}
          <div style={topBarStyle}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <SelloraMark size={32} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>Sellora</span>
            </a>
            <div style={{ display: "flex", gap: 8 }}>
              {store.whatsappNumber && (
                <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer" style={socialBtnStyle("#25D366")}>
                  <MessageCircle size={14} /> Chat
                </a>
              )}
              {store.instagramHandle && (
                <a href={`https://instagram.com/${store.instagramHandle}`} target="_blank" rel="noopener noreferrer" style={socialBtnStyle("#e1306c")}>
                  <InstagramIcon size={14} />
                </a>
              )}
              {store.facebookPage && (
                <a href={`https://facebook.com/${store.facebookPage}`} target="_blank" rel="noopener noreferrer" style={socialBtnStyle("#1877f2")}>
                  <FacebookIcon size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Store identity */}
          <div style={storeHeaderStyle} className="sellora-store-header">
            <div style={storeLogoStyle} className="sellora-store-logo">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={store.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  background: "linear-gradient(135deg, rgba(88,101,242,0.2), rgba(0,210,255,0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 36, fontWeight: 800, color: "#7E88F5",
                }}>
                  {(store.name || "S")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -0.5 }} className="sellora-store-name">{store.name}</h1>
              {store.description && (
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: "8px 0 0 0", maxWidth: 600, lineHeight: 1.5 }}>
                  {store.description}
                </p>
              )}
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  <Check size={12} color="#3BA55C" /> Verified Seller
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  <Truck size={12} color="#5865F2" /> Fast Delivery
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  <Shield size={12} color="#00D2FF" /> Secure Checkout
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={containerStyle} className="sellora-store-container">
        {/* Search + category pills */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search size={16} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={searchInputStyle}
            />
          </div>
          {categories.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => setActiveCategory("all")}
                style={activeCategory === "all" ? categoryPillActiveStyle : categoryPillStyle}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={activeCategory === cat ? categoryPillActiveStyle : categoryPillStyle}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Products section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </h2>
          <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#7E88F5", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <MessageCircle size={14} /> Ask about anything
          </a>
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div style={emptyStateStyle}>
            <Package size={56} color="rgba(255,255,255,0.15)" />
            <p style={{ fontSize: 16, fontWeight: 600, margin: "16px 0 4px 0" }}>
              {search || activeCategory !== "all" ? "No matching products" : "No products yet"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              {search || activeCategory !== "all" ? "Try a different search or category." : "Check back soon — new products are on the way!"}
            </p>
          </div>
        ) : (
          <div style={productsGridStyle} className="sellora-store-products">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => openProduct(p.id)}
                style={productCardStyle}
              >
                <div style={productCardImageStyle}>
                  {p.image_urls && p.image_urls[0] ? (
                    <img src={p.image_urls[0]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      background: "linear-gradient(135deg, rgba(88,101,242,0.06), rgba(0,210,255,0.03))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Package size={32} color="rgba(255,255,255,0.15)" />
                    </div>
                  )}
                  {p.stock <= 5 && p.stock > 0 && (
                    <div style={stockBadgeStyle("low")}>Only {p.stock} left</div>
                  )}
                  {p.stock === 0 && (
                    <div style={stockBadgeStyle("out")}>Sold out</div>
                  )}
                </div>
                <div style={productCardBodyStyle}>
                  {p.category && (
                    <div style={{ fontSize: 10, color: "#00D2FF", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                      {p.category}
                    </div>
                  )}
                  <div style={productNameStyle}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <div style={productPriceStyle}>
                      {p.price} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{p.currency || store.currency}</span>
                    </div>
                    <div style={waMiniBtnStyle}>
                      <MessageCircle size={12} />
                    </div>
                  </div>
                  {p.stock > 0 ? (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#3BA55C", display: "flex", alignItems: "center", gap: 4 }}>
                      <Check size={10} /> In stock
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#ED4245" }}>Out of stock</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <SelloraMark size={28} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Powered by Sellora</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>
            Conversational commerce for MENA · <a href="/" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Create your own store</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  STYLES — Sellora theme
// ═══════════════════════════════════════════════════════════

const pageStyle = {
  minHeight: "100vh",
  background: "#0a0b0f",
  color: "#fff",
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
};

const containerStyle = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "0 20px",
};

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const errorContainerStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 20,
};

const primaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 20px",
  borderRadius: 10,
  background: "linear-gradient(135deg, #5865F2 0%, #00D2FF 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  boxShadow: "0 8px 24px -8px rgba(88, 101, 242, 0.5)",
};

const heroBannerStyle = {
  position: "relative",
  paddingTop: 16,
  paddingBottom: 40,
  background: "linear-gradient(180deg, rgba(88,101,242,0.08) 0%, transparent 100%)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const blobStyle = {
  position: "absolute",
  width: 400, height: 400,
  borderRadius: "50%",
  filter: "blur(80px)",
  pointerEvents: "none",
};

const topBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: 12,
  paddingBottom: 32,
};

const socialBtnStyle = (color) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 10,
  background: `${color}1A`, // 10% opacity
  color,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  border: `1px solid ${color}33`,
  transition: "all 0.15s ease",
});

const storeHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 20,
  paddingTop: 16,
};

const storeLogoStyle = {
  width: 88, height: 88, borderRadius: 22,
  overflow: "hidden",
  flexShrink: 0,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 16px 40px -12px rgba(0,0,0,0.4)",
};

const searchInputStyle = {
  width: "100%",
  padding: "12px 14px 12px 40px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 14,
  outline: "none",
  transition: "all 0.15s ease",
};

const categoryPillStyle = {
  padding: "6px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(255,255,255,0.06)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const categoryPillActiveStyle = {
  ...categoryPillStyle,
  background: "linear-gradient(135deg, #5865F2 0%, #00D2FF 100%)",
  color: "#fff",
  border: "none",
};

const productsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 16,
  paddingBottom: 40,
};

const productCardStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16,
  overflow: "hidden",
  cursor: "pointer",
  textAlign: "left",
  padding: 0,
  transition: "all 0.2s ease",
};

const productCardImageStyle = {
  width: "100%",
  aspectRatio: 1,
  background: "rgba(255,255,255,0.02)",
  position: "relative",
  overflow: "hidden",
};

const stockBadgeStyle = (type) => ({
  position: "absolute",
  top: 10, left: 10,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  background: type === "out" ? "rgba(237,66,69,0.95)" : "rgba(248,165,50,0.95)",
  color: "#fff",
  backdropFilter: "blur(8px)",
});

const productCardBodyStyle = {
  padding: 14,
};

const productNameStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const productPriceStyle = {
  fontSize: 18,
  fontWeight: 800,
  background: "linear-gradient(135deg, #7E88F5 0%, #00D2FF 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const waMiniBtnStyle = {
  width: 28, height: 28,
  borderRadius: 8,
  background: "rgba(37,211,102,0.15)",
  color: "#25D366",
  border: "1px solid rgba(37,211,102,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emptyStateStyle = {
  textAlign: "center",
  padding: "80px 20px",
  color: "rgba(255,255,255,0.5)",
};

const footerStyle = {
  marginTop: 60,
  paddingTop: 28,
  paddingBottom: 32,
  borderTop: "1px solid rgba(255,255,255,0.06)",
  textAlign: "center",
};

// Product detail styles
const backBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.7)",
  cursor: "pointer",
  fontSize: 14,
  marginBottom: 24,
  padding: 0,
};

const productDetailGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 40,
  paddingBottom: 40,
};

const productImageLargeStyle = {
  width: "100%",
  aspectRatio: 1,
  borderRadius: 20,
  overflow: "hidden",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 24px 60px -20px rgba(0,0,0,0.5)",
};

const noImageStyle = {
  width: "100%", height: "100%",
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "linear-gradient(135deg, rgba(88,101,242,0.05), rgba(0,210,255,0.02))",
};

const thumbStyle = {
  width: 72, height: 72, borderRadius: 10, overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  cursor: "pointer",
};

const trustBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  fontSize: 12,
  fontWeight: 500,
  color: "rgba(255,255,255,0.8)",
};

const variantPillStyle = {
  padding: "8px 14px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.8)",
  fontSize: 12,
  fontWeight: 500,
};

const waBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 24px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  boxShadow: "0 12px 32px -8px rgba(37,211,102,0.5)",
};

const secondaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "14px 20px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.8)",
  fontWeight: 600,
  fontSize: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  cursor: "pointer",
};

const reviewCardStyle = {
  padding: 18,
  marginBottom: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const avatarStyle = {
  width: 36, height: 36,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #5865F2, #00D2FF)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: 700, fontSize: 14, color: "#fff",
  flexShrink: 0,
};

// Responsive — basic media query via CSS-in-JS (Next.js will inline this)
// For mobile, the product detail grid collapses to 1 column.
// We add a <style> tag with media queries for this.

// Responsive override: inject a global style for small screens.
// We use a <style> tag injected once when the module loads.
if (typeof window !== "undefined" && !window.__selloraStoreStyleInjected) {
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 768px) {
      .sellora-store-detail-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
      .sellora-store-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
      .sellora-store-logo { width: 64px !important; height: 64px !important; border-radius: 16px !important; }
      .sellora-store-name { font-size: 24px !important; }
      .sellora-store-products { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important; gap: 10px !important; }
    }
    @media (max-width: 480px) {
      .sellora-store-products { grid-template-columns: repeat(2, 1fr) !important; }
      .sellora-store-container { padding: 0 14px !important; }
    }
  `;
  document.head.appendChild(style);
  window.__selloraStoreStyleInjected = true;
}

// SEO helper functions
function setMetaTag(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

function setMetaProp(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

// ─── Product Image Gallery — swipeable on mobile, click-to-change on desktop ───
function ProductGallery({ images, name, noImageStyle, productImageLargeStyle, thumbStyle }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [touchStart, setTouchStart] = useState(null);

  if (!images || images.length === 0) {
    return (
      <div style={productImageLargeStyle}>
        <div style={noImageStyle}>
          <Package size={56} color="rgba(255,255,255,0.15)" />
        </div>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div style={productImageLargeStyle}>
        <img src={images[0]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left → next
        setActiveIdx(prev => Math.min(prev + 1, images.length - 1));
      } else {
        // Swipe right → prev
        setActiveIdx(prev => Math.max(prev - 1, 0));
      }
    }
    setTouchStart(null);
  };

  return (
    <div>
      {/* Main image with swipe support */}
      <div
        style={productImageLargeStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={images[activeIdx]}
          alt={`${name} ${activeIdx + 1}`}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.2s ease" }}
        />
        {/* Image counter */}
        <div style={{
          position: "absolute", bottom: 10, right: 10,
          padding: "3px 10px", borderRadius: 12,
          background: "rgba(0,0,0,0.6)", color: "#fff",
          fontSize: 11, fontWeight: 600, backdropFilter: "blur(4px)",
        }}>
          {activeIdx + 1} / {images.length}
        </div>
        {/* Nav arrows (desktop) */}
        {activeIdx > 0 && (
          <button
            onClick={() => setActiveIdx(prev => prev - 1)}
            style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", backdropFilter: "blur(4px)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        {activeIdx < images.length - 1 && (
          <button
            onClick={() => setActiveIdx(prev => prev + 1)}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", backdropFilter: "blur(4px)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
        {/* Dots indicator */}
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 4,
        }}>
          {images.map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: i === activeIdx ? "#fff" : "rgba(255,255,255,0.3)",
              transition: "background 0.2s ease",
            }} />
          ))}
        </div>
      </div>

      {/* Thumbnails */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto" }}>
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            style={{
              ...thumbStyle,
              border: i === activeIdx ? "2px solid #5865F2" : thumbStyle.border,
              opacity: i === activeIdx ? 1 : 0.5,
              cursor: "pointer", transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <img src={url} alt={`${name} ${i+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </div>
  );
}
