"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";

/**
 * MessageBurst3D — a 3D particle burst that plays when a new message arrives.
 * Particles explode outward from center, then fade.
 * Mounted as a fixed overlay — call the `trigger` prop to fire.
 */

function Particles({ active, color = "#00d2ff" }) {
  const ref = useRef();
  const count = 40;
  const startTime = useRef(0);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = Math.random() * 3 + 1.5;
      return {
        velocity: [
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed,
        ],
        size: Math.random() * 0.08 + 0.04,
        offset: Math.random() * 0.3,
      };
    });
  }, []);

  useFrame((state) => {
    if (!active || !ref.current) return;
    if (startTime.current === 0) startTime.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startTime.current;

    if (elapsed > 1.5) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;

    const positions = ref.current.geometry.attributes.position;
    const colors = ref.current.geometry.attributes.color;

    particles.forEach((p, i) => {
      const t = elapsed + p.offset;
      const x = p.velocity[0] * t * (1 - t * 0.3);
      const y = p.velocity[1] * t * (1 - t * 0.3) - t * t * 0.8;
      const z = p.velocity[2] * t * (1 - t * 0.3);
      positions.setXYZ(i, x, y, z);

      const alpha = Math.max(0, 1 - t / 1.5);
      colors.setXYZ(i, alpha, alpha, alpha);
    });

    positions.needsUpdate = true;
    colors.needsUpdate = true;
  });

  // Reset when active changes
  useEffect(() => {
    if (active) startTime.current = 0;
  }, [active]);

  return (
    <points ref={ref} visible={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={new Float32Array(count * 3)}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={new Float32Array(count * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={2}
      />
    </points>
  );
}

export default function MessageBurst3D({ trigger }) {
  const [webglSupported, setWebglSupported] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebglSupported(!!c.getContext("webgl"));
    } catch (e) { setWebglSupported(false); }
  }, []);

  if (!webglSupported) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: 200, height: 200,
      pointerEvents: "none", zIndex: 9000,
    }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Particles active={trigger} />
      </Canvas>
    </div>
  );
}
