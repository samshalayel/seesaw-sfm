import { Html } from "@react-three/drei";
import { useGame } from "@/lib/stores/useGame";

const sw = 4.8;
const sh = 2.7;

export function ManagerDoorScreen() {
  const nearScreen = useGame((s) => s.videoScreenOpen === false);
  const isExteriorView = useGame((s) => s.isExteriorView);

  return (
    <group position={[7.92, 3.8, 3.5]} rotation={[0, -Math.PI / 2, 0]}>
      {/* إطار الشاشة */}
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[sw + 0.16, sh + 0.12, 0.06]} />
        <meshStandardMaterial color="#111118" roughness={0.2} metalness={0.7} />
      </mesh>

      {/* الحد الذهبي */}
      <mesh position={[0, 0, -0.032]}>
        <boxGeometry args={[sw + 0.08, sh + 0.06, 0.04]} />
        <meshStandardMaterial color="#c4a44a" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* سطح الشاشة السوداء */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[sw, sh]} />
        <meshStandardMaterial color="#050510" emissive="#0a0a2a" emissiveIntensity={0.3} />
      </mesh>

      {/* إضاءة زرقاء خفيفة */}
      <pointLight position={[-0.5, 0, 0]} intensity={3} distance={4} color="#4a90d9" />

      {/* تلميح الضغط F */}
      {!isExteriorView && (
        <Html center position={[0, 0, 0.01]} style={{ pointerEvents: "none", userSelect: "none" }}>
          <div style={{
            color: "#c4a44a",
            fontSize: "13px",
            fontFamily: "monospace",
            letterSpacing: "2px",
            textShadow: "0 0 8px rgba(196,164,74,0.8)",
            whiteSpace: "nowrap",
          }}>
            F — شاهد الفيديو
          </div>
        </Html>
      )}
    </group>
  );
}
