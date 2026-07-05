"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * PageTransition
 * Wraps children with a smooth fade transition on route changes.
 * Pure CSS-based — no external animation library required.
 */
export default function PageTransition({ children }) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Fade out
    setIsVisible(false);
    // Fade in after a brief delay
    const timer = setTimeout(() => setIsVisible(true), 80);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      {children}
    </div>
  );
}
