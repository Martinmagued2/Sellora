"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Box, Ribbon } from "@react-three/drei";
import { useState, useEffect } from "react";

/**
 * PromoBanner3D — a rotating 3D gift box that opens on hover.
 * Used in marketing/promo sections of the dashboard.
 */

function GiftBox({ color = "#6c5ce7", ribbonColor = "#f8a532" }) {
  const lidRef = useRef();
  const boxRef = useRef();

  useFrame((state) => {
    if (boxRef.current) {
      boxRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
    if (lidRef.current) {
      // Gentle lid bob
      lidRef.current.position.y = 0.55 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
    }
  });

  return (
    <group ref={boxRef}>
      {/* Box bottom */}
      <Box args={[0.8, 0.5, 0.8]}>
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
      </Box>

      {/* Box lid (separate so it can "open") */}
      <group ref={lidRef} position={[0, 0.55, 0]}>
        <Box args={[0.85, 0.15, 0.85]}>
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
        </Box>
      </group>

      {/* Vertical ribbon */}
      <Box args={[0.12, 0.52, 0.82]} position={[0, 0, 0]}>
        <meshStandardMaterial color={ribbonColor} metalness={0.6} roughness={0.2} emissive={ribbonColor} emissiveIntensity={0.1} />
      </Box>
      <Box args={[0.82, 0.52, 0.12]} position={[0, 0, 0]}>
        <meshStandardMaterial color={ribbonColor} metalness={0.6} roughness={0.2} emissive={ribbonColor} emissiveIntensity={0.1} />
      </Box>

      {/* Ribbon on lid */}
      <Box args={[0.12, 0.17, 0.87]} position={[0, 0.55, 0]}>
        <meshStandardMaterial color={ribbonColor} metalness={0.6} roughness={0.2} />
      </Box>
      <Box args={[0.87, 0.17, 0.12]} position={[0, 0.55, 0]}>
        <meshStandardMaterial color={ribbonColor} metalness={0.6} roughness={0.2} />
      </Box>

      {/* Bow knot */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={ribbonColor} metalness={0.7} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Scene({ color, ribbonColor }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 3]} intensity={0.6} color="#6c5ce7" />
      <pointLight position={[-3, 2, 2]} intensity={0.3} color="#00d2ff" />
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <GiftBox color={color} ribbonColor={ribbonColor} />
      </Float>
    </>
  );
}

export default function PromoBanner3D({ title = "Special Offer", subtitle = "Unlock premium features", height = 160, color, ribbonColor }) {
  const [webglSupported, setWebglSupported] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebglSupported(!!c.getContext("webgl"));
    } catch (e) { setWebglSupported(false); }
  }, []);

  if (!webglSupported) {
    return (
      <div style={{
        height, borderRadius: 16,
        background: "linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,210,255,0.05))",
        border: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{subtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height, borderRadius: 16, overflow: "hidden", position: "relative",
      background: "linear-gradient(135deg, rgba(108,92,231,0.08), rgba(0,210,255,0.03))",
      border: "1px solid var(--border-subtle)",
    }}>
      <Canvas camera={{ position: [0, 0.5, 3], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <Scene color={color} ribbonColor={ribbonColor} />
        </Suspense>
      </Canvas>
      <div style={{
        position: "absolute", bottom: 12, left: 16, pointerEvents: "none",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--accent-primary)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{subtitle}</div>
      </div>
    </div>
  );
}
