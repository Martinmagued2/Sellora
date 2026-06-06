"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Toast from "./Toast";

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, type = "info", duration = 4000, action = null) => {
    const id = ++idRef.current;
    const toast = { id, message, type, duration, action };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback((message, duration, action) => showToast(message, "success", duration, action), [showToast]);
  const error = useCallback((message, duration, action) => showToast(message, "error", duration, action), [showToast]);
  const warning = useCallback((message, duration, action) => showToast(message, "warning", duration, action), [showToast]);
  const info = useCallback((message, duration, action) => showToast(message, "info", duration, action), [showToast]);

  const value = {
    showToast,
    dismissToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              action={toast.action}
              onDismiss={dismissToast}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
