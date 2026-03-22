import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useChat } from "@/lib/stores/useChat";
import { useGame } from "@/lib/stores/useGame";

interface RobotProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  robotId: string;
  label?: string;
}

export function Robot({
  position,
  rotation = [0, 0, 0],
  color = "#4fc3f7",
  robotId,
  label: labelProp,
}: RobotProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const bodyRef    = useRef<THREE.Group>(null);
  const headRef    = useRef<THREE.Group>(null);
  const eyeMatL    = useRef<THREE.MeshStandardMaterial>(null);
  const eyeMatR    = useRef<THREE.MeshStandardMaterial>(null);
  const antennaRef = useRef<THREE.Mesh>(null);

  const label = labelProp || robotId;
  const isExteriorView = useGame((s) => s.isExteriorView);
  const robotScreens = useChat((s) => s.robotScreens);
  const screenContent = robotScreens[robotId] || "";

  const handleClick = () => {
    const chatState = useChat.getState();
    chatState.isOpen ? chatState.closeChat() : chatState.openChat(robotId);
  };

  // ── animations ──────────────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = Math.sin(t * 1.6);

    // جسم — نفَس خفيف
    if (bodyRef.current) {
      bodyRef.current.position.y = s * 0.012;
    }
    // رأس — دوران طفيف (أبطأ دورة = أقل تحديثاً بصرياً)
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.12;
    }
    // عيون — نبض الإضاءة (نفس sin مؤشر مختلف)
    const glow = 0.55 + Math.sin(t * 2.4) * 0.35;
    if (eyeMatL.current) eyeMatL.current.emissiveIntensity = glow;
    if (eyeMatR.current) eyeMatR.current.emissiveIntensity = glow;
    // هوائي
    if (antennaRef.current) {
      antennaRef.current.position.y = 1.62 + Math.sin(t * 3.2) * 0.025;
    }
  });

  // مواد مشتركة
  const bodyMat  = <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />;
  const plateMat = <meshStandardMaterial color="#3a3a4a" roughness={0.2}  metalness={0.8}  />;
  const accentMat= <meshStandardMaterial color={color}  emissive={color}  emissiveIntensity={0.45} roughness={0.1} metalness={0.3} />;
  const darkMat  = <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6}  />;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={1.35}
           userData={{ robotId }} onClick={handleClick}>

      {/* ── شارة الاسم ──────────────────────────────────────────────────────── */}
      {!isExteriorView && (
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
          }}>
            ◈ {label}
          </div>
        </Html>
      )}

      {/* ── شاشة الرد ──────────────────────────────────────────────────────── */}
      {!isExteriorView && screenContent && (
        <Html position={[0, 2.2, 0]} center distanceFactor={4} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(0,20,40,0.97)",
            color: "#00ff88",
            padding: "20px 26px",
            borderRadius: "14px",
            fontSize: "20px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            maxWidth: "640px",
            maxHeight: "340px",
            overflow: "hidden",
            border: `3px solid ${color}`,
            boxShadow: `0 0 36px ${color}77`,
            position: "relative",
            lineHeight: "1.6",
          }}>
            <div style={{
              content: '""',
              position: "absolute",
              top: "-15px",
              left: "50%",
              transform: "translateX(-50%)",
              borderWidth: "0 15px 15px",
              borderStyle: "solid",
              borderColor: `transparent transparent ${color}`,
            }} />
            {screenContent.length > 500 ? screenContent.substring(0, 500) + "..." : screenContent}
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

        {/* ── الذراع الأيمن ── */}
        <group position={[0.33, 0.52, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.10, 0.34, 0.10]} />
            {bodyMat}
          </mesh>
          <mesh position={[0, -0.28, 0.02]} castShadow>
            <boxGeometry args={[0.09, 0.22, 0.09]} />
            {plateMat}
          </mesh>
          <mesh position={[0.008, -0.44, 0]} castShadow>
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
}

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
