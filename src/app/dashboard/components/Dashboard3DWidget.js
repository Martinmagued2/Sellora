"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Text, Sphere, Torus, Icosahedron } from "@react-three/drei";
import { useState, useEffect } from "react";

/**
 * Dashboard3DWidget — a premium 3D widget for the dashboard.
 *
 * Shows a rotating 3D scene with:
 * - A central glowing core (represents the store)
 * - Orbiting smaller spheres (represent customers/messages/orders)
 * - Distort material for organic, liquid-metal look
 * - Color shifts based on the metric being displayed
 *
 * Lightweight: ~60fps on modern devices, ~30fps on older ones.
 * Falls back to a static gradient if WebGL is not available.
 */

function CoreSphere({ color = "#6c5ce7" }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 4]} />
      <MeshDistortMaterial
        color={color}
        distort={0.35}
        speed={1.5}
        roughness={0.1}
        metalness={0.8}
        emissive={color}
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

function OrbitingSphere({ radius, speed, offset, color, size = 0.15 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime * speed + offset;
      meshRef.current.position.x = Math.cos(t) * radius;
      meshRef.current.position.z = Math.sin(t) * radius;
      meshRef.current.position.y = Math.sin(t * 2) * 0.3;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        roughness={0.2}
        metalness={0.3}
      />
    </mesh>
  );
}

function OrbitRing({ radius, color = "#6c5ce7", opacity = 0.2 }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.01, 8, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function FloatingLabel({ position, text, color = "#ffffff" }) {
  return (
    <Text
      position={position}
      fontSize={0.25}
      color={color}
      anchorX="center"
      anchorY="middle"
    >
      {text}
    </Text>
  );
}

function Scene({ statValue, statLabel, color }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={0.6} color={color} />
      <pointLight position={[-5, -3, 3]} intensity={0.3} color="#00d2ff" />
      <pointLight position={[0, -5, 2]} intensity={0.2} color={color} />

      {/* Central core — represents the store */}
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <CoreSphere color={color} />
      </Float>

      {/* Orbit rings */}
      <OrbitRing radius={1.8} color={color} opacity={0.15} />
      <OrbitRing radius={2.4} color="#00d2ff" opacity={0.1} />

      {/* Orbiting spheres — represent customers/messages/orders */}
      <OrbitingSphere radius={1.8} speed={0.8} offset={0} color="#00d2ff" size={0.12} />
      <OrbitingSphere radius={1.8} speed={0.8} offset={2.1} color={color} size={0.1} />
      <OrbitingSphere radius={1.8} speed={0.8} offset={4.2} color="#f8a532" size={0.14} />

      <OrbitingSphere radius={2.4} speed={0.5} offset={1} color={color} size={0.08} />
      <OrbitingSphere radius={2.4} speed={0.5} offset={3.5} color="#00d2ff" size={0.09} />
      <OrbitingSphere radius={2.4} speed={0.5} offset={5.5} color="#fd79a8" size={0.07} />
    </>
  );
}

export default function Dashboard3DWidget({ statValue = "0", statLabel = "Revenue", color = "#6c5ce7" }) {
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setWebglSupported(!!gl);
    } catch (e) {
      setWebglSupported(false);
    }
  }, []);

  if (!webglSupported) {
    // Fallback: static gradient card
    return (
      <div style={{
        width: "100%", height: 200, borderRadius: 16,
        background: `linear-gradient(135deg, ${color}30, ${color}10)`,
        border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 8,
      }}>
        <div style={{ fontSize: 32, fontWeight: 900, color }}>{statValue}</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>{statLabel}</div>
      </div>
    );
  }

  return (
    <div style={{
      width: "100%", height: 200, borderRadius: 16, overflow: "hidden",
      position: "relative", background: "linear-gradient(135deg, rgba(108,92,231,0.05), rgba(0,210,255,0.02))",
      border: "1px solid var(--border-subtle)",
    }}>
      <Canvas
        camera={{ position: [0, 1, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene statValue={statValue} statLabel={statLabel} color={color} />
        </Suspense>
      </Canvas>

      {/* Overlay text */}
      <div style={{
        position: "absolute", top: 16, left: 16, zIndex: 2,
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }}>
          {statLabel}
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1.1, marginTop: 4 }}>
          {statValue}
        </div>
      </div>

      {/* Live indicator */}
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 2,
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 12,
        background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.2)",
        fontSize: 10, fontWeight: 700, color: "#00e676", textTransform: "uppercase",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%", background: "#00e676",
          animation: "pulse-dot 2s ease-in-out infinite",
        }} />
        Live
        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.8); }
          }
        `}</style>
      </div>
    </div>
  );
}
