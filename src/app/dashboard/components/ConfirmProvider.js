"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

const ConfirmContext = createContext(null);

// No-op fallback for SSR
const noopConfirm = () => Promise.resolve(true);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    return noopConfirm;
  }
  return context;
}

export default function ConfirmProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const resolveRef = useRef(null);

  const confirmAction = useCallback((message, options = {}) => {
    const { title = "Confirm", confirmText = "Confirm", cancelText = "Cancel", danger = true } = options;

    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({ message, title, confirmText, cancelText, danger });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setConfirmState(null);
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setConfirmState(null);
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleCancel}
          >
            <motion.div
              className="modal"
              style={{ maxWidth: 420 }}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: confirmState.danger ? "var(--accent-red)" : "var(--text-primary)" }}>
                  {confirmState.danger && <AlertTriangle size={18} />}
                  {confirmState.title}
                </h3>
                <button className="modal-close" onClick={handleCancel}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p style={{ color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>{confirmState.message}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={handleCancel}>{confirmState.cancelText}</button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  style={confirmState.danger ? { background: "var(--accent-red)", borderColor: "var(--accent-red)" } : {}}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
