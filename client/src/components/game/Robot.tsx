import * as THREE from "three";
import { useRef, memo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useGame } from "@/lib/stores/useGame";
import { useChat } from "@/lib/stores/useChat";

interface RobotProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  robotId: string;
  label?: string;
}

export const Robot = memo(function Robot({
  position,
  rotation = [0, 0, 0],
  color = "#4fc3f7",
  robotId,
  label: labelProp,
}: RobotProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const bodyRef     = useRef<THREE.Group>(null);
  const headRef     = useRef<THREE.Group>(null);
  const eyeMatL     = useRef<THREE.MeshStandardMaterial>(null);
  const eyeMatR     = useRef<THREE.MeshStandardMaterial>(null);
  const antennaRef  = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const waveStartRef = useRef<number | null>(null);

  const label = labelProp || robotId;
  const isExteriorView = useGame((s) => s.isExteriorView);
  const wavingRobotId  = useChat((s) => s.wavingRobotId);
  const [isNear, setIsNear] = useState(false);

  // ── animations ──────────────────────────────────────────────────────────────
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const s = Math.sin(t * 1.6);

    // ── تحقق من قرب الكاميرا (تظهر الشارة عند < 4 وحدات) ──────────────────
    if (groupRef.current) {
      const dist = camera.position.distanceTo(groupRef.current.getWorldPosition(new THREE.Vector3()));
      setIsNear(dist < 4);
    }

    // جسم — نفَس خفيف
    if (bodyRef.current) {
      bodyRef.current.position.y = s * 0.012;
    }
    // رأس — دوران طفيف
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.12;
    }
    // عيون — نبض الإضاءة
    const glow = 0.55 + Math.sin(t * 2.4) * 0.35;
    if (eyeMatL.current) eyeMatL.current.emissiveIntensity = glow;
    if (eyeMatR.current) eyeMatR.current.emissiveIntensity = glow;
    // هوائي
    if (antennaRef.current) {
      antennaRef.current.position.y = 1.62 + Math.sin(t * 3.2) * 0.025;
    }

    // ── wave animation ───────────────────────────────────────────────────────
    if (rightArmRef.current) {
      const isWaving = wavingRobotId === robotId;
      if (isWaving && waveStartRef.current === null) {
        waveStartRef.current = t;
      } else if (!isWaving && waveStartRef.current !== null) {
        // انتهى الوقت — تأكد الإنزال اكتمل أو أوقف فوراً
        waveStartRef.current = null;
      }

      if (waveStartRef.current !== null) {
        const elapsed = t - waveStartRef.current;
        const RAISE = 0.35;  // رفع الذراع
        const WAVE  = 1.6;   // تلويح
        const LOWER = 0.35;  // إنزال

        // rz يرفع الذراع: pivot بالكتف → +1.85 = الذراع فوق وشوي لليمين
        const TARGET_Z = 1.85;
        let rz = 0;
        let rx = 0;

        if (elapsed < RAISE) {
          rz = (elapsed / RAISE) * TARGET_Z;
        } else if (elapsed < RAISE + WAVE) {
          const wt = elapsed - RAISE;
          rz = TARGET_Z;
          rx = Math.sin(wt * 9) * 0.32;   // تلويح يمين/يسار
        } else if (elapsed < RAISE + WAVE + LOWER) {
          const lt = elapsed - RAISE - WAVE;
          rz = (1 - lt / LOWER) * TARGET_Z;
        }

        rightArmRef.current.rotation.z = rz;
        rightArmRef.current.rotation.x = rx;
      } else {
        rightArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.x = 0;
      }
    }
  });

  // مواد مشتركة
  const bodyMat  = <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />;
  const plateMat = <meshStandardMaterial color="#3a3a4a" roughness={0.2}  metalness={0.8}  />;
  const accentMat= <meshStandardMaterial color={color}  emissive={color}  emissiveIntensity={0.45} roughness={0.1} metalness={0.3} />;
  const darkMat  = <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6}  />;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={1.35}
           userData={{ robotId }}>

      {/* ── شارة الاسم — تظهر فقط عند الاقتراب ──────────────────────────────── */}
      {!isExteriorView && isNear && (
        <Html position={[0, 2.75, 0]} center distanceFactor={6} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(5,5,15,0.92)",
            color,
            padding: "6px 20px",
            borderRadius: "20px",
            fontSize: "17px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            border: `2px solid ${color}`,
            fontFamily: "monospace",
            letterSpacing: "1.5px",
            boxShadow: `0 0 14px ${color}66`,
            transition: "opacity 0.3s",
          }}>
            ◈ {label}
          </div>
        </Html>
      )}


      {/* ── كرسي مكتبي فاخر ────────────────────────────────────────────────── */}
      <OfficerChair color={color} />

      {/* ── جسم الروبوت (يطفو بهدوء) ─────────────────────────────────────── */}
      <group ref={bodyRef} position={[0, 0.65, 0]}>

        {/* ── الخصر / الوسط ── */}
        <mesh position={[0, 0.30, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.18, 0.18, 12]} />
          {darkMat}
        </mesh>

        {/* ── الجذع ── */}
        <mesh position={[0, 0.52, 0]} castShadow>
          <boxGeometry args={[0.42, 0.38, 0.28]} />
          {bodyMat}
        </mesh>
        {/* لوحة صدرية */}
        <mesh position={[0, 0.54, 0.142]}>
          <boxGeometry args={[0.32, 0.26, 0.008]} />
          {plateMat}
        </mesh>
        {/* شريط لوني على الصدر */}
        <mesh position={[0, 0.62, 0.15]}>
          <boxGeometry args={[0.28, 0.018, 0.006]} />
          {accentMat}
        </mesh>
        <mesh position={[0, 0.44, 0.15]}>
          <boxGeometry args={[0.20, 0.012, 0.006]} />
          {accentMat}
        </mesh>
        {/* شريط جانبي يسار */}
        <mesh position={[-0.21, 0.52, 0]}>
          <boxGeometry args={[0.008, 0.3, 0.24]} />
          {accentMat}
        </mesh>
        {/* شريط جانبي يمين */}
        <mesh position={[0.21, 0.52, 0]}>
          <boxGeometry args={[0.008, 0.3, 0.24]} />
          {accentMat}
        </mesh>

        {/* ── الكتفان ── */}
        {([-1, 1] as number[]).map((side) => (
          <group key={side}>
            <mesh position={[side * 0.27, 0.64, 0]} castShadow>
              <sphereGeometry args={[0.085, 10, 10]} />
              {plateMat}
            </mesh>
            {/* شريط لوني على الكتف */}
            <mesh position={[side * 0.27, 0.72, 0]}>
              <torusGeometry args={[0.085, 0.012, 6, 16]} />
              {accentMat}
            </mesh>
          </group>
        ))}

        {/* ── الذراع الأيسر ── */}
        <group position={[-0.33, 0.52, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.10, 0.34, 0.10]} />
            {bodyMat}
          </mesh>
          {/* ساعد */}
          <mesh position={[0, -0.28, 0.02]} castShadow>
            <boxGeometry args={[0.09, 0.22, 0.09]} />
            {plateMat}
          </mesh>
          {/* يد */}
          <mesh position={[-0.008, -0.44, 0]} castShadow>
            <boxGeometry args={[0.11, 0.10, 0.08]} />
            {darkMat}
          </mesh>
        </group>

        {/* ── الذراع الأيمن — pivot عند الكتف ── */}
        <group ref={rightArmRef} position={[0.33, 0.69, 0]}>
          {/* العضد */}
          <mesh position={[0, -0.17, 0]} castShadow>
            <boxGeometry args={[0.10, 0.34, 0.10]} />
            {bodyMat}
          </mesh>
          {/* الساعد */}
          <mesh position={[0, -0.45, 0.02]} castShadow>
            <boxGeometry args={[0.09, 0.22, 0.09]} />
            {plateMat}
          </mesh>
          {/* اليد */}
          <mesh position={[0.008, -0.61, 0]} castShadow>
            <boxGeometry args={[0.11, 0.10, 0.08]} />
            {darkMat}
          </mesh>
        </group>

        {/* ── الرقبة ── */}
        <mesh position={[0, 0.78, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.10, 0.14, 10]} />
          {darkMat}
        </mesh>

        {/* ── الرأس ── */}
        <group ref={headRef} position={[0, 0.98, 0]}>
          {/* جسم الرأس */}
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.28, 0.28]} />
            {bodyMat}
          </mesh>

          {/* ── شاشة الوجه ── */}
          <mesh position={[0, 0.01, 0.142]}>
            <planeGeometry args={[0.24, 0.18]} />
            <meshStandardMaterial
              color="#040d18"
              emissive="#0a1628"
              emissiveIntensity={0.9}
              roughness={0.05}
            />
          </mesh>

          {/* عين يسار */}
          <mesh position={[-0.07, 0.03, 0.145]}>
            <planeGeometry args={[0.065, 0.055]} />
            <meshStandardMaterial
              ref={eyeMatL}
              color={color}
              emissive={color}
              emissiveIntensity={0.7}
              roughness={0.05}
            />
          </mesh>
          {/* عين يمين */}
          <mesh position={[0.07, 0.03, 0.145]}>
            <planeGeometry args={[0.065, 0.055]} />
            <meshStandardMaterial
              ref={eyeMatR}
              color={color}
              emissive={color}
              emissiveIntensity={0.7}
              roughness={0.05}
            />
          </mesh>
          {/* فم — خط */}
          <mesh position={[0, -0.065, 0.143]}>
            <planeGeometry args={[0.10, 0.012]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
          </mesh>

          {/* شريط لوني على جانبَي الرأس */}
          <mesh position={[-0.162, 0, 0]}>
            <boxGeometry args={[0.008, 0.22, 0.24]} />
            {accentMat}
          </mesh>
          <mesh position={[0.162, 0, 0]}>
            <boxGeometry args={[0.008, 0.22, 0.24]} />
            {accentMat}
          </mesh>

          {/* هوائي */}
          <mesh ref={antennaRef} position={[0, 0.20, 0]} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
            <meshStandardMaterial color="#aaaaaa" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
          </mesh>

          {/* ضوء نقطي من الوجه */}
          <pointLight position={[0, 0, 0.4]} intensity={0.6} color={color} distance={1.4} decay={2} />
        </group>

      </group>{/* end bodyRef */}
    </group>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   كرسي مكتبي فاخر
══════════════════════════════════════════════════════════════════════════ */
function OfficerChair({ color }: { color: string }) {
  const seat  = "#1e1e2e";
  const frame = "#2a2a2a";
  const metal = "#555566";

  return (
    <group>
      {/* ── مسند الظهر ── */}
      <mesh position={[0, 1.02, -0.24]} castShadow>
        <boxGeometry args={[0.46, 0.62, 0.06]} />
        <meshStandardMaterial color={seat} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* دعامة العلوية */}
      <mesh position={[0, 1.34, -0.24]}>
        <boxGeometry args={[0.46, 0.04, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.2} />
      </mesh>
      {/* لوجو / شريط سفلي */}
      <mesh position={[0, 0.72, -0.22]}>
        <boxGeometry args={[0.36, 0.03, 0.055]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>

      {/* ── المقعد ── */}
      <mesh position={[0, 0.50, 0.04]} castShadow>
        <boxGeometry args={[0.50, 0.055, 0.48]} />
        <meshStandardMaterial color={seat} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* ── مسندا الذراعين ── */}
      {([-1, 1] as number[]).map((s) => (
        <group key={s} position={[s * 0.27, 0, 0]}>
          {/* عمود عمودي */}
          <mesh position={[0, 0.44, -0.05]} castShadow>
            <boxGeometry args={[0.025, 0.36, 0.025]} />
            <meshStandardMaterial color={metal} metalness={0.85} roughness={0.15} />
          </mesh>
          {/* وسادة أفقية */}
          <mesh position={[0, 0.62, 0.07]} castShadow>
            <boxGeometry args={[0.04, 0.022, 0.22]} />
            <meshStandardMaterial color={seat} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ── العمود الهيدروليكي ── */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.042, 0.44, 10]} />
        <meshStandardMaterial color={metal} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* ── القاعدة النجمية (5 أذرع) ── */}
      {Array.from({ length: 5 }).map((_, i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[0.22, 0.03, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.38, 0.03, 0.055]} />
              <meshStandardMaterial color={frame} metalness={0.8} roughness={0.2} />
            </mesh>
            {/* عجلة */}
            <mesh position={[0.40, 0.04, 0]}>
              <cylinderGeometry args={[0.028, 0.028, 0.055, 8]} />
              <meshStandardMaterial color="#111" roughness={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
