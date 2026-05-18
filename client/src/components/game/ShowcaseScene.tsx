/**
 * ShowcaseScene.tsx — مشهد 3D سينمائي للعرض التقديمي
 */

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";

// ── جسيمات ────────────────────────────────────────────────────────────────────
function Particles() {
  const ref = useRef<THREE.Points>(null!);
  const count = 200;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette: [number, number, number][] = [
      [0.31, 0.76, 1.0],
      [0.0, 1.0, 0.53],
      [1.0, 0.62, 0.0],
      [0.68, 0.36, 1.0],
    ];
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 22;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    return [pos, col];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.09} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}

// ── الكرة المركزية ─────────────────────────────────────────────────────────────
function HeroSphere() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.4;
    ref.current.rotation.z = clock.getElapsedTime() * 0.15;
    ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.2;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.5, 64, 64]} />
      <meshStandardMaterial
        color="#1a6080"
        emissive="#4fc3f7"
        emissiveIntensity={0.5}
        metalness={0.9}
        roughness={0.1}
        wireframe={false}
      />
    </mesh>
  );
}

// ── الحلقة الدوّارة ────────────────────────────────────────────────────────────
function Ring({ radius, speed, color }: { radius: number; speed: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.getElapsedTime() * speed;
    ref.current.rotation.z = clock.getElapsedTime() * speed * 0.5;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.03, 16, 120]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} metalness={1} roughness={0} />
    </mesh>
  );
}

// ── مكعبات تدور حول المركز ────────────────────────────────────────────────────
function OrbitCube({ angle, distance, color, speed }: { angle: number; distance: number; color: string; speed: number }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed + angle;
    ref.current.position.x = Math.cos(t) * distance;
    ref.current.position.z = Math.sin(t) * distance;
    ref.current.rotation.x = t * 0.7;
    ref.current.rotation.y = t * 0.5;
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} metalness={0.8} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ── شبكة أرضية ────────────────────────────────────────────────────────────────
function Grid() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.5, 0]}>
      <planeGeometry args={[30, 30, 20, 20]} />
      <meshStandardMaterial color="#0a1628" wireframe emissive="#1a3050" emissiveIntensity={0.3} />
    </mesh>
  );
}

// ── المشهد ─────────────────────────────────────────────────────────────────────
function Scene() {
  return (
    <>
      {/* إضاءة */}
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 5, 0]}   intensity={50}  color="#4fc3f7" />
      <pointLight position={[5, -1, 5]}  intensity={30}  color="#00ff88" />
      <pointLight position={[-5,-1,-5]}  intensity={30}  color="#f59e0b" />
      <pointLight position={[0, -2, 0]}  intensity={20}  color="#a78bfa" />

      <Stars radius={80} depth={50} count={1000} factor={3} fade speed={0.5} />
      <Particles />
      <Grid />

      <HeroSphere />

      <Ring radius={2.2}  speed={0.7}  color="#4fc3f7" />
      <Ring radius={2.8}  speed={-0.5} color="#00ff88" />
      <Ring radius={3.4}  speed={0.4}  color="#a78bfa" />

      <OrbitCube angle={0}              distance={3.8} color="#00ff88" speed={0.6} />
      <OrbitCube angle={Math.PI / 2}    distance={3.8} color="#f59e0b" speed={0.6} />
      <OrbitCube angle={Math.PI}        distance={3.8} color="#a78bfa" speed={0.6} />
      <OrbitCube angle={Math.PI * 1.5}  distance={3.8} color="#f87171" speed={0.6} />

      <OrbitControls
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.6}
        maxPolarAngle={Math.PI * 0.7}
        minPolarAngle={Math.PI * 0.25}
      />

      <EffectComposer>
        <Bloom intensity={2.5} luminanceThreshold={0.15} luminanceSmoothing={0.85} />
        <Vignette offset={0.35} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

// ── الصفحة ─────────────────────────────────────────────────────────────────────
export function ShowcaseScene() {
  const setAppMode = useGame((s) => s.setAppMode);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#02040f", position: "relative" }}>
      <Canvas
        camera={{ position: [0, 2, 9], fov: 55 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}
      >
        <Scene />
      </Canvas>

      {/* عنوان فوق */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 36,
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: "#e0e8ff", letterSpacing: 8, fontFamily: "Inter, sans-serif" }}>
          SILLAR
        </div>
        <div style={{ fontSize: 12, color: "#4fc3f7", letterSpacing: 4, marginTop: 6, opacity: 0.8, fontFamily: "Inter, sans-serif" }}>
          DIGITAL OFFICE · 3D WORKSPACE
        </div>
      </div>

      {/* زر الدخول */}
      <button
        onClick={() => setAppMode("classic")}
        style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          padding: "14px 44px",
          background: "rgba(79,195,247,0.1)",
          border: "1px solid rgba(79,195,247,0.5)",
          borderRadius: 12, color: "#4fc3f7", fontSize: 15,
          cursor: "pointer", letterSpacing: 2,
          backdropFilter: "blur(10px)",
          fontFamily: "Inter, sans-serif",
          transition: "all 0.2s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(79,195,247,0.25)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(79,195,247,0.3)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(79,195,247,0.1)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        ← دخول المكتب الرقمي
      </button>

      {/* Showcase label */}
      <div style={{
        position: "absolute", top: 20, right: 24,
        color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: 3,
        fontFamily: "Inter, sans-serif", textTransform: "uppercase",
      }}>
        Showcase · Three.js + WebGL
      </div>
    </div>
  );
}
