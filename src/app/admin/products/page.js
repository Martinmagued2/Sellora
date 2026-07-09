"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, Package } from "lucide-react";
import { useAdminAuth } from "@/lib/use-admin-auth";

export default function AdminProducts() {
  const { isAdmin, loading: adminLoading, userId } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchProducts = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/products?${params}`, {
        headers: { "x-account-id": userId },
      });
      const json = await res.json();
      if (json.success) {
        setProducts(json.data.products);
        setPagination(json.data.pagination);
      }
    } catch (e) {
      console.error("Failed to fetch products:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    const load = async () => { await fetchProducts(1); };
    load();
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts(1);
  };

  const stockLabel = (stock) => {
    if (stock === 0) return { text: "Out of Stock", color: "var(--accent-red)" };
    if (stock <= 5) return { text: "Low Stock", color: "var(--accent-orange)" };
    return { text: `${stock} in stock`, color: "var(--accent-green)" };
  };

  return (
    <>
      <div className="page-header">
        <h1>Products</h1>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {["", "active", "draft", "archived"].map((st) => (
            <button
              key={st}
              className={`filter-tab ${statusFilter === st ? "active" : ""}`}
              onClick={() => setStatusFilter(st)}
            >
              {st ? st.charAt(0).toUpperCase() + st.slice(1) : "All"}
            </button>
          ))}
        </div>

        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      <div className="admin-table-container">
        {loading ? (
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
            <RefreshCw size={20} className="spin" style={{ display: "inline-block" }} />
          </div>
        ) : (
          <div className="table-scroll-wrapper"><table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Account</th>
                <th>Price</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const stock = stockLabel(product.stock);
                return (
                  <tr key={product.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: "var(--radius-md)",
                          background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--text-tertiary)", flexShrink: 0, overflow: "hidden",
                        }}>
                          {product.image_urls?.[0] ? (
                            <img src={product.image_urls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <Package size={16} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{product.name}</div>
                          {product.description && (
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {product.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: "var(--font-size-sm)" }}>
                      {product.account?.business_name || "—"}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--accent-primary-light)" }}>
                      {product.price?.toLocaleString()} {product.currency || "EGP"}
                    </td>
                    <td style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                      {product.category || "—"}
                    </td>
                    <td>
                      <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, color: stock.color }}>
                        {stock.text}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${product.status || "draft"}`}>
                        {product.status || "draft"}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                      {new Date(product.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "var(--space-3xl)", color: "var(--text-tertiary)" }}>
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
          <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => fetchProducts(pagination.page - 1)}>Previous</button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchProducts(pagination.page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
