"use client";

import { motion } from "framer-motion";

/**
 * PageTransition — wraps dashboard page content with a smooth
 * fade + slide-up animation on every route change.
 *
 * Usage: wrap your page content:
 *   <PageTransition>
 *     <YourContent />
 *   </PageTransition>
 */
export default function PageTransition({ children, direction = "up" }) {
  const variants = {
    up: {
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -8 },
    },
    left: {
      initial: { opacity: 0, x: 16 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -8 },
    },
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    scale: {
      initial: { opacity: 0, scale: 0.97 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.98 },
    },
  };

  const v = variants[direction] || variants.up;

  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
