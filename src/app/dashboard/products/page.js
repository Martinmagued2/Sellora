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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
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
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null); // Supabase URL for saving
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [aiDescEnglish, setAiDescEnglish] = useState("");
  const [aiDescArabic, setAiDescArabic] = useState("");
  const [aiPriceSuggestion, setAiPriceSuggestion] = useState("");
  const fileInputRef = useRef(null);

  const supabase = createClient();
  const planLimits = getPlanLimits(accountPlan);
  const limitReached = planLimits.products !== -1 && products.length >= planLimits.products;

  // Ensure storage buckets exist (auto-creates them if missing)
  const ensureBuckets = useCallback(async () => {
    try {
      await fetch("/api/storage/ensure-buckets", { method: "POST" });
    } catch (e) {
      console.warn("[Products] Bucket ensure failed:", e.message);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    
    // Fetch account plan
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

    const { data, error } = await query;
    if (!error) setProducts(data || []);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { ensureBuckets(); fetchProducts(); }, [ensureBuckets, fetchProducts]);

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (jpg, png, webp)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5MB");
      return;
    }
    setImageFile(file);
    setGeneratedImageUrl(null); // Clear AI-generated URL when manual file is selected
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
      alert("Please enter a product name first, then generate an image.");
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
        alert(data.error || "Image generation failed. Please try again.");
        return;
      }

      // Set the preview to the generated image (use base64 for instant preview)
      const dataUrl = `data:image/png;base64,${data.image_base64}`;
      setImagePreview(dataUrl);
      setImageFile(null); // Not a file upload — it's an AI-generated image
      setGeneratedImageUrl(data.image_url); // Store the Supabase URL for saving
    } catch (err) {
      console.error("Image generation error:", err);
      alert("Image generation failed. Please try again.");
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

    // If AI-generated image, use the Supabase URL directly
    if (generatedImageUrl) {
      imageUrl = generatedImageUrl;
    } else if (imageFile) {
      // Manual file upload
      // Ensure buckets exist before uploading
      try {
        await fetch("/api/storage/ensure-buckets", { method: "POST" });
      } catch (e) {}

      const ext = imageFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      let uploadError;
      let uploadData;

      // Try client-side upload first (respects RLS with user auth)
      const clientResult = await supabase.storage
        .from("product-images")
        .upload(fileName, imageFile, { cacheControl: "3600", upsert: false });
      uploadError = clientResult.error;
      uploadData = clientResult.data;

      // If client upload fails (e.g., RLS issues), try server-side via admin API
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
        alert("Image upload failed: " + (uploadError.message || "Unknown error. The storage bucket may not exist yet. Please try again."));
      }
    }

    const payload = {
      account_id: user.id,
      name: fd.get("name"),
      description: fd.get("description"),
      price: parseFloat(fd.get("price")),
      category: fd.get("category"),
      stock: parseInt(fd.get("stock")),
      status: fd.get("status") || "active",
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

  const handleEdit = (product) => {
    setEditingProduct(product);
    setImagePreview(product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : null);
    setShowModal(true);
  };

  const handleDelete = async (id, imageUrls) => {
    if (!confirm("Delete this product?")) return;
    
    // First, delete associated images from storage to prevent orphans
    if (imageUrls && imageUrls.length > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Extract file paths from full URLs. URL format: .../storage/v1/object/public/product-images/USER_ID/FILENAME
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

    // Then delete the product row
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
  };

  const handleGenerateDescription = async () => {
    const form = document.querySelector('.modal form');
    const productName = form?.elements?.name?.value;
    const category = form?.elements?.category?.value;

    if (!productName?.trim()) {
      alert("Please enter a product name first, then generate a description.");
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
        alert(data.error || "Description generation failed.");
        return;
      }

      if (data.english) {
        setAiDescEnglish(data.english);
        // Set the description textarea value
        const descField = form?.elements?.description;
        if (descField) descField.value = data.english;
      }
      if (data.arabic) setAiDescArabic(data.arabic);
      if (data.price_suggestion) setAiPriceSuggestion(data.price_suggestion);
    } catch (err) {
      console.error("Description generation error:", err);
      alert("Description generation failed. Please try again.");
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
            <button className="btn btn-primary" onClick={() => setShowModal(true)} id="add-product">
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
                <h3 className="product-card-name">{product.name}</h3>
                <p className="product-card-category">{product.category}</p>
                <div className="product-card-footer">
                  <span className="product-card-price">{product.price.toLocaleString()} EGP</span>
                  <span className={`product-card-stock ${product.stock === 0 ? "out" : product.stock <= 5 ? "low" : ""}`}>
                    {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-sm)" }}>
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

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
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
                  {/* AI Generate Description Button */}
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
