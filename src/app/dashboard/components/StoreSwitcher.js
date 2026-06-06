"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Store, Plus, Check, Settings } from "lucide-react";
import { useCurrentStore } from "@/lib/store-context";
import Link from "next/link";

export default function StoreSwitcher() {
  const { currentStore, stores, switchStore, loading } = useCurrentStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Don't show switcher if only 0-1 stores (starter plan)
  if (loading) {
    return (
      <div className="store-switcher" style={{ opacity: 0.5 }}>
        <Store size={16} />
        <span>Loading...</span>
      </div>
    );
  }

  if (stores.length <= 1) {
    // Single store or no store - just show badge
    return (
      <div className="store-switcher store-switcher-single">
        <Store size={16} />
        <span className="store-switcher-name">
          {currentStore?.name || "Default Store"}
        </span>
      </div>
    );
  }

  return (
    <div className="store-switcher-wrapper" ref={ref}>
      <button
        className="store-switcher"
        onClick={() => setOpen(!open)}
        aria-label="Switch store"
        aria-expanded={open}
      >
        {currentStore?.logo_url ? (
          <img
            src={currentStore.logo_url}
            alt={currentStore.name}
            className="store-switcher-logo"
          />
        ) : (
          <Store size={16} />
        )}
        <span className="store-switcher-name">
          {currentStore?.name || "Select Store"}
        </span>
        <ChevronDown
          size={14}
          style={{
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div className="store-switcher-dropdown">
          <div className="store-switcher-dropdown-header">
            <Store size={14} />
            Switch Store
          </div>
          {stores.map((store) => (
            <button
              key={store.id}
              className={`store-switcher-item ${store.id === currentStore?.id ? "active" : ""}`}
              onClick={() => {
                switchStore(store.id);
                setOpen(false);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt={store.name}
                    style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: "var(--accent-gradient)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 10,
                      flexShrink: 0,
                    }}
                  >
                    {(store.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "var(--font-size-sm)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {store.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {store.product_count || 0} products &middot;{" "}
                    {store.order_count || 0} orders
                  </div>
                </div>
              </div>
              {store.id === currentStore?.id && (
                <Check size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
              )}
            </button>
          ))}
          <div className="store-switcher-dropdown-footer">
            <Link
              href="/dashboard/stores"
              className="store-switcher-footer-link"
              onClick={() => setOpen(false)}
            >
              <Settings size={14} />
              Manage Stores
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
