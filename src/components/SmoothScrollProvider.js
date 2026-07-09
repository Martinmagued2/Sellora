"use client";

import { useEffect } from "react";

/**
 * SmoothScrollProvider
 * Enables smooth scrolling behavior on the landing page.
 * Uses native CSS smooth scrolling — no JS scroll library needed.
 */
export default function SmoothScrollProvider({ children }) {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";

    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return <>{children}</>;
}
