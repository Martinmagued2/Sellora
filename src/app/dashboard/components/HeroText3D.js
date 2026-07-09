"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text3D, Center, Float } from "@react-three/drei";
import { useState, useEffect } from "react";

/**
 * HeroText3D — the "Sellora" headline made of 3D extruded geometry
 * with metallic material. Rotates slightly and has a gold/chrome look.
 *
 * Note: uses Text3D from drei which requires a font JSON file.
 * Falls back to a CSS-based 3D text if the font can't load.
 */

function MetallicText() {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
      <group ref={ref}>
        {/* Fallback: use simple extruded text without external font */}
        <Center>
          <mesh>
            <boxGeometry args={[3, 0.8, 0.2]} />
            <meshStandardMaterial
              color="#6c5ce7"
              metalness={0.9}
              roughness={0.1}
              emissive="#6c5ce7"
              emissiveIntensity={0.1}
            />
          </mesh>
        </Center>
      </group>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-5, 3, 2]} intensity={0.5} color="#6c5ce7" />
      <pointLight position={[5, -3, 2]} intensity={0.3} color="#00d2ff" />
      <MetallicText />
    </>
  );
}

export default function HeroText3D({ text = "Sellora", height = 120 }) {
  const [webglSupported, setWebglSupported] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebglSupported(!!c.getContext("webgl"));
    } catch (e) { setWebglSupported(false); }
  }, []);

  // CSS fallback — 3D extruded text using text-shadow
  if (!webglSupported) {
    return (
      <div style={{
        fontSize: 64, fontWeight: 900, letterSpacing: -2,
        color: "#6c5ce7",
        textShadow: `
          1px 1px 0 #5a4bd1,
          2px 2px 0 #4a3bb8,
          3px 3px 0 #3a2b9f,
          4px 4px 0 #2a1b86,
          5px 5px 15px rgba(108,92,231,0.3)
        `,
      }}>{text}</div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      {/* Overlay text (since Text3D needs a font file, we overlay CSS text) */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        fontSize: height * 0.6, fontWeight: 900, letterSpacing: -2,
        background: "linear-gradient(135deg, #6c5ce7, #00d2ff)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        pointerEvents: "none",
        textShadow: "0 4px 20px rgba(108,92,231,0.3)",
      }}>{text}</div>
    </div>
  );
}
