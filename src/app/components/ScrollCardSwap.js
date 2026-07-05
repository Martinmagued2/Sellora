"use client";

import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./CardSwap.css";

gsap.registerPlugin(ScrollTrigger);

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
      ? { ease: "elastic.out(0.6,0.9)", dur: 1.5 }
      : { ease: "power1.inOut", dur: 0.8 };

  const childArr = useMemo(() => Children.toArray(children), [children]);
  const refs = useMemo(
    () => childArr.map(() => React.createRef()),
    [childArr.length]
  );

  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const total = refs.length;
    if (total === 0 || !containerRef.current || !innerRef.current) return;

    // Initial placement
    refs.forEach((r, i) => placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount));

    const swap = (direction) => {
      if (total < 2) return;

      let newOrder;
      if (direction === "next") {
        // Move front to back: [0,1,2,3] -> [1,2,3,0]
        newOrder = [...Array(total).keys()].map((_, i) => (i - 1 + total) % total);
      } else {
        // Move back to front: [0,1,2,3] -> [3,0,1,2]
        newOrder = [...Array(total).keys()].map((_, i) => (i + 1) % total);
      }

      // Animate to new positions based on new order
      newOrder.forEach((cardIdx, slotIdx) => {
        const el = refs[cardIdx].current;
        if (!el) return;
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
      });
    };

    // Set up ScrollTrigger
    const st = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: `+=${total * 100}%`,
      pin: innerRef.current,
      pinSpacing: true,
      scrub: false,
      onUpdate: (self) => {
        const progress = self.progress;
        const targetIndex = Math.min(Math.floor(progress * total), total - 1);
        
        if (targetIndex !== currentIndexRef.current) {
          const diff = targetIndex - currentIndexRef.current;
          const direction = diff > 0 ? "next" : "prev";
          const steps = Math.abs(diff);
          
          for (let i = 0; i < steps; i++) {
            swap(direction);
          }
          
          currentIndexRef.current = targetIndex;
        }
      },
      onLeaveBack: () => {
        // Reset to initial state when scrolling back above the section
        currentIndexRef.current = 0;
        refs.forEach((r, i) => placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount));
      },
    });

    return () => {
      st.kill();
      gsap.killTweensOf(refs.map(r => r.current).filter(Boolean));
    };
  }, [cardDistance, verticalDistance, skewAmount, easing, refs.length]);

  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width, height, ...(child.props.style ?? {}) },
        })
      : child
  );

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div ref={innerRef} className="card-swap-container" style={{ width, height, position: "relative", transform: "none", margin: "0 auto" }}>
        {rendered}
      </div>
    </div>
  );
};

export default ScrollCardSwap;
