"use client";

import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef } from "react";
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

  const container = useRef(null);
  const stickyRef = useRef(null);

  // State: which index is currently at the front
  const order = useRef(Array.from({ length: childArr.length }, (_, i) => i));

  useEffect(() => {
    const total = refs.length;
    if (total === 0) return;

    // Initial placement
    refs.forEach((r, i) => placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount));

    const swap = (direction) => {
      if (order.current.length < 2) return;

      let newOrder = [...order.current];
      if (direction === "next") {
        // Move front to back
        const front = newOrder.shift();
        newOrder.push(front);
      } else {
        // Move back to front
        const back = newOrder.pop();
        newOrder.unshift(back);
      }

      // Animate to new positions
      newOrder.forEach((cardIdx, slotIdx) => {
        const el = refs[cardIdx].current;
        const slot = makeSlot(slotIdx, cardDistance, verticalDistance, total);
        
        gsap.to(el, {
          x: slot.x,
          y: slot.y,
          z: slot.z,
          zIndex: slot.zIndex,
          duration: config.dur,
          ease: config.ease,
          overwrite: true,
        });
      });

      order.current = newOrder;
    };

    // Set up ScrollTrigger
    const st = ScrollTrigger.create({
      trigger: container.current,
      start: "top top",
      end: `+=${total * 80}%`, // Scroll distance
      pin: stickyRef.current,
      pinSpacing: true,
      onUpdate: (self) => {
        const progress = self.progress;
        const targetIndex = Math.floor(progress * total);
        
        // If we need to advance
        if (targetIndex > self.currentTarget) {
          const steps = targetIndex - self.currentTarget;
          for (let i = 0; i < steps; i++) swap("next");
          self.currentTarget = targetIndex;
        } 
        // If we need to go back
        else if (targetIndex < self.currentTarget) {
          const steps = self.currentTarget - targetIndex;
          for (let i = 0; i < steps; i++) swap("prev");
          self.currentTarget = targetIndex;
        }
      },
    });

    // Initialize currentTarget on the trigger object
    st.currentTarget = 0;

    return () => {
      st.kill();
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
    <div ref={container} style={{ height: "100%" }}>
      <div ref={stickyRef} className="card-swap-container" style={{ width, height, position: "relative", transform: "none" }}>
        {rendered}
      </div>
    </div>
  );
};

export default ScrollCardSwap;
