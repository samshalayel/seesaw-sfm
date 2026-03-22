import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

interface HumanDeveloperProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export function HumanDeveloper({ position, rotation = [0, 0, 0] }: HumanDeveloperProps) {
  const SCALE = 1.4;
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // تنفس خفيف
    if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 1.2) * 0.008;
    // رأس ينظر للشاشة بهدوء
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.5) * 0.06;
      headRef.current.rotation.x = -0.15 + Math.sin(t * 0.3) * 0.02;
    }
  });

  // ألوان البدلة
  const skin    = "#c8926a";
  const suit    = "#1a2540";
  const shirt   = "#e8e8f0";
  const tie     = "#8b1a1a";
  const hair    = "#1a0f00";
  const shoe    = "#111111";

  return (
    <group position={position} rotation={rotation} scale={SCALE}>
      {/* ── كرسي مكتبي ── */}
      <OfficerChair />

      {/* ── الجسم (يتنفس) ── */}
      <group ref={bodyRef}>

        {/* ─── الأرجل (جلوس) ─── */}
        {/* فخذ أيسر */}
        <mesh position={[-0.11, 0.52, 0.20]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.07, 0.38, 8]} />
          <meshStandardMaterial color={suit} roughness={0.7} />
        </mesh>
        {/* فخذ أيمن */}
        <mesh position={[0.11, 0.52, 0.20]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.07, 0.38, 8]} />
          <meshStandardMaterial color={suit} roughness={0.7} />
        </mesh>
        {/* ساق أيسر (منحنية للأسفل) */}
        <mesh position={[-0.11, 0.28, 0.38]} castShadow>
          <cylinderGeometry args={[0.065, 0.06, 0.42, 8]} />
          <meshStandardMaterial color={suit} roughness={0.7} />
        </mesh>
        {/* ساق أيمن */}
        <mesh position={[0.11, 0.28, 0.38]} castShadow>
          <cylinderGeometry args={[0.065, 0.06, 0.42, 8]} />
          <meshStandardMaterial color={suit} roughness={0.7} />
        </mesh>
        {/* حذاء أيسر */}
        <mesh position={[-0.11, 0.07, 0.44]} castShadow>
          <boxGeometry args={[0.11, 0.07, 0.20]} />
          <meshStandardMaterial color={shoe} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* حذاء أيمن */}
        <mesh position={[0.11, 0.07, 0.44]} castShadow>
          <boxGeometry args={[0.11, 0.07, 0.20]} />
          <meshStandardMaterial color={shoe} roughness={0.3} metalness={0.4} />
        </mesh>

        {/* ─── الوسط / الحوض ─── */}
        <mesh position={[0, 0.58, 0.06]} castShadow>
          <boxGeometry args={[0.30, 0.14, 0.26]} />
          <meshStandardMaterial color={suit} roughness={0.6} />
        </mesh>

        {/* ─── الجذع ─── */}
        <mesh position={[0, 0.84, -0.01]} castShadow>
          <boxGeometry args={[0.34, 0.42, 0.22]} />
          <meshStandardMaterial color={suit} roughness={0.5} metalness={0.05} />
        </mesh>
        {/* قميص أبيض (وسط الصدر) */}
        <mesh position={[0, 0.84, 0.112]}>
          <boxGeometry args={[0.10, 0.36, 0.005]} />
          <meshStandardMaterial color={shirt} roughness={0.6} />
        </mesh>
        {/* ربطة عنق */}
        <mesh position={[0, 0.80, 0.116]}>
          <boxGeometry args={[0.04, 0.28, 0.004]} />
          <meshStandardMaterial color={tie} roughness={0.5} />
        </mesh>
        {/* بطن الربطة */}
        <mesh position={[0, 0.68, 0.116]}>
          <boxGeometry args={[0.055, 0.05, 0.004]} />
          <meshStandardMaterial color={tie} roughness={0.5} />
        </mesh>

        {/* ─── الكتفان ─── */}
        <mesh position={[-0.20, 1.04, -0.01]} castShadow>
          <sphereGeometry args={[0.088, 9, 9]} />
          <meshStandardMaterial color={suit} roughness={0.5} />
        </mesh>
        <mesh position={[0.20, 1.04, -0.01]} castShadow>
          <sphereGeometry args={[0.088, 9, 9]} />
          <meshStandardMaterial color={suit} roughness={0.5} />
        </mesh>

        {/* ─── الذراع الأيسر (ممدود نحو الكيبورد) ─── */}
        {/* عضد */}
        <mesh position={[-0.26, 0.90, 0.04]} rotation={[0.3, 0, -0.15]} castShadow>
          <cylinderGeometry args={[0.065, 0.058, 0.30, 8]} />
          <meshStandardMaterial color={suit} roughness={0.5} />
        </mesh>
        {/* ساعد */}
        <mesh position={[-0.28, 0.73, 0.20]} rotation={[1.1, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.055, 0.048, 0.30, 8]} />
          <meshStandardMaterial color={suit} roughness={0.5} />
        </mesh>
        {/* يد */}
        <mesh position={[-0.27, 0.63, 0.38]} castShadow>
          <boxGeometry args={[0.09, 0.06, 0.12]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>

        {/* ─── الذراع الأيمن ─── */}
        <mesh position={[0.26, 0.90, 0.04]} rotation={[0.3, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.065, 0.058, 0.30, 8]} />
          <meshStandardMaterial color={suit} roughness={0.5} />
        </mesh>
        <mesh position={[0.28, 0.73, 0.20]} rotation={[1.1, 0, 0.1]} castShadow>
          <cylinderGeometry args={[0.055, 0.048, 0.30, 8]} />
          <meshStandardMaterial color={suit} roughness={0.5} />
        </mesh>
        <mesh position={[0.27, 0.63, 0.38]} castShadow>
          <boxGeometry args={[0.09, 0.06, 0.12]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>

        {/* ─── الرقبة ─── */}
        <mesh position={[0, 1.09, 0.01]} castShadow>
          <cylinderGeometry args={[0.062, 0.07, 0.12, 10]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>

        {/* ─── الرأس ─── */}
        <group ref={headRef} position={[0, 1.30, 0.02]}>
          {/* جمجمة */}
          <mesh castShadow>
            <boxGeometry args={[0.24, 0.26, 0.22]} />
            <meshStandardMaterial color={skin} roughness={0.65} />
          </mesh>
          {/* شعر */}
          <mesh position={[0, 0.10, -0.01]} castShadow>
            <boxGeometry args={[0.245, 0.10, 0.22]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
          {/* جانب شعر أيسر */}
          <mesh position={[-0.118, 0.03, -0.01]}>
            <boxGeometry args={[0.012, 0.14, 0.20]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
          {/* جانب شعر أيمن */}
          <mesh position={[0.118, 0.03, -0.01]}>
            <boxGeometry args={[0.012, 0.14, 0.20]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>

          {/* حاجب أيسر */}
          <mesh position={[-0.07, 0.07, 0.112]}>
            <boxGeometry args={[0.065, 0.014, 0.005]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
          {/* حاجب أيمن */}
          <mesh position={[0.07, 0.07, 0.112]}>
            <boxGeometry args={[0.065, 0.014, 0.005]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>

          {/* عين أيسر */}
          <mesh position={[-0.07, 0.028, 0.112]}>
            <boxGeometry args={[0.05, 0.035, 0.005]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.2} />
          </mesh>
          {/* بياض العين أيسر */}
          <mesh position={[-0.07, 0.030, 0.111]}>
            <boxGeometry args={[0.052, 0.037, 0.003]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          {/* بؤبؤ أيسر */}
          <mesh position={[-0.07, 0.028, 0.114]}>
            <boxGeometry args={[0.022, 0.022, 0.003]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.2} />
          </mesh>

          {/* عين أيمن */}
          <mesh position={[0.07, 0.028, 0.112]}>
            <boxGeometry args={[0.05, 0.035, 0.005]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.2} />
          </mesh>
          <mesh position={[0.07, 0.030, 0.111]}>
            <boxGeometry args={[0.052, 0.037, 0.003]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[0.07, 0.028, 0.114]}>
            <boxGeometry args={[0.022, 0.022, 0.003]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.2} />
          </mesh>

          {/* أنف */}
          <mesh position={[0, -0.018, 0.118]}>
            <boxGeometry args={[0.022, 0.032, 0.016]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
          </mesh>

          {/* فم */}
          <mesh position={[0, -0.068, 0.113]}>
            <boxGeometry args={[0.06, 0.014, 0.004]} />
            <meshStandardMaterial color="#8b4040" roughness={0.5} />
          </mesh>

          {/* أذن أيسر */}
          <mesh position={[-0.122, 0.01, 0]}>
            <boxGeometry args={[0.018, 0.05, 0.04]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
          </mesh>
          {/* أذن أيمن */}
          <mesh position={[0.122, 0.01, 0]}>
            <boxGeometry args={[0.018, 0.05, 0.04]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
          </mesh>
        </group>

      </group>{/* end bodyRef */}
    </group>
  );
}

/* ── كرسي مكتبي فاخر ─────────────────────────────────────────── */
function OfficerChair() {
  const seat  = "#1e1e2e";
  const frame = "#2a2a2a";
  const metal = "#555566";
  const accent = "#4fc3f7";

  return (
    <group>
      {/* مسند الظهر */}
      <mesh position={[0, 1.02, -0.24]} castShadow>
        <boxGeometry args={[0.46, 0.62, 0.06]} />
        <meshStandardMaterial color={seat} roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.34, -0.24]}>
        <boxGeometry args={[0.46, 0.04, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.72, -0.22]}>
        <boxGeometry args={[0.36, 0.025, 0.055]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.15} />
      </mesh>

      {/* المقعد */}
      <mesh position={[0, 0.50, 0.04]} castShadow>
        <boxGeometry args={[0.50, 0.055, 0.48]} />
        <meshStandardMaterial color={seat} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* مسندا الذراعين */}
      {([-1, 1] as number[]).map((s) => (
        <group key={s} position={[s * 0.27, 0, 0]}>
          <mesh position={[0, 0.44, -0.05]} castShadow>
            <boxGeometry args={[0.025, 0.36, 0.025]} />
            <meshStandardMaterial color={metal} metalness={0.85} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.62, 0.07]} castShadow>
            <boxGeometry args={[0.04, 0.022, 0.22]} />
            <meshStandardMaterial color={seat} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* العمود الهيدروليكي */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.042, 0.44, 10]} />
        <meshStandardMaterial color={metal} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* القاعدة النجمية */}
      {Array.from({ length: 5 }).map((_, i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[0.22, 0.03, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.38, 0.03, 0.055]} />
              <meshStandardMaterial color={frame} metalness={0.8} roughness={0.2} />
            </mesh>
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
