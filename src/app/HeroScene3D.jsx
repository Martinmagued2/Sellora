"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";

function ChatBubble({ position, scale, color, speed, distort }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.1;
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * speed * 0.2) * 0.15;
    }
  });

  return (
    <Float speed={speed} rotationIntensity={0.3} floatIntensity={1.5}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <sphereGeometry args={[1, 32, 32]} />
        <MeshDistortMaterial
          color={color}
          transparent
          opacity={0.15}
          distort={distort}
          speed={2}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
    </Float>
  );
}

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

function FloatingParticles() {
  const particlesRef = useRef();
  const count = 60;

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      position: [
        (seededRandom(i * 5 + 1) - 0.5) * 20,
        (seededRandom(i * 5 + 2) - 0.5) * 14,
        (seededRandom(i * 5 + 3) - 0.5) * 10,
      ],
      scale: seededRandom(i * 5 + 4) * 0.06 + 0.02,
      speed: seededRandom(i * 5 + 5) * 0.5 + 0.2,
    }));
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <group ref={particlesRef}>
      {particles.map((p, i) => (
        <Float key={i} speed={p.speed} floatIntensity={0.5}>
          <mesh position={p.position} scale={p.scale}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? "#5865F2" : "#00D2FF"}
              transparent
              opacity={0.6}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function ConnectionLines() {
  const linesRef = useRef();

  const connections = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      pts.push({
        start: [
          (seededRandom(100 + i * 6 + 1) - 0.5) * 16,
          (seededRandom(100 + i * 6 + 2) - 0.5) * 10,
          (seededRandom(100 + i * 6 + 3) - 0.5) * 6,
        ],
        end: [
          (seededRandom(100 + i * 6 + 4) - 0.5) * 16,
          (seededRandom(100 + i * 6 + 5) - 0.5) * 10,
          (seededRandom(100 + i * 6 + 6) - 0.5) * 6,
        ],
      });
    }
    return pts;
  }, []);

  return (
    <group ref={linesRef}>
      {connections.map((c, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([...c.start, ...c.end])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={i % 2 === 0 ? "#5865F2" : "#00D2FF"}
            transparent
            opacity={0.08}
          />
        </line>
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#5865F2" />
      <pointLight position={[-10, -5, 5]} intensity={0.3} color="#00D2FF" />
      <pointLight position={[0, -10, 5]} intensity={0.2} color="#5865F2" />

      {/* Floating glass-morphic chat bubbles */}
      <ChatBubble position={[-5, 2, -3]} scale={1.2} color="#5865F2" speed={1.5} distort={0.4} />
      <ChatBubble position={[5, -1, -4]} scale={0.9} color="#00D2FF" speed={1.2} distort={0.3} />
      <ChatBubble position={[-3, -2, -2]} scale={0.7} color="#00D2FF" speed={1.8} distort={0.35} />
      <ChatBubble position={[3, 3, -5]} scale={1.0} color="#5865F2" speed={1.0} distort={0.25} />
      <ChatBubble position={[0, -3, -3]} scale={0.8} color="#5865F2" speed={1.6} distort={0.3} />
      <ChatBubble position={[-4, 0, -6]} scale={1.1} color="#00D2FF" speed={1.3} distort={0.4} />

      <FloatingParticles />
      <ConnectionLines />
    </>
  );
}

export default function HeroScene3D() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
