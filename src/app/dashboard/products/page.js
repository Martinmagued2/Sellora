"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  TrendingUp,
  Layers,
  Minus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";
import { useCurrentStore } from "@/lib/store-context";
import { useToast } from "../components/ToastProvider";
import { useConfirm } from "../components/ConfirmProvider";

export default function ProductsPage() {
  const router = useRouter();
  const toast = useToast();
  
  const { confirmAction } = useConfirm();const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [accountPlan, setAccountPlan] = useState("starter");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [aiStyle, setAiStyle] = useState("studio");
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [aiDescEnglish, setAiDescEnglish] = useState("");
  const [aiDescArabic, setAiDescArabic] = useState("");
  const [aiPriceSuggestion, setAiPriceSuggestion] = useState("");
  const [topRecommended, setTopRecommended] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // Variants state
  const [variants, setVariants] = useState([]);

  // View product details modal
  const [viewProduct, setViewProduct] = useState(null);

  const fileInputRef = useRef(null);

  const { currentStoreId } = useCurrentStore();

  const supabase = createClient();
  const planLimits = getPlanLimits(accountPlan);
  const limitReached = planLimits.products !== -1 && products.length >= planLimits.products;

  // Ensure storage buckets exist
  const ensureBuckets = useCallback(async () => {
    try {
      await fetch("/api/storage/ensure-buckets", { method: "POST" });
    } catch (e) {
      console.warn("[Products] Bucket ensure failed:", e.message);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: account } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
      if (account?.plan) setAccountPlan(account.plan);
    }

    let query = supabase.from("products").select("*").order("created_at", { ascending: false });

    if (filter === "active") query = query.eq("status", "active");
    if (filter === "draft") query = query.eq("status", "draft");
    if (filter === "low") query = query.lte("stock", 5).gt("stock", 0);
    if (search) query = query.ilike("name", `%${search}%`);
    if (currentStoreId) query = query.eq("store_id", currentStoreId);

    const { data, error } = await query;
    if (!error) setProducts(data || []);
    setLoading(false);
  }, [filter, search, currentStoreId]);

  useEffect(() => { ensureBuckets(); fetchProducts(); }, [ensureBuckets, fetchProducts]);

  // Fetch top recommended products
  const fetchTopRecommended = useCallback(async () => {
    setRecLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orders } = await supabase
        .from("orders")
        .select("items")
        .eq("account_id", user.id)
        .limit(500);

      if (!orders || orders.length === 0) { setTopRecommended([]); setRecLoading(false); return; }

      const productCounts = {};
      for (const order of orders) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            if (item.product_id) {
              productCounts[item.product_id] = (productCounts[item.product_id] || 0) + 1;
            }
          }
        }
      }

      const topIds = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, count }));

      if (topIds.length === 0) { setTopRecommended([]); setRecLoading(false); return; }

      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, category, image_urls, stock")
        .in("id", topIds.map(t => t.id));

      const merged = topIds.map(t => {
        const prod = prods?.find(p => p.id === t.id);
        return prod ? { ...prod, rec_count: t.count } : null;
      }).filter(Boolean);

      setTopRecommended(merged);
    } catch (err) {
      console.error("Failed to fetch top recommended:", err);
    }
    setRecLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTopRecommended(); }, [fetchTopRecommended]);

  // ─── Variant helpers ───
  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { name: "", sku: "", price_offset: 0, stock: 0, image_url: "" },
    ]);
  };

  const removeVariant = (index) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index, field, value) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // ─── File handling ───
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.warning("Please select an image file (jpg, png, webp)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Image must be smaller than 5MB");
      return;
    }
    setImageFile(file);
    setGeneratedImageUrl(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleGenerateImage = async () => {
    const form = document.querySelector('.modal form');
    const productName = form?.elements?.name?.value;
    const description = form?.elements?.description?.value;

    if (!productName?.trim()) {
      toast.warning("Please enter a product name first, then generate an image.");
      return;
    }

    setGeneratingImage(true);
    try {
      const res = await fetch("/api/products/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: productName.trim(),
          description: description?.trim() || "",
          style: aiStyle,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Image generation failed. Please try again.");
        return;
      }

      const dataUrl = `data:image/png;base64,${data.image_base64}`;
      setImagePreview(dataUrl);
      setImageFile(null);
      setGeneratedImageUrl(data.image_url);
    } catch (err) {
      console.error("Image generation error:", err);
      toast.error("Image generation failed. Please try again.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.target);
    const { data: { user } } = await supabase.auth.getUser();

    let imageUrl = null;

    if (generatedImageUrl) {
      imageUrl = generatedImageUrl;
    } else if (imageFile) {
      try {
        await fetch("/api/storage/ensure-buckets", { method: "POST" });
      } catch (e) {}

      const ext = imageFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      let uploadError;
      let uploadData;

      const clientResult = await supabase.storage
        .from("product-images")
        .upload(fileName, imageFile, { cacheControl: "3600", upsert: false });
      uploadError = clientResult.error;
      uploadData = clientResult.data;

      if (uploadError) {
        console.warn("[Products] Client upload failed, trying admin:", uploadError.message);
        try {
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("path", fileName);
          const adminRes = await fetch("/api/storage/upload", {
            method: "POST",
            body: formData,
          });
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            if (adminData.url) {
              imageUrl = adminData.url;
              uploadError = null;
            }
          }
        } catch (adminErr) {
          console.error("[Products] Admin upload also failed:", adminErr.message);
        }
      }

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      } else if (uploadError && !imageUrl) {
        toast.error("Image upload failed: " + (uploadError.message || "Unknown error."));
      }
    }

    // Build variants array: clean up empty entries
    const cleanVariants = variants
      .filter((v) => v.name.trim() !== "")
      .map((v) => ({
        name: v.name.trim(),
        sku: v.sku.trim() || null,
        price_offset: Number(v.price_offset) || 0,
        stock: Number(v.stock) || 0,
        image_url: v.image_url.trim() || null,
      }));

    const payload = {
      account_id: user.id,
      name: fd.get("name"),
      description: fd.get("description"),
      price: parseFloat(fd.get("price")),
      category: fd.get("category"),
      stock: parseInt(fd.get("stock")),
      status: fd.get("status") || "active",
      variants: cleanVariants,
    };

    if (imageUrl) {
      payload.image_urls = [imageUrl];
    } else if (editingProduct && !imagePreview) {
      payload.image_urls = [];
    }

    let error;
    if (editingProduct) {
      const { error: updateError } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      error = updateError;
    } else {
      if (!imageUrl && !editingProduct) {
        payload.image_urls = [];
      }
      const { error: insertError } = await supabase.from("products").insert(payload);
      error = insertError;
    }

    if (!error) {
      closeModal();
      fetchProducts();
    }
    setSaving(false);
  };

  const handleEdit = async (product) => {
    setEditingProduct(product);
    setImagePreview(product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : null);
    // Load existing variants
    const existingVariants = Array.isArray(product.variants) ? product.variants : [];
    setVariants(
      existingVariants.map((v) => ({
        name: v.name || "",
        sku: v.sku || "",
        price_offset: v.price_offset ?? 0,
        stock: v.stock ?? 0,
        image_url: v.image_url || "",
      }))
    );
    setShowModal(true);
  };

  const handleDelete = async (id, imageUrls) => {
    if (!(await confirmAction("Delete this product?"))) return;

    if (imageUrls && imageUrls.length > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const pathsToRemove = imageUrls.map(url => {
            const parts = url.split("product-images/");
            return parts.length > 1 ? parts[1] : null;
          }).filter(Boolean);

          if (pathsToRemove.length > 0) {
            await supabase.storage.from("product-images").remove(pathsToRemove);
          }
        }
      } catch (err) {
        console.error("Failed to delete product images from storage:", err);
      }
    }

    await supabase.from("products").delete().eq("id", id);
    fetchProducts();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview(null);
    setGeneratingImage(false);
    setAiStyle("studio");
    setGeneratedImageUrl(null);
    setGeneratingDesc(false);
    setAiDescEnglish("");
    setAiDescArabic("");
    setAiPriceSuggestion("");
    setVariants([]);
  };

  const handleGenerateDescription = async () => {
    const form = document.querySelector('.modal form');
    const productName = form?.elements?.name?.value;
    const category = form?.elements?.category?.value;

    if (!productName?.trim()) {
      toast.warning("Please enter a product name first, then generate a description.");
      return;
    }

    setGeneratingDesc(true);
    try {
      const res = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: productName.trim(),
          features: productName.trim(),
          category: category || "General",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Description generation failed.");
        return;
      }

      if (data.english) {
        setAiDescEnglish(data.english);
        const descField = form?.elements?.description;
        if (descField) descField.value = data.english;
      }
      if (data.arabic) setAiDescArabic(data.arabic);
      if (data.price_suggestion) setAiPriceSuggestion(data.price_suggestion);
    } catch (err) {
      console.error("Description generation error:", err);
      toast.error("Description generation failed. Please try again.");
    } finally {
      setGeneratingDesc(false);
    }
  };

  const emojis = { Bags: "👜", Jewelry: "💎", Accessories: "🧣", Electronics: "📱", Watches: "⌚", Clothing: "👗" };

  return (
    <>
      <div className="page-header">
        <h1>Products</h1>
        <div className="page-header-actions">
          {limitReached ? (
            <button className="btn btn-primary" onClick={() => router.push('/dashboard/billing')} id="add-product" style={{ opacity: 0.7 }}>
               Upgrade to Add More
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => { setVariants([]); setShowModal(true); }} id="add-product">
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {[
            { key: "all", label: "All Products" },
            { key: "active", label: "Active" },
            { key: "draft", label: "Draft" },
            { key: "low", label: "Low Stock" },
          ].map((f) => (
            <button key={f.key} className={`filter-tab ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="filter-search">
          <Search size={14} />
          <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>Loading products...</div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              <div className="product-card-image">
                {product.image_urls && product.image_urls.length > 0 ? (
                  <img
                    src={product.image_urls[0]}
                    alt={product.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius-md) var(--radius-md) 0 0" }}
                  />
                ) : (
                  <span style={{ fontSize: 40 }}>{emojis[product.category] || "📦"}</span>
                )}
                <span className={`product-card-status ${product.status}`}>
                  <span className="status-dot" /> {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                </span>
              </div>
              <div className="product-card-body">
                <h3 className="product-card-name">
                  {product.name}
                  {Array.isArray(product.variants) && product.variants.length > 0 && (
                    <span className="variant-count-badge">
                      <Layers size={10} /> {product.variants.length} variant{product.variants.length > 1 ? "s" : ""}
                    </span>
                  )}
                </h3>
                <p className="product-card-category">{product.category}</p>
                <div className="product-card-footer">
                  <span className="product-card-price">{product.price.toLocaleString()} EGP</span>
                  <span className={`product-card-stock ${product.stock === 0 ? "out" : product.stock <= 5 ? "low" : ""}`}>
                    {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-sm)" }}>
                  <button className="topbar-btn" title="View" onClick={() => setViewProduct(product)} style={{ width: 28, height: 28 }}>
                    <ImageIcon size={13} />
                  </button>
                  <button className="topbar-btn" title="Edit" onClick={() => handleEdit(product)} style={{ width: 28, height: 28 }}>
                    <Edit size={13} />
                  </button>
                  <button className="topbar-btn" title="Delete" onClick={() => handleDelete(product.id, product.image_urls)} style={{ width: 28, height: 28 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Recommended Products Section */}
      {!loading && topRecommended.length > 0 && (
        <div style={{ marginTop: "var(--space-2xl)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-lg)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-md)",
              background: "rgba(0,210,255,0.12)", color: "var(--accent-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}>Top Recommended Products</h2>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                Products most frequently ordered by your customers — great for upselling
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-md)" }}>
            {topRecommended.map((product, i) => (
              <div
                key={product.id}
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)", overflow: "hidden",
                  transition: "all 0.2s", cursor: "pointer",
                }}
              >
                <div style={{
                  height: 120, background: "var(--bg-tertiary)", display: "flex",
                  alignItems: "center", justifyContent: "center", position: "relative",
                }}>
                  {product.image_urls?.[0] ? (
                    <img src={product.image_urls[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 32 }}>{emojis[product.category] || "📦"}</span>
                  )}
                  <div style={{
                    position: "absolute", top: 8, left: 8,
                    background: "var(--accent-secondary)", color: "white",
                    padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                  }}>
                    #{i + 1}
                  </div>
                </div>
                <div style={{ padding: "var(--space-md)" }}>
                  <h4 style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {product.name}
                  </h4>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 800, color: "var(--accent-primary-light)" }}>
                      {product.price?.toLocaleString()} EGP
                    </span>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 12,
                      background: "rgba(0,210,255,0.1)", color: "var(--accent-secondary)",
                      border: "1px solid rgba(0,210,255,0.2)", fontWeight: 600,
                    }}>
                      {product.rec_count} orders
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ View Product Modal ═══════════ */}
      {viewProduct && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewProduct(null)}>
          <div className="modal modal-wide" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>{viewProduct.name}</h3>
              <button className="modal-close" onClick={() => setViewProduct(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Product image */}
              {viewProduct.image_urls && viewProduct.image_urls.length > 0 && (
                <div style={{ marginBottom: "var(--space-lg)", borderRadius: "var(--radius-md)", overflow: "hidden", height: 200 }}>
                  <img src={viewProduct.image_urls[0]} alt={viewProduct.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              {/* Product info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Category</div>
                  <div style={{ fontWeight: 600 }}>{viewProduct.category}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Price</div>
                  <div style={{ fontWeight: 800, color: "var(--accent-primary-light)" }}>{viewProduct.price?.toLocaleString()} EGP</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Stock</div>
                  <div style={{ fontWeight: 600, color: viewProduct.stock === 0 ? "var(--accent-red)" : viewProduct.stock <= 5 ? "var(--accent-orange)" : "var(--text-primary)" }}>
                    {viewProduct.stock}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Status</div>
                  <div style={{ fontWeight: 600 }}>{viewProduct.status}</div>
                </div>
              </div>

              {viewProduct.description && (
                <div style={{ marginBottom: "var(--space-lg)", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{viewProduct.description}</div>
                </div>
              )}

              {/* Variants table */}
              {Array.isArray(viewProduct.variants) && viewProduct.variants.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                    <Layers size={16} style={{ color: "var(--accent-primary-light)" }} />
                    <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Variants</span>
                    <span className="variant-count-badge">{viewProduct.variants.length}</span>
                  </div>
                  <table className="variant-table">
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>SKU</th>
                        <th>Price Offset</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewProduct.variants.map((v, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{v.name}</td>
                          <td style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{v.sku || "—"}</td>
                          <td>
                            <span className={`price-offset ${v.price_offset > 0 ? "positive" : v.price_offset < 0 ? "negative" : ""}`}>
                              {v.price_offset > 0 ? "+" : ""}{v.price_offset} EGP
                            </span>
                          </td>
                          <td>
                            <span className={`stock-cell ${v.stock === 0 ? "out" : v.stock <= 5 ? "low" : ""}`}>
                              {v.stock}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(!Array.isArray(viewProduct.variants) || viewProduct.variants.length === 0) && (
                <div style={{ textAlign: "center", padding: "var(--space-lg)", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                  No variants configured for this product
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewProduct(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setViewProduct(null); handleEdit(viewProduct); }}>
                <Edit size={14} /> Edit Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Add/Edit Product Modal ═══════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <h3>{editingProduct ? "Edit Product" : "Add New Product"}</h3>
              <button className="modal-close" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Image</label>
                  <div
                    className={`image-upload-area ${dragOver ? "drag-over" : ""} ${imagePreview ? "has-image" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !imagePreview && fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <div className="image-preview-wrapper">
                        <img src={imagePreview} alt="Preview" className="image-preview" />
                        <button type="button" className="image-remove-btn" onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setGeneratedImageUrl(null); }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="image-upload-placeholder">
                        <div className="image-upload-icon"><Upload size={24} /></div>
                        <p className="image-upload-text">Drag & drop an image, or <span>browse</span></p>
                        <p className="image-upload-hint">JPG, PNG or WebP · Max 5MB</p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </div>
                  {/* AI Image Generation */}
                  <div className="ai-image-generator">
                    <div className="ai-image-divider">
                      <span>or generate with AI</span>
                    </div>
                    <div className="ai-image-controls">
                      <select
                        className="ai-style-select"
                        value={aiStyle}
                        onChange={(e) => setAiStyle(e.target.value)}
                        disabled={generatingImage}
                      >
                        <option value="studio">Studio (White BG)</option>
                        <option value="lifestyle">Lifestyle (In Use)</option>
                        <option value="minimal">Minimal (Elegant)</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-ai-generate"
                        onClick={handleGenerateImage}
                        disabled={generatingImage}
                      >
                        {generatingImage ? (
                          <><Loader2 size={14} className="spin" /> Generating...</>
                        ) : (
                          <><Sparkles size={14} /> Generate Image</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input type="text" name="name" className="form-input" placeholder="e.g. Black Leather Bag" defaultValue={editingProduct?.name || ""} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea name="description" className="form-input form-textarea" placeholder="Product description..." defaultValue={editingProduct?.description || ""} />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
                    onClick={handleGenerateDescription}
                    disabled={generatingDesc}
                  >
                    {generatingDesc ? <><Loader2 size={12} className="spin" /> Generating...</> : <><Sparkles size={12} /> Generate with AI</>}
                  </button>
                  {aiDescArabic && (
                    <div style={{ marginTop: 8, padding: 8, background: "var(--bg-glass)", borderRadius: 8, border: "1px solid var(--border-subtle)", fontSize: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--accent-primary-light)", fontSize: 10 }}>Arabic Description (Preview)</div>
                      <div style={{ direction: "rtl", textAlign: "right", color: "var(--text-secondary)" }}>{aiDescArabic}</div>
                    </div>
                  )}
                  {aiPriceSuggestion && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--accent-green)" }}>💡 {aiPriceSuggestion}</div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                  <div className="form-group">
                    <label className="form-label">Price (EGP)</label>
                    <input type="number" name="price" className="form-input" placeholder="0.00" defaultValue={editingProduct?.price || ""} required min="0" step="0.01" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock</label>
                    <input type="number" name="stock" className="form-input" placeholder="0" defaultValue={editingProduct?.stock || 0} required min="0" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select name="category" className="form-input" defaultValue={editingProduct?.category || "Bags"}>
                      <option value="Bags">Bags</option>
                      <option value="Jewelry">Jewelry</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Watches">Watches</option>
                      <option value="Clothing">Clothing</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select name="status" className="form-input" defaultValue={editingProduct?.status || "active"}>
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>

                {/* ═══════════ Variants Section ═══════════ */}
                <div className="form-group" style={{ marginTop: "var(--space-lg)" }}>
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                    <Layers size={14} />
                    Variants
                    {variants.length > 0 && (
                      <span className="variant-count-badge">{variants.length}</span>
                    )}
                  </label>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, marginBottom: "var(--space-sm)" }}>
                    Add size, color, or other variant options. Each variant can have its own SKU, price adjustment, and stock.
                  </p>

                  {/* Column headers */}
                  {variants.length > 0 && (
                    <div className="variant-header">
                      <span>Name</span>
                      <span>SKU</span>
                      <span>Price ±</span>
                      <span>Stock</span>
                      <span></span>
                    </div>
                  )}

                  <div className="variant-list">
                    {variants.map((v, index) => (
                      <div key={index} className="variant-row">
                        <input
                          type="text"
                          placeholder="e.g. Red / Large"
                          value={v.name}
                          onChange={(e) => updateVariant(index, "name", e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="SKU"
                          value={v.sku}
                          onChange={(e) => updateVariant(index, "sku", e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="0"
                          value={v.price_offset}
                          onChange={(e) => updateVariant(index, "price_offset", e.target.value)}
                          step="0.01"
                        />
                        <input
                          type="number"
                          placeholder="0"
                          value={v.stock}
                          onChange={(e) => updateVariant(index, "stock", e.target.value)}
                          min="0"
                        />
                        <button type="button" className="variant-remove-btn" onClick={() => removeVariant(index)}>
                          <Minus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="variant-add-btn" onClick={addVariant}>
                    <Plus size={14} /> Add Variant
                  </button>

                  {/* Image URL field for last added variant (optional enhancement) */}
                  {variants.length > 0 && (
                    <div style={{ marginTop: "var(--space-md)" }}>
                      {variants.map((v, index) => (
                        v.name.trim() !== "" && (
                          <div key={`img-${index}`} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 100, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {v.name} image:
                            </span>
                            <input
                              type="url"
                              placeholder="https://example.com/image.jpg (optional)"
                              value={v.image_url}
                              onChange={(e) => updateVariant(index, "image_url", e.target.value)}
                              style={{
                                flex: 1, padding: "4px 8px", background: "var(--bg-primary)",
                                border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
                                color: "var(--text-primary)", fontSize: 11, fontFamily: "var(--font-family)",
                                outline: "none",
                              }}
                            />
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingProduct ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
