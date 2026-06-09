"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";

/* ─── AnimatedSphere ─── a sphere that gently bobs up and down */
function AnimatedSphere({
  position = [0, 0, 0],
  color = "#5865F2",
  radius = 0.5,
  scale = 1,
  bobSpeed = 1,
  bobAmount = 0.3,
  rotateSpeed = 0.2,
  distort = 0.2,
  emissive = false,
  opacity = 0.7,
}) {
  const meshRef = useRef();
  const basePos = useRef(position);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Gentle bobbing motion
    meshRef.current.position.x = basePos.current[0] + Math.sin(t * bobSpeed * 0.7) * bobAmount * 0.3;
    meshRef.current.position.y = basePos.current[1] + Math.sin(t * bobSpeed) * bobAmount;
    meshRef.current.position.z = basePos.current[2] + Math.cos(t * bobSpeed * 0.5) * bobAmount * 0.2;
    // Slow rotation
    meshRef.current.rotation.y = t * rotateSpeed;
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <sphereGeometry args={[radius, 32, 32]} />
      {emissive ? (
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          roughness={0.2}
          metalness={0.1}
          transparent
          opacity={opacity}
        />
      ) : (
        <MeshDistortMaterial
          color={color}
          speed={3}
          distort={distort}
          roughness={0.3}
          metalness={0.6}
          transparent
          opacity={opacity}
        />
      )}
    </mesh>
  );
}

/* ─── AnimatedIcosahedron ─── a larger decorative shape */
function AnimatedIcosahedron({
  position = [0, 0, 0],
  color = "#5865F2",
  scale = 1,
  bobSpeed = 0.8,
  bobAmount = 0.25,
  rotateSpeed = 0.1,
}) {
  const meshRef = useRef();
  const basePos = useRef(position);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.x = basePos.current[0] + Math.sin(t * bobSpeed * 0.5) * bobAmount * 0.2;
    meshRef.current.position.y = basePos.current[1] + Math.sin(t * bobSpeed) * bobAmount;
    meshRef.current.position.z = basePos.current[2];
    meshRef.current.rotation.y = t * rotateSpeed;
    meshRef.current.rotation.z = Math.sin(t * 0.2) * 0.05;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 4]} />
      <MeshDistortMaterial
        color={color}
        speed={2}
        distort={0.3}
        roughness={0.4}
        metalness={0.7}
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

/* ─── NetworkLines ─── subtle connection lines between nodes */
function NetworkLines() {
  const linesRef = useRef();

  const points = useMemo(
    () => [
      [-5, 2.5, -1],
      [6, -2, 0.5],
      [0, 4, -0.5],
      [-3, -3, 0.8],
      [4, 3, -1.2],
    ],
    []
  );

  const linePositions = useMemo(() => {
    const positions = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        positions.push(...points[i], ...points[j]);
      }
    }
    return new Float32Array(positions);
  }, [points]);

  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <group ref={linesRef}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePositions.length / 3}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#5865F2" transparent opacity={0.12} />
      </lineSegments>
    </group>
  );
}

/* ─── Scene ─── all 3D objects & lights, widely spread */
function Scene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[8, 6, 5]} intensity={1.2} color="#5865F2" />
      <pointLight position={[-6, -4, 3]} intensity={0.8} color="#00D2FF" />
      <pointLight position={[0, 8, -5]} intensity={0.5} color="#5865F2" />
      <pointLight position={[-3, 0, 4]} intensity={0.4} color="#00D2FF" />

      {/* ── LARGE ORBS ── */}

      {/* Main orb — right side, center */}
      <AnimatedIcosahedron
        position={[4.5, 0.5, -1]}
        color="#5865F2"
        scale={2}
        bobSpeed={0.6}
        bobAmount={0.2}
        rotateSpeed={0.08}
      />

      {/* Secondary orb — upper right */}
      <AnimatedIcosahedron
        position={[7, 2.5, -2]}
        color="#00D2FF"
        scale={1.2}
        bobSpeed={0.9}
        bobAmount={0.25}
        rotateSpeed={0.12}
      />

      {/* ── CHAT BUBBLES ── spread across right half */}

      {/* Top-right bubble */}
      <AnimatedSphere
        position={[6, 3.5, 0.5]}
        color="#5865F2"
        radius={0.5}
        scale={0.7}
        bobSpeed={1.2}
        bobAmount={0.35}
        rotateSpeed={0.15}
        distort={0.25}
        opacity={0.65}
      />

      {/* Mid-right bubble */}
      <AnimatedSphere
        position={[8, -0.5, 0.3]}
        color="#00D2FF"
        radius={0.5}
        scale={0.6}
        bobSpeed={1.5}
        bobAmount={0.3}
        rotateSpeed={0.2}
        distort={0.2}
        opacity={0.6}
      />

      {/* Lower-right bubble */}
      <AnimatedSphere
        position={[3, -2.5, 0.5]}
        color="#5865F2"
        radius={0.5}
        scale={0.5}
        bobSpeed={1.8}
        bobAmount={0.4}
        rotateSpeed={0.18}
        distort={0.15}
        opacity={0.55}
      />

      {/* Far-right top bubble */}
      <AnimatedSphere
        position={[5.5, 1.5, -0.5]}
        color="#00D2FF"
        radius={0.5}
        scale={0.55}
        bobSpeed={1.3}
        bobAmount={0.3}
        rotateSpeed={0.16}
        distort={0.22}
        opacity={0.6}
      />

      {/* ── GLOW ORBS ── scattered around periphery */}

      {/* Upper-left glow */}
      <AnimatedSphere
        position={[-5.5, 2.5, 1]}
        color="#00D2FF"
        radius={0.35}
        scale={0.8}
        bobSpeed={1.4}
        bobAmount={0.25}
        rotateSpeed={0.1}
        emissive
        opacity={0.45}
      />

      {/* Far-right glow */}
      <AnimatedSphere
        position={[9, 1, -1]}
        color="#5865F2"
        radius={0.35}
        scale={0.7}
        bobSpeed={1.1}
        bobAmount={0.2}
        rotateSpeed={0.08}
        emissive
        opacity={0.4}
      />

      {/* Bottom-left glow */}
      <AnimatedSphere
        position={[-3, -3, 1.5]}
        color="#00D2FF"
        radius={0.35}
        scale={0.6}
        bobSpeed={1.6}
        bobAmount={0.35}
        rotateSpeed={0.12}
        emissive
        opacity={0.35}
      />

      {/* Top-left glow */}
      <AnimatedSphere
        position={[-6.5, 0, -1]}
        color="#5865F2"
        radius={0.35}
        scale={0.65}
        bobSpeed={1.0}
        bobAmount={0.28}
        rotateSpeed={0.09}
        emissive
        opacity={0.4}
      />

      {/* Bottom-right glow */}
      <AnimatedSphere
        position={[6, -3, 0.5]}
        color="#00D2FF"
        radius={0.35}
        scale={0.55}
        bobSpeed={1.7}
        bobAmount={0.32}
        rotateSpeed={0.14}
        emissive
        opacity={0.38}
      />

      {/* ── NETWORK LINES ── */}
      <NetworkLines />
    </>
  );
}

/* ─── HeroScene3D ─── exported canvas wrapper */
export default function HeroScene3D() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
