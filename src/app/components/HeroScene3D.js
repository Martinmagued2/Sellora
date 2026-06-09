"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";

/* ─── ChatBubble ─── floating speech-bubble shape */
function ChatBubble({ position = [0, 0, 0], color = "#5865F2", scale = 1 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh ref={meshRef} position={position} scale={scale}>
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
function GlowOrb({ position = [0, 0, 0], color = "#00D2FF", scale = 1 }) {
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
      <mesh ref={meshRef} position={position}>
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
      [-2.5, 1.2, -1],
      [2.8, -0.8, 0.5],
      [0, 2.2, -0.5],
      [-1.5, -1.5, 0.8],
      [1.8, 1.5, -1.2],
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

/* ─── Orb ─── larger central decorative orb */
function Orb({ position = [0, 0, 0], color = "#5865F2", scale = 1 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  return (
    <Float speed={1} rotationIntensity={0.3} floatIntensity={0.5}>
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

      {/* Central decorative orb */}
      <Orb position={[0, 0, 0]} color="#5865F2" scale={1.8} />
      <Orb position={[2.5, 1.2, -1]} color="#00D2FF" scale={0.8} />

      {/* Chat bubbles */}
      <ChatBubble position={[-2.5, 1.5, 0.5]} color="#5865F2" scale={0.6} />
      <ChatBubble position={[2, -1, 0.8]} color="#00D2FF" scale={0.5} />
      <ChatBubble position={[-1, -1.5, -0.3]} color="#5865F2" scale={0.45} />
      <ChatBubble position={[1.5, 2, -0.5]} color="#00D2FF" scale={0.55} />

      {/* Glow orbs */}
      <GlowOrb position={[-3, 0, 1]} color="#00D2FF" scale={0.7} />
      <GlowOrb position={[3, 0.5, -0.5]} color="#5865F2" scale={0.6} />
      <GlowOrb position={[0, -2, 1.5]} color="#00D2FF" scale={0.5} />

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
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
