"use client";

import { useRef, useCallback } from "react";

/**
 * MagneticButton
 * A wrapper that adds a magnetic hover effect to its children.
 * When the user hovers near the button, it subtly moves toward the cursor.
 * Pure JS/CSS — no animation library required.
 */
export default function MagneticButton({ children, className = "" }) {
  const ref = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    el.style.transition = "transform 0.2s ease-out";
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transform = "translate(0px, 0px)";
    el.style.transition = "transform 0.4s ease-out";
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ display: "inline-block" }}
    >
      {children}
    </div>
  );
}
