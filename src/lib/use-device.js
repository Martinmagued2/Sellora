"use client";

import { useState, useEffect } from "react";

/**
 * useDevice — Detects mobile/tablet/desktop and Capacitor native environment.
 * SSR-safe: defaults to desktop on server, then detects on client.
 */
export function useDevice() {
  const [device, setDevice] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isNative: false,
    width: 1200,
    isReady: false,
  });

  useEffect(() => {
    const detect = () => {
      const w = window.innerWidth;
      const isNative = !!(window.Capacitor || window._capacitorNative);
      const isMobile = w < 768;
      const isTablet = w >= 768 && w < 1024;
      const isDesktop = w >= 1024;

      setDevice({ isMobile, isTablet, isDesktop, isNative, width: w, isReady: true });
    };

    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  return device;
}
