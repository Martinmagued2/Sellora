"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Confirmation dialog component — replaces all confirm() calls
 * Props: isOpen, onClose, onConfirm, title, message, confirmLabel, confirmVariant (danger/primary), loading
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  loading = false,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="confirm-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => !loading && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="confirm-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className={`confirm-dialog-icon ${confirmVariant}`}>
              <AlertTriangle size={28} />
            </div>
            <h3>{title}</h3>
            {message && <p>{message}</p>}
            <div className="confirm-dialog-actions">
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className={`btn ${confirmVariant === "danger" ? "btn-danger" : "btn-primary"}`}
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    Processing...
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
