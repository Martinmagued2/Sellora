"use client";

import { useRef, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import { useState, useEffect } from "react";

/**
 * Funnel3D — the analytics funnel as a 3D cone you can rotate.
 * Each stage is a ring at a different height, decreasing in radius.
 */

function FunnelCone({ stages }) {
  const ref = useRef();
  const maxHeight = 2.5;
  const maxRadius = 1.2;

  useFrame((state) => {
    if (ref.current && !state.clock.paused) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <group ref={ref}>
      {stages.map((stage, i) => {
        const ratio = stage.value / stages[0].value;
        const radius = maxRadius * (1 - i * 0.18);
        const y = maxHeight / 2 - (i / stages.length) * maxHeight;
        const nextRadius = i < stages.length - 1
          ? maxRadius * (1 - (i + 1) * 0.18)
          : radius * 0.5;
        const height = maxHeight / stages.length * 0.9;

        return (
          <group key={i}>
            {/* Cone segment */}
            <mesh position={[0, y, 0]}>
              <cylinderGeometry args={[radius, nextRadius, height, 32, 1, true]} />
              <meshStandardMaterial
                color={stage.color}
                transparent
                opacity={0.4}
                side={2}
                emissive={stage.color}
                emissiveIntensity={0.2}
                roughness={0.3}
                metalness={0.5}
              />
            </mesh>

            {/* Top ring */}
            <mesh position={[0, y + height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[radius - 0.02, radius, 32]} />
              <meshBasicMaterial color={stage.color} transparent opacity={0.8} side={2} />
            </mesh>

            {/* Label */}
            <Text
              position={[radius + 0.3, y, 0]}
              fontSize={0.12}
              color={stage.color}
              anchorX="left"
              anchorY="middle"
            >
              {stage.label}
            </Text>
            <Text
              position={[radius + 0.3, y - 0.18, 0]}
              fontSize={0.15}
              color="#ffffff"
              anchorX="left"
              anchorY="middle"
            >
              {stage.value.toLocaleString()}
            </Text>
            {stage.rate && (
              <Text
                position={[radius + 0.3, y - 0.35, 0]}
                fontSize={0.09}
                color="var(--text-tertiary)"
                anchorX="left"
                anchorY="middle"
              >
                {stage.rate}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Scene({ stages }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 5, 3]} intensity={0.6} color="#6c5ce7" />
      <pointLight position={[-3, -2, 2]} intensity={0.3} color="#00d2ff" />
      <FunnelCone stages={stages} />
    </>
  );
}

export default function Funnel3D({ stages = [
  { label: "Visitors", value: 1000, color: "#6c5ce7", rate: "100%" },
  { label: "Messaged", value: 400, color: "#00d2ff", rate: "40%" },
  { label: "Cart", value: 150, color: "#f8a532", rate: "15%" },
  { label: "Ordered", value: 80, color: "#3ba55c", rate: "8%" },
], height = 320 }) {
  const [webglSupported, setWebglSupported] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebglSupported(!!c.getContext("webgl"));
    } catch (e) { setWebglSupported(false); }
  }, []);

  if (!webglSupported) return null;

  return (
    <div style={{ width: "100%", height, borderRadius: 16, overflow: "hidden", position: "relative" }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <Scene stages={stages} />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
