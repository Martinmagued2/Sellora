"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const StoreContext = createContext(null);

const STORAGE_KEY = "sellora_current_store_id";

export function StoreProvider({ children }) {
  const [currentStoreId, setCurrentStoreId] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load current store ID from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCurrentStoreId(saved);
      }
    } catch (e) {
      // localStorage not available
    }
  }, []);

  // Fetch stores list
  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch("/api/stores");
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);

        // If no current store is selected, try to pick the first one
        if (!currentStoreId && data.stores?.length > 0) {
          const savedId = localStorage.getItem(STORAGE_KEY);
          const defaultStore = savedId
            ? data.stores.find((s) => s.id === savedId)
            : null;
          const storeToSelect = defaultStore || data.stores[0];
          setCurrentStoreId(storeToSelect.id);
          try {
            localStorage.setItem(STORAGE_KEY, storeToSelect.id);
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      console.error("Failed to fetch stores:", e);
    }
    setLoading(false);
  }, [currentStoreId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const switchStore = useCallback((storeId) => {
    setCurrentStoreId(storeId);
    try {
      localStorage.setItem(STORAGE_KEY, storeId);
    } catch (e) { /* ignore */ }
    // Dispatch a custom event so other components can react
    window.dispatchEvent(
      new CustomEvent("store-changed", { detail: { storeId } })
    );
  }, []);

  const currentStore = stores.find((s) => s.id === currentStoreId) || null;

  const value = {
    currentStoreId,
    currentStore,
    stores,
    loading,
    switchStore,
    refreshStores: fetchStores,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCurrentStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    // Return a safe default when used outside of StoreProvider
    return {
      currentStoreId: null,
      currentStore: null,
      stores: [],
      loading: true,
      switchStore: () => {},
      refreshStores: () => {},
    };
  }
  return ctx;
}
