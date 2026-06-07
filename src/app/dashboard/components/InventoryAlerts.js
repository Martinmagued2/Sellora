"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  PackageX,
  PackageCheck,
  EyeOff,
  Eye,
  RefreshCw,
} from "lucide-react";
import { useToast } from "./ToastProvider";

export default function InventoryAlerts() {
  const toast = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});

  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/inventory/alerts");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAlerts(data.products || []);
        }
      } catch (err) {
        console.error("Failed to fetch inventory alerts:", err);
      }
      if (!cancelled) setLoading(false);
    };
    fetchAlerts();
    return () => { cancelled = true; };
  }, []);

  const handleRestock = async (productId, currentStock) => {
    setUpdating((prev) => ({ ...prev, [productId]: true }));
    try {
      const restockAmount = prompt(`Current stock: ${currentStock}\nEnter new stock quantity:`, "20");
      if (restockAmount === null) {
        setUpdating((prev) => ({ ...prev, [productId]: false }));
        return;
      }

      const newStock = parseInt(restockAmount);
      if (isNaN(newStock) || newStock < 0) {
        toast.warning("Please enter a valid stock quantity.");
        setUpdating((prev) => ({ ...prev, [productId]: false }));
        return;
      }

      const res = await fetch("/api/inventory/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, stock: newStock }),
      });

      if (res.ok) {
        // Update local state
        setAlerts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, stock: newStock } : p
          ).filter((p) => p.stock <= 5) // Remove items no longer low stock
        );
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to restock product.");
      }
    } catch (err) {
      console.error("Restock error:", err);
      toast.error("Failed to restock product.");
    }
    setUpdating((prev) => ({ ...prev, [productId]: false }));
  };

  const handleToggleHiddenFromAi = async (productId, currentHidden) => {
    setUpdating((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch("/api/inventory/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, hidden_from_ai: !currentHidden }),
      });

      if (res.ok) {
        setAlerts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, hidden_from_ai: !currentHidden } : p
          )
        );
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update AI visibility.");
      }
    } catch (err) {
      console.error("Toggle hidden error:", err);
      toast.error("Failed to update AI visibility.");
    }
    setUpdating((prev) => ({ ...prev, [productId]: false }));
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (alerts.length === 0) {
    return null; // Don't show if no alerts
  }

  const outOfStock = alerts.filter((p) => p.stock === 0);
  const lowStock = alerts.filter((p) => p.stock > 0 && p.stock <= 5);

  return (
    <div className="inventory-alerts">
      <div className="inventory-alerts-header">
        <h3>
          <AlertTriangle size={18} style={{ color: "var(--accent-orange)" }} />
          Inventory Alerts
        </h3>
        <span className="inventory-alerts-count">{alerts.length} item{alerts.length > 1 ? "s" : ""}</span>
      </div>
      <div className="inventory-alerts-body">
        {/* Out of Stock */}
        {outOfStock.length > 0 && (
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-red)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 var(--space-md) var(--space-sm)" }}>
              Out of Stock ({outOfStock.length})
            </div>
            {outOfStock.map((product) => (
              <div key={product.id} className="inventory-alert-item out-of-stock">
                <div className="inventory-alert-icon out">
                  <PackageX size={18} />
                </div>
                <div className="inventory-alert-info">
                  <div className="inventory-alert-name">{product.name}</div>
                  <div className="inventory-alert-stock">
                    <strong className="out">0</strong> in stock · {product.category}
                    {product.hidden_from_ai && (
                      <span style={{ marginLeft: 8, color: "var(--accent-secondary)", fontSize: 10 }}>
                        <EyeOff size={10} style={{ verticalAlign: "middle" }} /> Hidden from AI
                      </span>
                    )}
                  </div>
                </div>
                <div className="inventory-alert-actions">
                  <button
                    className="inventory-alert-btn restock"
                    onClick={() => handleRestock(product.id, product.stock)}
                    disabled={updating[product.id]}
                  >
                    <RefreshCw size={12} style={{ animation: updating[product.id] ? "spin 0.8s linear infinite" : "none" }} />
                    Restock
                  </button>
                  <button
                    className={`inventory-alert-btn ${product.hidden_from_ai ? "hidden-from-ai" : "hide-ai"}`}
                    onClick={() => handleToggleHiddenFromAi(product.id, product.hidden_from_ai)}
                    disabled={updating[product.id]}
                  >
                    {product.hidden_from_ai ? <Eye size={12} /> : <EyeOff size={12} />}
                    {product.hidden_from_ai ? "Show in AI" : "Hide from AI"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Low Stock */}
        {lowStock.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-orange)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 var(--space-md) var(--space-sm)" }}>
              Low Stock ({lowStock.length})
            </div>
            {lowStock.map((product) => (
              <div key={product.id} className="inventory-alert-item low-stock">
                <div className="inventory-alert-icon low">
                  <AlertTriangle size={18} />
                </div>
                <div className="inventory-alert-info">
                  <div className="inventory-alert-name">{product.name}</div>
                  <div className="inventory-alert-stock">
                    <strong className="low">{product.stock}</strong> in stock · {product.category}
                    {product.hidden_from_ai && (
                      <span style={{ marginLeft: 8, color: "var(--accent-secondary)", fontSize: 10 }}>
                        <EyeOff size={10} style={{ verticalAlign: "middle" }} /> Hidden from AI
                      </span>
                    )}
                  </div>
                </div>
                <div className="inventory-alert-actions">
                  <button
                    className="inventory-alert-btn restock"
                    onClick={() => handleRestock(product.id, product.stock)}
                    disabled={updating[product.id]}
                  >
                    <PackageCheck size={12} />
                    Restock
                  </button>
                  <button
                    className={`inventory-alert-btn ${product.hidden_from_ai ? "hidden-from-ai" : "hide-ai"}`}
                    onClick={() => handleToggleHiddenFromAi(product.id, product.hidden_from_ai)}
                    disabled={updating[product.id]}
                  >
                    {product.hidden_from_ai ? <Eye size={12} /> : <EyeOff size={12} />}
                    {product.hidden_from_ai ? "Show in AI" : "Hide from AI"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
