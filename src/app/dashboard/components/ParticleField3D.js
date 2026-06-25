"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useState, useEffect } from "react";

/**
 * ParticleField3D — thousands of particles that float in 3D space.
 * Particles drift slowly and react to mouse position.
 * Can optionally "form" a shape (like a logo) on scroll.
 */

function ParticleCloud({ count = 2000, color = "#6c5ce7" }) {
  const ref = useRef();
  const mouseRef = useRef({ x: 0, y: 0 });

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere
      const r = Math.random() * 8 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (ref.current) {
      // Slow rotation
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = state.clock.elapsedTime * 0.01;

      // React to mouse
      const targetX = (mouseRef.current.x - 0.5) * 0.3;
      const targetY = (mouseRef.current.y - 0.5) * 0.3;
      ref.current.rotation.y += (targetX - ref.current.rotation.y * 0.1) * 0.001;
    }
  });

  useEffect(() => {
    const handleMouse = (e) => {
      mouseRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={0.03}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
        blending={2}
      />
    </Points>
  );
}

export default function ParticleField3D({ count = 2000, color = "#6c5ce7", height = 400 }) {
  const [webglSupported, setWebglSupported] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebglSupported(!!c.getContext("webgl"));
    } catch (e) { setWebglSupported(false); }
  }, []);

  if (!webglSupported) return null;

  return (
    <div style={{ width: "100%", height, position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <ParticleCloud count={count} color={color} />
        </Suspense>
      </Canvas>
    </div>
  );
}
