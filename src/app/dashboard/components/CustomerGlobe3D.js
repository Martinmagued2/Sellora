"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Sphere } from "@react-three/drei";
import { useState, useEffect, useMemo } from "react";

/**
 * CustomerGlobe3D — a rotating wireframe globe with glowing dots
 * representing customer locations.
 *
 * Uses simple latitude/longitude → 3D coordinates conversion.
 * If no locations are provided, generates random points on the globe.
 */

function latLonToVec3(lat, lon, radius = 1.5) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function Globe({ customers }) {
  const globeRef = useRef();
  const dotsRef = useRef();

  // Generate customer positions (random if no real data)
  const points = useMemo(() => {
    if (customers && customers.length > 0) {
      return customers.map(c => {
        const lat = c.lat || (Math.random() - 0.5) * 140;
        const lon = c.lon || (Math.random() - 0.5) * 360;
        return latLonToVec3(lat, lon, 1.52);
      });
    }
    // Default: random points clustered around MENA region
    return Array.from({ length: 20 }, () => {
      const lat = 15 + Math.random() * 35; // 15-50 (MENA range)
      const lon = -10 + Math.random() * 60; // -10 to 50
      return latLonToVec3(lat, lon, 1.52);
    });
  }, [customers]);

  useFrame((state) => {
    if (globeRef.current) {
      globeRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
    if (dotsRef.current) {
      dotsRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  // Generate wireframe lines (latitude + longitude)
  const wireframeLines = useMemo(() => {
    const lines = [];
    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lon = 0; lon <= 360; lon += 10) {
        points.push(latLonToVec3(lat, lon, 1.5));
      }
      lines.push(points);
    }
    // Longitude lines
    for (let lon = 0; lon < 360; lon += 30) {
      const points = [];
      for (let lat = -80; lat <= 80; lat += 10) {
        points.push(latLonToVec3(lat, lon, 1.5));
      }
      lines.push(points);
    }
    return lines;
  }, []);

  return (
    <group>
      {/* Wireframe globe */}
      <group ref={globeRef}>
        {wireframeLines.map((line, i) => (
          <Line key={i} points={line} color="#6c5ce7" lineWidth={0.5} opacity={0.15} transparent />
        ))}
        {/* Solid inner sphere (dark) */}
        <mesh>
          <sphereGeometry args={[1.48, 32, 32]} />
          <meshBasicMaterial color="#0a0a15" transparent opacity={0.9} />
        </mesh>
        {/* Glow */}
        <mesh>
          <sphereGeometry args={[1.55, 32, 32]} />
          <meshBasicMaterial color="#6c5ce7" transparent opacity={0.05} />
        </mesh>
      </group>

      {/* Customer dots */}
      <group ref={dotsRef}>
        {points.map((pos, i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#00d2ff" : i % 3 === 1 ? "#6c5ce7" : "#3ba55c"} />
          </mesh>
        ))}
        {/* Pulsing rings on a few dots */}
        {points.slice(0, 5).map((pos, i) => (
          <PulseRing key={`pulse-${i}`} position={pos} color="#00d2ff" delay={i * 0.3} />
        ))}
      </group>
    </group>
  );
}

function PulseRing({ position, color, delay = 0 }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      const t = (state.clock.elapsedTime + delay) % 2;
      const scale = 1 + t * 2;
      ref.current.scale.set(scale, scale, scale);
      ref.current.material.opacity = Math.max(0, 0.5 - t * 0.25);
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[0.04, 0.06, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} side={2} />
    </mesh>
  );
}

export default function CustomerGlobe3D({ customers, height = 280 }) {
  const [webglSupported, setWebglSupported] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl");
      setWebglSupported(!!gl);
    } catch (e) { setWebglSupported(false); }
  }, []);

  if (!webglSupported) return null;

  return (
    <div style={{ width: "100%", height, borderRadius: 16, overflow: "hidden", position: "relative" }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={0.4} color="#6c5ce7" />
        <Suspense fallback={null}>
          <Globe customers={customers} />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} rotateSpeed={0.5} />
      </Canvas>
      <div style={{
        position: "absolute", top: 12, left: 12, pointerEvents: "none",
      }}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }}>
          Customer Map
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent-primary)" }}>
          {(customers?.length || 20).toLocaleString()} <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>customers</span>
        </div>
      </div>
    </div>
  );
}
