"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";

/* ─── ChatBubble ─── floating speech-bubble shape */
function ChatBubble({ color = "#5865F2", scale = 1 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh ref={meshRef} scale={scale}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <MeshDistortMaterial
          color={color}
          speed={3}
          distort={0.25}
          roughness={0.3}
          metalness={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  );
}

/* ─── GlowOrb ─── soft emissive orb */
function GlowOrb({ color = "#00D2FF", scale = 1 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(
        scale * (1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.08)
      );
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          roughness={0.2}
          metalness={0.1}
          transparent
          opacity={0.5}
        />
      </mesh>
    </Float>
  );
}

/* ─── NetworkLines ─── subtle connection lines between orbs */
function NetworkLines() {
  const linesRef = useRef();

  const points = useMemo(
    () => [
      [-4, 2, -1],
      [4.5, -1.5, 0.5],
      [0, 3.5, -0.5],
      [-2.5, -2.5, 0.8],
      [3, 2.5, -1.2],
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
      linesRef.current.rotation.y = state.clock.elapsedTime * 0.03;
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
        <lineBasicMaterial color="#5865F2" transparent opacity={0.15} />
      </lineSegments>
    </group>
  );
}

/* ─── Orb ─── larger decorative orb */
function Orb({ color = "#5865F2", scale = 1 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  return (
    <Float speed={1} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef} scale={scale}>
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
    </Float>
  );
}

/* ─── Scene ─── all 3D objects & lights */
function Scene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#5865F2" />
      <pointLight position={[-5, -3, 3]} intensity={0.8} color="#00D2FF" />
      <pointLight position={[0, 5, -5]} intensity={0.5} color="#5865F2" />

      {/* Central decorative orb — offset to the right so it doesn't overlap hero text */}
      <group position={[3.5, 0.5, 0]}>
        <Orb color="#5865F2" scale={1.8} />
      </group>

      {/* Secondary orb — upper right */}
      <group position={[5.5, 2, -1]}>
        <Orb color="#00D2FF" scale={0.9} />
      </group>

      {/* Chat bubbles — spread across the right half of the hero */}
      <group position={[4.5, 2.5, 0.5]}>
        <ChatBubble color="#5865F2" scale={0.6} />
      </group>
      <group position={[6, -0.5, 0.8]}>
        <ChatBubble color="#00D2FF" scale={0.5} />
      </group>
      <group position={[2.5, -1.8, -0.3]}>
        <ChatBubble color="#5865F2" scale={0.45} />
      </group>
      <group position={[5, 1, -0.5]}>
        <ChatBubble color="#00D2FF" scale={0.55} />
      </group>

      {/* Glow orbs — scattered around the periphery */}
      <group position={[-4, 1, 1]}>
        <GlowOrb color="#00D2FF" scale={0.7} />
      </group>
      <group position={[7, 0.5, -0.5]}>
        <GlowOrb color="#5865F2" scale={0.6} />
      </group>
      <group position={[1, -3, 1.5]}>
        <GlowOrb color="#00D2FF" scale={0.5} />
      </group>
      <group position={[-2, 3, -1]}>
        <GlowOrb color="#5865F2" scale={0.55} />
      </group>

      {/* Network lines */}
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
        camera={{ position: [0, 0, 8], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
