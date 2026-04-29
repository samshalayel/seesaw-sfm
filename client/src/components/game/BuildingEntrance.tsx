/**
 * BuildingEntrance.tsx
 * Exterior SILLAR company facade — 3D geometry version.
 * Positioned at z=8.25 (outside the Room front wall z=8).
 * LogoutDoor sits at z=7.92, door w=2.6, h=5.2, center y=2.7.
 */

import { useTexture } from "@react-three/drei";
import { useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";

const FACADE_WIDTH    = 22;
const FACADE_HEIGHT   = 11;
const FACADE_CENTER_Y = 5.9;
const FACADE_Z        = 8.3;
const NEON_BLUE       = "#00aaff";

export function BuildingEntrance() {
  const defaultTex = useTexture("/images/sillar-entrance.png");
  defaultTex.wrapS = THREE.ClampToEdgeWrapping;
  defaultTex.wrapT = THREE.ClampToEdgeWrapping;

  const entranceBg = useGame((s) => s.entranceBg);
  const [customTex, setCustomTex] = useState<THREE.Texture | null>(null);

  // يُعيد تحميل الـ texture كلما تغيّرت الصورة المخصصة
  useEffect(() => {
    if (!entranceBg) { setCustomTex(null); return; }
    const loader = new THREE.TextureLoader();
    loader.load(entranceBg, (tex) => {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      setCustomTex(tex);
    });
  }, [entranceBg]);

  const facadeTex = customTex || defaultTex;

  const stoneTex = useTexture("/images/box.png");

  // Side panels — tiled stone (3 deep × 10 tall)
  const sideStone = useMemo(() => {
    const t = stoneTex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.5, 4);
    t.needsUpdate = true;
    return t;
  }, [stoneTex]);

  return (
    <group>

      {/* الواجهة الرئيسية — صورة المبنى */}
      <mesh position={[0, FACADE_CENTER_Y, FACADE_Z]}>
        <planeGeometry args={[FACADE_WIDTH, FACADE_HEIGHT]} />
        <meshStandardMaterial map={facadeTex} side={THREE.FrontSide} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* كابوف 3D — مضيّق على المدخل فقط (x: -4 to +4) */}
      <mesh position={[0, 5.43, FACADE_Z + 1.15]} castShadow receiveShadow>
        <boxGeometry args={[7, 0.22, 2.4]} />
        <meshStandardMaterial color="#181c22" roughness={0.7} metalness={0.35} />
      </mesh>

      {/* Canopy underside */}
      <mesh position={[0, 5.31, FACADE_Z + 1.15]}>
        <boxGeometry args={[6.6, 0.04, 2.2]} />
        <meshStandardMaterial color="#001a33" emissive="#001a33" emissiveIntensity={2} />
      </mesh>

      {/* نيون أمامي */}
      <mesh position={[0, 5.31, FACADE_Z + 2.34]}>
        <boxGeometry args={[7, 0.09, 0.09]} />
        <meshStandardMaterial color={NEON_BLUE} emissive={NEON_BLUE} emissiveIntensity={5} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 5.15, FACADE_Z + 2.34]} color="#0066ff" intensity={18} distance={6} />

      {/* نيون خلفي */}
      <mesh position={[0, 5.31, FACADE_Z + 0.1]}>
        <boxGeometry args={[6.8, 0.07, 0.07]} />
        <meshStandardMaterial color={NEON_BLUE} emissive={NEON_BLUE} emissiveIntensity={3} toneMapped={false} />
      </mesh>


      {/* درجة المدخل الرئيسية — مرتفعة كدرجة سلم */}
      <mesh position={[0, 0.2, FACADE_Z + 1.3]} castShadow receiveShadow>
        <boxGeometry args={[24, 0.38, 2.7]} />
        <meshStandardMaterial color="#c8bfb0" roughness={0.80} metalness={0.06} />
      </mesh>
      {/* حافة أمامية للدرجة — شريط رخامي أفتح */}
      <mesh position={[0, 0.39, FACADE_Z + 2.65]} castShadow>
        <boxGeometry args={[24, 0.05, 0.08]} />
        <meshStandardMaterial color="#ddd4c4" roughness={0.65} metalness={0.1} />
      </mesh>

      {/* إضاءة خارجية */}
      <pointLight position={[0, 9, FACADE_Z + 2]} color="#ffffff" intensity={7} distance={16} />
      <pointLight position={[-6, 5, FACADE_Z + 0]} color="#3355ff" intensity={3} distance={8} />
      <pointLight position={[6, 5, FACADE_Z + 0]} color="#aabbdd" intensity={3} distance={8} />

    </group>
  );
}

export default BuildingEntrance;
