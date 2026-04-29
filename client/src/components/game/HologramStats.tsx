import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";

const TABLE_Y = 0.87;
const CEIL_Y  = 7.9;
const CYL_R   = 0.75;
const CYL_H   = CEIL_Y - TABLE_Y;
const CYL_CY  = TABLE_Y + CYL_H / 2;

export function HologramStats() {
  const phase   = useGame((s) => s.phase);
  const scanRef = useRef<THREE.Group>(null!);
  const pulseT  = useRef(0);
  const scanT   = useRef(0);

  // Refs to materials and lights for imperative updates (no React re-render per frame)
  const cylMatRef      = useRef<THREE.MeshBasicMaterial>(null!);
  const ceilRingMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const tableRing1Ref  = useRef<THREE.MeshBasicMaterial>(null!);
  const tableRing2Ref  = useRef<THREE.MeshBasicMaterial>(null!);
  const light1Ref      = useRef<THREE.PointLight>(null!);
  const light2Ref      = useRef<THREE.PointLight>(null!);

  useFrame((_, delta) => {
    pulseT.current += delta * 1.5;
    scanT.current  += delta * 0.55;
    const pulse = (Math.sin(pulseT.current) + 1) / 2;
    const ro    = 0.30 + pulse * 0.20;

    if (cylMatRef.current)      cylMatRef.current.opacity      = 0.06 + pulse * 0.03;
    if (ceilRingMatRef.current) ceilRingMatRef.current.opacity = 0.4  + pulse * 0.2;
    if (tableRing1Ref.current)  tableRing1Ref.current.opacity  = ro;
    if (tableRing2Ref.current)  tableRing2Ref.current.opacity  = ro + 0.1;
    if (light1Ref.current)      light1Ref.current.intensity    = 4 + pulse * 7;
    if (light2Ref.current)      light2Ref.current.intensity    = 2 + pulse * 3;

    if (scanRef.current) {
      const t = (Math.sin(scanT.current) + 1) / 2;
      scanRef.current.position.y = TABLE_Y + 0.15 + t * (CYL_H - 0.3);
    }
  });

  if (phase !== "playing") return null;

  const C = "#00e5ff";

  return (
    <group position={[0, 0, 1.5]}>

      {/* جدار الاسطوانة */}
      <mesh position={[0, CYL_CY, 0]}>
        <cylinderGeometry args={[CYL_R, CYL_R, CYL_H, 48, 1, true]} />
        <meshBasicMaterial ref={cylMatRef} color={C} transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>

      {/* حافة السقف */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, CEIL_Y, 0]}>
        <ringGeometry args={[CYL_R - 0.04, CYL_R + 0.04, 48]} />
        <meshBasicMaterial ref={ceilRingMatRef} color={C} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* خط مسح متحرك */}
      <group ref={scanRef} position={[0, TABLE_Y + 0.5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[CYL_R - 0.06, CYL_R, 48]} />
          <meshBasicMaterial color={C} transparent opacity={0.30} side={THREE.DoubleSide} />
        </mesh>
        {/* قرص ضوئي رفيع تحت خط المسح */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[CYL_R - 0.06, 48]} />
          <meshBasicMaterial color={C} transparent opacity={0.04} />
        </mesh>
      </group>

      {/* حلقات الطاولة */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TABLE_Y + 0.012, 0]}>
        <ringGeometry args={[CYL_R - 0.10, CYL_R, 64]} />
        <meshBasicMaterial ref={tableRing1Ref} color={C} transparent opacity={0.30} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TABLE_Y + 0.010, 0]}>
        <ringGeometry args={[0.10, 0.18, 48]} />
        <meshBasicMaterial ref={tableRing2Ref} color={C} transparent opacity={0.40} side={THREE.DoubleSide} />
      </mesh>

      {/* إضاءة */}
      <pointLight ref={light1Ref} position={[0, TABLE_Y + 0.1, 0]} intensity={4} distance={5} color={C} />
      <pointLight ref={light2Ref} position={[0, CEIL_Y - 0.3, 0]}  intensity={2} distance={4} color={C} />
    </group>
  );
}
