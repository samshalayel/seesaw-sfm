/**
 * ShowcaseScene.tsx — مشهد 3D سينمائي مع روبوت مودرن
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
      pos[i * 3]     = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    return [pos, col];
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.04;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}

// ── شبكة أرضية ────────────────────────────────────────────────────────────────
function Grid() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.6, 0]}>
      <planeGeometry args={[40, 40, 24, 24]} />
      <meshStandardMaterial color="#0a1628" wireframe emissive="#1a3050" emissiveIntensity={0.25} />
    </mesh>
  );
}

// ── حلقة دوّارة ───────────────────────────────────────────────────────────────
function Ring({ radius, speed, color, tilt = 0 }: { radius: number; speed: number; color: string; tilt?: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * speed;
    ref.current.rotation.x = tilt + Math.sin(clock.getElapsedTime() * 0.3) * 0.05;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.025, 16, 140]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} metalness={1} roughness={0} />
    </mesh>
  );
}

// ── قطع صغيرة تدور ────────────────────────────────────────────────────────────
function OrbitShard({ angle, distance, color, speed }: { angle: number; distance: number; color: string; speed: number }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed + angle;
    ref.current.position.x = Math.cos(t) * distance;
    ref.current.position.z = Math.sin(t) * distance;
    ref.current.position.y = Math.sin(t * 1.3) * 0.4;
    ref.current.rotation.x = t * 0.9;
    ref.current.rotation.y = t * 0.6;
  });
  return (
    <group ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} metalness={0.9} roughness={0.05} />
      </mesh>
    </group>
  );
}

// ── روبوت مودرن ────────────────────────────────────────────────────────────────
const MAT = {
  body:    { color: "#0d1f35", emissive: "#0a2a4a", emissiveIntensity: 0.3, metalness: 0.95, roughness: 0.08 },
  accent:  { color: "#4fc3f7", emissive: "#4fc3f7", emissiveIntensity: 1.4, metalness: 1,    roughness: 0    },
  accent2: { color: "#00ff88", emissive: "#00ff88", emissiveIntensity: 1.6, metalness: 1,    roughness: 0    },
  visor:   { color: "#001a33", emissive: "#00cfff", emissiveIntensity: 0.8, metalness: 0.5,  roughness: 0.1, transparent: true, opacity: 0.85 },
  joint:   { color: "#1a3a5c", emissive: "#1a6080", emissiveIntensity: 0.4, metalness: 1,    roughness: 0.05 },
};

function RobotMat({ type }: { type: keyof typeof MAT }) {
  const m = MAT[type];
  return <meshStandardMaterial {...m} />;
}

/** خط ضوئي رفيع */
function GlowStripe({ w, h, d, pos, color }: { w: number; h: number; d: number; pos: [number, number, number]; color: string }) {
  return (
    <mesh position={pos}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} metalness={1} roughness={0} />
    </mesh>
  );
}

function Robot() {
  const rootRef  = useRef<THREE.Group>(null!);
  const headRef  = useRef<THREE.Group>(null!);
  const lArmRef  = useRef<THREE.Group>(null!);
  const rArmRef  = useRef<THREE.Group>(null!);
  const lLegRef  = useRef<THREE.Group>(null!);
  const rLegRef  = useRef<THREE.Group>(null!);
  const eyeL     = useRef<THREE.Mesh>(null!);
  const eyeR     = useRef<THREE.Mesh>(null!);
  const coreRef  = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // عوم بسيط
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * 0.9) * 0.18;
      rootRef.current.rotation.y = Math.sin(t * 0.25) * 0.35;
    }
    // رأس يتلفت
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.6) * 0.3;
      headRef.current.rotation.x = Math.sin(t * 0.4) * 0.08;
    }
    // ذراعان
    if (lArmRef.current) lArmRef.current.rotation.x = Math.sin(t * 1.1) * 0.25;
    if (rArmRef.current) rArmRef.current.rotation.x = Math.sin(t * 1.1 + Math.PI) * 0.25;
    // أرجل
    if (lLegRef.current) lLegRef.current.rotation.x = Math.sin(t * 0.9) * 0.12;
    if (rLegRef.current) rLegRef.current.rotation.x = Math.sin(t * 0.9 + Math.PI) * 0.12;
    // عيون تنبض
    if (eyeL.current && eyeR.current) {
      const pulse = 0.8 + Math.abs(Math.sin(t * 2.5)) * 0.8;
      (eyeL.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
      (eyeR.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
    // نواة تدور
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 1.5;
      coreRef.current.rotation.z = t * 0.8;
    }
  });

  return (
    <group ref={rootRef} position={[0, 0, 0]}>

      {/* ── الجذع ── */}
      <group position={[0, 0, 0]}>
        {/* صندوق الجسم الرئيسي */}
        <mesh>
          <boxGeometry args={[1.1, 1.4, 0.65]} />
          <RobotMat type="body" />
        </mesh>
        {/* شريط ضوئي جانبي أيسر */}
        <GlowStripe w={0.04} h={1.1} d={0.07} pos={[-0.52, 0.05, 0.3]} color="#4fc3f7" />
        {/* شريط ضوئي جانبي أيمن */}
        <GlowStripe w={0.04} h={1.1} d={0.07} pos={[0.52, 0.05, 0.3]} color="#4fc3f7" />
        {/* خط ضوئي أفقي */}
        <GlowStripe w={0.9} h={0.035} d={0.07} pos={[0, 0.2, 0.33]} color="#00ff88" />
        <GlowStripe w={0.9} h={0.035} d={0.07} pos={[0, -0.15, 0.33]} color="#00ff88" />

        {/* نواة مركزية دوّارة */}
        <mesh ref={coreRef} position={[0, 0.05, 0.34]}>
          <octahedronGeometry args={[0.18]} />
          <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={2} metalness={1} roughness={0} transparent opacity={0.9} />
        </mesh>

        {/* لوحة صدر */}
        <mesh position={[0, -0.35, 0.34]}>
          <boxGeometry args={[0.55, 0.28, 0.02]} />
          <meshStandardMaterial color="#071428" emissive="#0a3060" emissiveIntensity={0.6} metalness={0.8} roughness={0.2} />
        </mesh>
        {/* نقاط حالة صغيرة */}
        {[-0.15, 0, 0.15].map((x, i) => (
          <mesh key={i} position={[x, -0.35, 0.36]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={1.5} />
          </mesh>
        ))}
      </group>

      {/* ── الرقبة ── */}
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.25, 12]} />
        <RobotMat type="joint" />
      </mesh>
      <GlowStripe w={0.28} h={0.04} d={0.04} pos={[0, 0.82, 0.17]} color="#4fc3f7" />

      {/* ── الرأس ── */}
      <group ref={headRef} position={[0, 1.25, 0]}>
        {/* هيكل الرأس */}
        <mesh>
          <boxGeometry args={[0.92, 0.78, 0.72]} />
          <RobotMat type="body" />
        </mesh>

        {/* قناع الوجه / visor */}
        <mesh position={[0, 0.02, 0.34]}>
          <boxGeometry args={[0.72, 0.36, 0.06]} />
          <RobotMat type="visor" />
        </mesh>

        {/* عين يسرى */}
        <mesh ref={eyeL} position={[-0.18, 0.06, 0.38]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color="#00cfff" emissive="#00cfff" emissiveIntensity={1.5} />
        </mesh>
        {/* عين يمنى */}
        <mesh ref={eyeR} position={[0.18, 0.06, 0.38]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color="#00cfff" emissive="#00cfff" emissiveIntensity={1.5} />
        </mesh>

        {/* فم / شريط بيانات */}
        <mesh position={[0, -0.2, 0.37]}>
          <boxGeometry args={[0.42, 0.055, 0.04]} />
          <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
        </mesh>
        {/* أضواء جانبية للرأس */}
        <GlowStripe w={0.04} h={0.55} d={0.06} pos={[-0.44, 0, 0.28]} color="#4fc3f7" />
        <GlowStripe w={0.04} h={0.55} d={0.06} pos={[0.44, 0, 0.28]} color="#4fc3f7" />

        {/* هوائي */}
        <mesh position={[0.28, 0.55, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.38, 8]} />
          <RobotMat type="joint" />
        </mesh>
        <mesh position={[0.28, 0.76, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2.5} />
        </mesh>

        {/* شريط أعلى الرأس */}
        <GlowStripe w={0.7} h={0.04} d={0.06} pos={[0, 0.38, 0.3]} color="#a78bfa" />
      </group>

      {/* ── كتف + ذراع أيسر ── */}
      <group position={[-0.72, 0.3, 0]}>
        {/* كتف */}
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <RobotMat type="joint" />
        </mesh>
        {/* ذراع علوي */}
        <group ref={lArmRef} position={[0, 0, 0]}>
          <mesh position={[-0.07, -0.28, 0]}>
            <boxGeometry args={[0.24, 0.52, 0.22]} />
            <RobotMat type="body" />
          </mesh>
          <GlowStripe w={0.04} h={0.38} d={0.04} pos={[-0.19, -0.28, 0.1]} color="#4fc3f7" />
          {/* مفصل مرفق */}
          <mesh position={[-0.07, -0.56, 0]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <RobotMat type="joint" />
          </mesh>
          {/* ذراع سفلي */}
          <mesh position={[-0.07, -0.88, 0]}>
            <boxGeometry args={[0.2, 0.5, 0.19]} />
            <RobotMat type="body" />
          </mesh>
          {/* يد */}
          <mesh position={[-0.07, -1.18, 0]}>
            <boxGeometry args={[0.26, 0.18, 0.22]} />
            <RobotMat type="joint" />
          </mesh>
          <GlowStripe w={0.22} h={0.04} d={0.04} pos={[-0.07, -1.1, 0.12]} color="#00ff88" />
        </group>
      </group>

      {/* ── كتف + ذراع أيمن ── */}
      <group position={[0.72, 0.3, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <RobotMat type="joint" />
        </mesh>
        <group ref={rArmRef} position={[0, 0, 0]}>
          <mesh position={[0.07, -0.28, 0]}>
            <boxGeometry args={[0.24, 0.52, 0.22]} />
            <RobotMat type="body" />
          </mesh>
          <GlowStripe w={0.04} h={0.38} d={0.04} pos={[0.19, -0.28, 0.1]} color="#4fc3f7" />
          <mesh position={[0.07, -0.56, 0]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <RobotMat type="joint" />
          </mesh>
          <mesh position={[0.07, -0.88, 0]}>
            <boxGeometry args={[0.2, 0.5, 0.19]} />
            <RobotMat type="body" />
          </mesh>
          <mesh position={[0.07, -1.18, 0]}>
            <boxGeometry args={[0.26, 0.18, 0.22]} />
            <RobotMat type="joint" />
          </mesh>
          <GlowStripe w={0.22} h={0.04} d={0.04} pos={[0.07, -1.1, 0.12]} color="#00ff88" />
        </group>
      </group>

      {/* ── الحوض ── */}
      <mesh position={[0, -0.82, 0]}>
        <boxGeometry args={[0.9, 0.22, 0.58]} />
        <RobotMat type="body" />
      </mesh>
      <GlowStripe w={0.75} h={0.04} d={0.06} pos={[0, -0.72, 0.3]} color="#a78bfa" />

      {/* ── ساق يسرى ── */}
      <group ref={lLegRef} position={[-0.3, -0.95, 0]}>
        {/* فخذ */}
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.32, 0.55, 0.3]} />
          <RobotMat type="body" />
        </mesh>
        <GlowStripe w={0.04} h={0.4} d={0.04} pos={[-0.14, -0.3, 0.16]} color="#4fc3f7" />
        {/* ركبة */}
        <mesh position={[0, -0.6, 0]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <RobotMat type="joint" />
        </mesh>
        {/* ساق سفلي */}
        <mesh position={[0, -0.95, 0]}>
          <boxGeometry args={[0.26, 0.62, 0.27]} />
          <RobotMat type="body" />
        </mesh>
        {/* قدم */}
        <mesh position={[0, -1.32, 0.06]}>
          <boxGeometry args={[0.34, 0.16, 0.42]} />
          <RobotMat type="joint" />
        </mesh>
        <GlowStripe w={0.28} h={0.04} d={0.04} pos={[0, -1.24, 0.28]} color="#00ff88" />
      </group>

      {/* ── ساق يمنى ── */}
      <group ref={rLegRef} position={[0.3, -0.95, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.32, 0.55, 0.3]} />
          <RobotMat type="body" />
        </mesh>
        <GlowStripe w={0.04} h={0.4} d={0.04} pos={[0.14, -0.3, 0.16]} color="#4fc3f7" />
        <mesh position={[0, -0.6, 0]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <RobotMat type="joint" />
        </mesh>
        <mesh position={[0, -0.95, 0]}>
          <boxGeometry args={[0.26, 0.62, 0.27]} />
          <RobotMat type="body" />
        </mesh>
        <mesh position={[0, -1.32, 0.06]}>
          <boxGeometry args={[0.34, 0.16, 0.42]} />
          <RobotMat type="joint" />
        </mesh>
        <GlowStripe w={0.28} h={0.04} d={0.04} pos={[0, -1.24, 0.28]} color="#00ff88" />
      </group>

    </group>
  );
}

// ── المشهد ─────────────────────────────────────────────────────────────────────
function Scene() {
  return (
    <>
      {/* إضاءة */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 6, 4]}  intensity={60}  color="#4fc3f7" />
      <pointLight position={[-4, 2, 2]} intensity={35}  color="#a78bfa" />
      <pointLight position={[4, 2, 2]}  intensity={30}  color="#00ff88" />
      <pointLight position={[0, -2, 0]} intensity={25}  color="#1a6080" />
      {/* ضوء يلمع على وجه الروبوت */}
      <spotLight
        position={[0, 5, 5]}
        angle={0.35}
        penumbra={0.5}
        intensity={80}
        color="#cceeff"
        target-position={[0, 0, 0]}
      />

      <Stars radius={80} depth={50} count={1200} factor={3} fade speed={0.4} />
      <Particles />
      <Grid />

      {/* الروبوت في وسط المشهد — مرفوع قليلاً */}
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.3}>
        <group position={[0, -0.5, 0]}>
          <Robot />
        </group>
      </Float>

      {/* حلقات تدور حول الروبوت */}
      <Ring radius={2.6}  speed={0.5}  color="#4fc3f7" tilt={Math.PI * 0.15} />
      <Ring radius={3.2}  speed={-0.35} color="#a78bfa" tilt={Math.PI * 0.4} />
      <Ring radius={3.9}  speed={0.28}  color="#00ff88" tilt={Math.PI * 0.65} />

      {/* قطع تدور */}
      <OrbitShard angle={0}             distance={5} color="#4fc3f7" speed={0.45} />
      <OrbitShard angle={Math.PI * 0.5} distance={5} color="#f59e0b" speed={0.45} />
      <OrbitShard angle={Math.PI}       distance={5} color="#a78bfa" speed={0.45} />
      <OrbitShard angle={Math.PI * 1.5} distance={5} color="#00ff88" speed={0.45} />
      <OrbitShard angle={Math.PI * 0.25} distance={4.2} color="#f87171" speed={0.6} />
      <OrbitShard angle={Math.PI * 0.75} distance={4.2} color="#fbbf24" speed={0.6} />

      <OrbitControls
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI * 0.72}
        minPolarAngle={Math.PI * 0.22}
      />

      <EffectComposer>
        <Bloom intensity={2.2} luminanceThreshold={0.12} luminanceSmoothing={0.9} />
        <Vignette offset={0.3} darkness={0.7} />
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
        camera={{ position: [0, 1.5, 8], fov: 52 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5 }}
      >
        <Scene />
      </Canvas>

      {/* عنوان فوق */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 34,
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: "#e0e8ff", letterSpacing: 8, fontFamily: "Inter, sans-serif" }}>
          SILLAR
        </div>
        <div style={{ fontSize: 12, color: "#4fc3f7", letterSpacing: 4, marginTop: 6, opacity: 0.8, fontFamily: "Inter, sans-serif" }}>
          DIGITAL OFFICE · AI WORKFORCE
        </div>
      </div>

      {/* زر الدخول */}
      <button
        onClick={() => setAppMode("classic")}
        style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          padding: "14px 48px",
          background: "rgba(79,195,247,0.08)",
          border: "1px solid rgba(79,195,247,0.45)",
          borderRadius: 14, color: "#4fc3f7", fontSize: 15,
          cursor: "pointer", letterSpacing: 2,
          backdropFilter: "blur(12px)",
          fontFamily: "Inter, sans-serif",
          transition: "all 0.25s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(79,195,247,0.22)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 32px rgba(79,195,247,0.35)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(79,195,247,0.08)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        ← دخول المكتب الرقمي
      </button>

      {/* Showcase label */}
      <div style={{
        position: "absolute", top: 20, right: 24,
        color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: 3,
        fontFamily: "Inter, sans-serif", textTransform: "uppercase",
      }}>
        Showcase · Three.js + WebGL
      </div>
    </div>
  );
}
