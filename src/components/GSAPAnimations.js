"use client";

import { useEffect } from "react";

/**
 * GSAPAnimations
 * Placeholder for landing page animations.
 * Uses CSS animations instead of GSAP for zero-dependency reliability.
 * Applies scroll-triggered fade-in/slide-up effects to elements
 * with the "animate-on-scroll" class.
 */
export default function GSAPAnimations() {
  useEffect(() => {
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
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    // Observe all elements with animate-on-scroll class
    const elements = document.querySelectorAll(".animate-on-scroll");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return null; // No visual output — only applies effects
}
