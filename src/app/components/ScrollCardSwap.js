"use client";

import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import "./CardSwap.css";

export const Card = forwardRef(({ customClass, ...rest }, ref) => (
  <div ref={ref} {...rest} className={`card ${customClass ?? ""} ${rest.className ?? ""}`.trim()} />
));
Card.displayName = "Card";

const makeSlot = (i, distX, distY, total) => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
});

const placeNow = (el, slot, skew) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: "center center",
    zIndex: slot.zIndex,
    force3D: true,
  });

const ScrollCardSwap = ({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  skewAmount = 6,
  easing = "elastic",
  children,
}) => {
  const config =
    easing === "elastic"
      ? { ease: "elastic.out(0.6,0.9)", dur: 1.2 }
      : { ease: "power1.inOut", dur: 0.8 };

  const childArr = useMemo(() => Children.toArray(children), [children]);
  const refs = useMemo(
    () => childArr.map(() => React.createRef()),
    [childArr.length]
  );

  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const cardsRef = useRef(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const total = refs.length;
    if (total === 0) return;

    // Initial placement
    refs.forEach((r, i) => placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount));

    const handleScroll = () => {
      if (!sectionRef.current || !stickyRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const sectionHeight = sectionRef.current.offsetHeight;
      const stickyHeight = stickyRef.current.offsetHeight;
      const scrollableHeight = sectionHeight - stickyHeight;

      if (scrollableHeight <= 0) return;

      // How far through the scrollable area are we? (0 to 1)
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableHeight));

      // Which card should be at front?
      const targetIndex = Math.min(Math.floor(progress * total), total - 1);

      if (targetIndex !== currentIndexRef.current) {
        currentIndexRef.current = targetIndex;
        for (let idx = 0; idx < total; idx++) {
          const slotIdx = (idx - targetIndex + total) % total;
          const el = refs[idx]?.current;
          if (!el) continue;
          const slot = makeSlot(slotIdx, cardDistance, verticalDistance, total);
          gsap.to(el, {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            zIndex: slot.zIndex,
            duration: config.dur,
            ease: config.ease,
            overwrite: "auto",
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [cardDistance, verticalDistance, skewAmount, easing, refs.length]);

  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width: "100%", height: "100%", maxWidth: "100%", ...(child.props.style ?? {}) },
        })
      : child
  );

  const totalHeight = `${Math.max(300, childArr.length * 45)}vh`;

  return (
    <div ref={sectionRef} style={{ height: totalHeight, position: "relative" }}>
      <div
        ref={stickyRef}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
        }}
      >
        <div
          ref={cardsRef}
          className="card-swap-container"
          style={{
            width: typeof width === "number" ? `min(100%, ${width}px)` : width,
            maxWidth: "90vw",
            height: typeof height === "number" ? `min(80vh, ${height}px)` : height,
            position: "relative",
            transform: "none",
          }}
        >
          {rendered}
        </div>
      </div>
    </div>
  );
};

export default ScrollCardSwap;
