"use client";

import { useRef, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Tube } from "@react-three/drei";
import * as THREE from "three";
import { useState, useEffect } from "react";

/**
 * OrderPipeline3D — orders flow through a 3D tube from "pending" to "delivered".
 * Each status is a station along the tube, with glowing dots flowing between them.
 */

const STAGES = [
  { id: "pending", label: "Pending", color: "#f8a532", position: [-3, 0, 0] },
  { id: "confirmed", label: "Confirmed", color: "#5865f2", position: [-1, 0.3, 0] },
  { id: "shipped", label: "Shipped", color: "#00d2ff", position: [1, 0.3, 0] },
  { id: "delivered", label: "Delivered", color: "#3ba55c", position: [3, 0, 0] },
];

function FlowingDot({ path, color, speed = 0.3, offset = 0 }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      const t = ((state.clock.elapsedTime * speed + offset) % 1);
      const point = path.getPointAt(t);
      ref.current.position.copy(point);
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function PipelineTube({ start, end, color }) {
  const curve = useMemo(() => {
    const startV = new THREE.Vector3(...start);
    const endV = new THREE.Vector3(...end);
    const mid = new THREE.Vector3(
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2 + 0.5,
      0
    );
    return new THREE.CatmullRomCurve3([startV, mid, endV]);
  }, [start, end]);

  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 64, 0.03, 8, false);
  }, [curve]);

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
      {/* Flowing dots */}
      {[0, 0.25, 0.5, 0.75].map((offset, i) => (
        <FlowingDot key={i} path={curve} color={color} speed={0.2} offset={offset} />
      ))}
    </>
  );
}

function StageNode({ stage, count, total }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <group position={stage.position}>
      {/* Glowing sphere */}
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial
          color={stage.color}
          emissive={stage.color}
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color={stage.color} transparent opacity={0.08} />
      </mesh>
      {/* Label */}
      <Text position={[0, -0.55, 0]} fontSize={0.16} color="#ffffff" anchorX="center" anchorY="middle">
        {stage.label}
      </Text>
      {/* Count */}
      <Text position={[0, 0.5, 0]} fontSize={0.22} color={stage.color} anchorX="center" anchorY="middle" fontWeight="bold">
        {String(count || 0)}
      </Text>
    </group>
  );
}

function Scene({ orderCounts }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 3]} intensity={0.5} color="#6c5ce7" />
      <pointLight position={[0, -3, 2]} intensity={0.3} color="#00d2ff" />

      {/* Pipeline tubes between stages */}
      <PipelineTube start={STAGES[0].position} end={STAGES[1].position} color="#f8a532" />
      <PipelineTube start={STAGES[1].position} end={STAGES[2].position} color="#5865f2" />
      <PipelineTube start={STAGES[2].position} end={STAGES[3].position} color="#00d2ff" />

      {/* Stage nodes */}
      {STAGES.map((stage, i) => (
        <StageNode key={stage.id} stage={stage} count={orderCounts?.[stage.id] || 0} />
      ))}
    </>
  );
}

export default function OrderPipeline3D({ orderCounts, height = 220 }) {
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
      <Canvas camera={{ position: [0, 1, 6], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <Scene orderCounts={orderCounts} />
        </Suspense>
      </Canvas>
      <div style={{ position: "absolute", top: 12, left: 12, pointerEvents: "none" }}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }}>
          Order Pipeline
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Watch orders flow through your funnel</div>
      </div>
    </div>
  );
}
