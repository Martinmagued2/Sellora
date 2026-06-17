"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search, ShoppingBag, MessageCircle, Star, Phone, Instagram,
  Facebook, ChevronRight, ArrowLeft, Package, Check,
} from "lucide-react";

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
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const openProduct = (productId) => {
    router.push(`/store/${slug}?product=${productId}`);
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

  const filtered = (products || []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.name || "").toLowerCase().includes(q) ||
           (p.description || "").toLowerCase().includes(q) ||
           (p.category || "").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Loading store…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <Package size={48} color="rgba(255,255,255,0.3)" style={{ margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Store not found</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  // Product detail view
  if (selectedProduct) {
    const p = selectedProduct.product;
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>
          <button
            onClick={() => { setSelectedProduct(null); router.push(`/store/${slug}`); }}
            style={{
              background: "transparent", border: "none", color: "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 14,
            }}
          >
            <ArrowLeft size={16} /> Back to {store.name}
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              {p.images && p.images[0] ? (
                <img src={p.images[0]} alt={p.name} style={{ width: "100%", borderRadius: 12, aspectRatio: 1, objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: "100%", aspectRatio: 1, borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Package size={48} color="rgba(255,255,255,0.2)" />
                </div>
              )}
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px 0" }}>{p.name}</h1>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-primary)", marginBottom: 12 }}>
                {p.price} {p.currency || store.currency}
              </div>
              {selectedProduct.avgRating && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} size={14} fill={i <= Math.round(selectedProduct.avgRating) ? "#f5b400" : "none"} color="#f5b400" />
                  ))}
                  <span>{selectedProduct.avgRating} ({selectedProduct.reviewCount})</span>
                </div>
              )}
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                {p.description || "No description available."}
              </p>
              <a
                href={buildWhatsAppLink(p)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 20px", borderRadius: 10,
                  background: "#25D366", color: "#000",
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                }}
              >
                <MessageCircle size={16} /> Order on WhatsApp
              </a>
            </div>
          </div>

          {/* Reviews */}
          {selectedProduct.reviews && selectedProduct.reviews.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Customer Reviews</h2>
              {selectedProduct.reviews.map((r) => (
                <div key={r.id} style={{
                  padding: 14, marginBottom: 10, borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} size={12} fill={i <= r.rating ? "#f5b400" : "none"} color="#f5b400" />
                    ))}
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginLeft: 6 }}>
                      by {r.customers?.name || "Anonymous"} · {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.title && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.title}</div>}
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>{r.body}</p>
                  {r.reply && (
                    <div style={{ marginTop: 10, padding: 10, background: "rgba(88,101,242,0.06)", borderRadius: 8, fontSize: 13 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--accent-primary-light)" }}>Store reply:</div>
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>{r.reply}</p>
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
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff" }}>
      {/* Banner */}
      {store.bannerUrl && (
        <div style={{
          width: "100%", height: 200, maxHeight: "30vh",
          backgroundImage: `url(${store.bannerUrl})`,
          backgroundSize: "cover", backgroundPosition: "center",
        }} />
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          {store.logoUrl ? (
            <img src={store.logoUrl} alt={store.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover" }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: "rgba(88,101,242,0.15)", color: "var(--accent-primary)",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24,
            }}>
              {(store.name || "S")[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{store.name}</h1>
            {store.description && (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: "4px 0 0 0" }}>{store.description}</p>
            )}
          </div>
        </div>

        {/* Social */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {store.whatsappNumber && (
            <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(37,211,102,0.1)", color: "#25D366", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {store.instagramHandle && (
            <a href={`https://instagram.com/${store.instagramHandle}`} target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(225,48,108,0.1)", color: "#e1306c", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <Instagram size={14} /> @{store.instagramHandle}
            </a>
          )}
          {store.facebookPage && (
            <a href={`https://facebook.com/${store.facebookPage}`} target="_blank" rel="noopener noreferrer"
              style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(24,119,242,0.1)", color: "#1877f2", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <Facebook size={14} /> Facebook
            </a>
          )}
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <Search size={16} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "12px 12px 12px 38px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, color: "#fff", fontSize: 14, outline: "none",
            }}
          />
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.5)" }}>
            <Package size={48} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p>{search ? "No products match your search." : "No products yet."}</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 14,
          }}>
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => openProduct(p.id)}
                style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {p.images && p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} style={{ width: "100%", aspectRatio: 1, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />
                ) : (
                  <div style={{
                    width: "100%", aspectRatio: 1, borderRadius: 8, marginBottom: 10,
                    background: "rgba(255,255,255,0.04)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Package size={28} color="rgba(255,255,255,0.2)" />
                  </div>
                )}
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "#fff" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                  {p.category || "General"}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent-primary)" }}>
                    {p.price} {p.currency || store.currency}
                  </div>
                  <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
                </div>
                {p.stock > 0 ? (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(59,165,92,0.7)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={10} /> In stock
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(237,66,69,0.7)" }}>Out of stock</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
          <p>Powered by Sellora · Conversational commerce for MENA</p>
        </div>
      </div>
    </div>
  );
}
