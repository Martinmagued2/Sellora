"use client";

import { useEffect } from "react";

/**
 * DashboardAnimations
 * Applies subtle CSS animations and transitions to the dashboard.
 * Uses CSS-only approach (no GSAP dependency) for reliability.
 */
export default function DashboardAnimations() {
  useEffect(() => {
    // Add a class to enable dashboard animations after mount
    document.body.classList.add("dashboard-ready");

    // Intersection Observer for scroll-triggered animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe all elements with animate-on-scroll class
    document.querySelectorAll(".animate-on-scroll").forEach((el) => {
      observer.observe(el);
    });

    return () => {
      document.body.classList.remove("dashboard-ready");
      observer.disconnect();
    };
  }, []);

  return null; // No visual output — only applies effects
}
