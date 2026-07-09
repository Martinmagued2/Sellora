"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP = {
  success: {
    border: "var(--accent-green)",
    iconBg: "rgba(59, 165, 92, 0.15)",
    iconColor: "var(--accent-green)",
    progressBg: "var(--accent-green)",
  },
  error: {
    border: "var(--accent-red)",
    iconBg: "rgba(237, 66, 69, 0.15)",
    iconColor: "var(--accent-red)",
    progressBg: "var(--accent-red)",
  },
  warning: {
    border: "var(--accent-orange)",
    iconBg: "rgba(248, 165, 50, 0.15)",
    iconColor: "var(--accent-orange)",
    progressBg: "var(--accent-orange)",
  },
  info: {
    border: "var(--accent-secondary)",
    iconBg: "rgba(0, 210, 255, 0.15)",
    iconColor: "var(--accent-secondary)",
    progressBg: "var(--accent-secondary)",
  },
};

export default function Toast({ id, message, type = "info", duration = 4000, onDismiss, action }) {
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const colors = COLOR_MAP[type] || COLOR_MAP.info;
  const Icon = ICON_MAP[type] || Info;

  // Auto-dismiss with progress tracking
  useEffect(() => {
    if (paused) return;

    const startTime = Date.now() - elapsed;
    const tickInterval = 50;

    const tick = () => {
      const now = Date.now();
      const newElapsed = now - startTime;
      const remaining = Math.max(0, duration - newElapsed);
      const newProgress = (remaining / duration) * 100;

      setProgress(newProgress);
      setElapsed(newElapsed);

      if (remaining <= 0) {
        onDismiss?.(id);
      }
    };

    const intervalId = setInterval(tick, tickInterval);
    return () => clearInterval(intervalId);
  }, [paused, duration, id, onDismiss, elapsed]);

  const handlePause = useCallback(() => setPaused(true), []);
  const handleResume = useCallback(() => setPaused(false), []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="toast"
      style={{ borderLeftColor: colors.border }}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      onClick={() => onDismiss?.(id)}
    >
      <div className="toast-content">
        <div className="toast-icon" style={{ background: colors.iconBg, color: colors.iconColor }}>
          <Icon size={18} />
        </div>
        <div className="toast-message">
          <span>{message}</span>
          {action && (
            <button
              className="toast-action"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
                onDismiss?.(id);
              }}
            >
              {action.label}
            </button>
          )}
        </div>
        <button
          className="toast-close"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.(id);
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div className="toast-progress-track">
        <div
          className="toast-progress"
          style={{
            width: `${progress}%`,
            background: colors.progressBg,
          }}
        />
      </div>
    </motion.div>
  );
}
