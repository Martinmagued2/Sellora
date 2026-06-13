"use client";
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export default function PageTransition({ children }) {
  const ref = useRef(null);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      gsap.set(ref.current, { opacity: 1 });
      return;
    }

    gsap.fromTo(ref.current,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: "power2.out",
        // CRITICAL: Clear the transform after animation so position:fixed
        // children (modals, popups) aren't offset by scroll position.
        // A parent with `transform` creates a new containing block,
        // breaking fixed positioning.
        onComplete: () => {
          gsap.set(ref.current, { clearProps: "transform" });
        },
      }
    );
  }, { scope: ref });

  return <div ref={ref}>{children}</div>;
}
