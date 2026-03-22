/**
 * ExteriorWalls.tsx
 * الجدران الخارجية المحيطة بمبنى SILLAR — حجارة box.png + نيون + سبوتات ليلية
 *
 * حدود المبنى الكاملة:
 *   X: -24  →  +16   (عرض 40)
 *   Z: -29  →  +8    (عمق 37)
 *   Y:  0   →  +10   (ارتفاع)
 */

import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

// ── أبعاد المبنى ───────────────────────────────────────────────────────────
const X_LEFT   = -24;
const X_RIGHT  =  16;
const Z_FRONT  =   8;   // الواجهة الأمامية (BuildingEntrance هناك)
const Z_BACK   = -29;
const WALL_H   =  10;
const MID_Y    = WALL_H / 2;

// ── ألوان النيون ──────────────────────────────────────────────────────────
const NEON_CYAN   = "#00e5ff";
const NEON_PURPLE = "#9933ff";
const NEON_AMBER  = "#ff8800";

function stoneRepeat(tex: THREE.Texture, u: number, v: number) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(u, v);
  t.needsUpdate = true;
  return t;
}

export function ExteriorWalls() {
  const stoneTex = useTexture("/images/box.png");

  const stoneLeft  = useMemo(() => stoneRepeat(stoneTex,  9, 3), [stoneTex]); // Z-span 37 ÷ 4 ≈ 9
  const stoneRight = useMemo(() => stoneRepeat(stoneTex,  9, 3), [stoneTex]);
  const stoneBack  = useMemo(() => stoneRepeat(stoneTex, 10, 3), [stoneTex]); // X-span 40 ÷ 4 = 10

  const SPAN_Z = Z_FRONT - Z_BACK;   // 37
  const SPAN_X = X_RIGHT - X_LEFT;   // 40
  const CX     = (X_LEFT + X_RIGHT) / 2;   // -4
  const CZ     = (Z_FRONT + Z_BACK) / 2;   // -10.5

  return (
    <group>

      {/* ══ BACK WALL (z = -29) ═══════════════════════════════════════════ */}
      <mesh position={[CX, MID_Y, Z_BACK - 0.3]} receiveShadow castShadow>
        <boxGeometry args={[SPAN_X + 0.6, WALL_H, 0.6]} />
        <meshStandardMaterial map={stoneBack} roughness={0.88} metalness={0.06} />
      </mesh>
      {/* Back wall top neon */}
      <mesh position={[CX, WALL_H + 0.04, Z_BACK + 0.05]}>
        <boxGeometry args={[SPAN_X, 0.08, 0.08]} />
        <meshStandardMaterial color={NEON_CYAN} emissive={NEON_CYAN} emissiveIntensity={5} toneMapped={false} />
      </mesh>
      <pointLight position={[CX - 10, WALL_H - 1, Z_BACK + 1]} color={NEON_CYAN}   intensity={18} distance={16} />
      <pointLight position={[CX + 10, WALL_H - 1, Z_BACK + 1]} color={NEON_PURPLE} intensity={18} distance={16} />
      {/* Ground uplight — back */}
      <pointLight position={[CX - 8, 0.3, Z_BACK + 1.5]} color={NEON_AMBER}  intensity={22} distance={12} />
      <pointLight position={[CX,     0.3, Z_BACK + 1.5]} color={NEON_CYAN}   intensity={20} distance={12} />
      <pointLight position={[CX + 8, 0.3, Z_BACK + 1.5]} color={NEON_PURPLE} intensity={22} distance={12} />


      {/* ══ CORNER NEON PILLARS ═══════════════════════════════════════════ */}
      {/* Back-left */}
      <mesh position={[X_LEFT, MID_Y, Z_BACK]}>
        <boxGeometry args={[0.12, WALL_H, 0.12]} />
        <meshStandardMaterial color={NEON_CYAN} emissive={NEON_CYAN} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Back-right */}
      <mesh position={[X_RIGHT, MID_Y, Z_BACK]}>
        <boxGeometry args={[0.12, WALL_H, 0.12]} />
        <meshStandardMaterial color={NEON_PURPLE} emissive={NEON_PURPLE} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Front-left (near entrance) */}
      <mesh position={[X_LEFT, MID_Y, Z_FRONT]}>
        <boxGeometry args={[0.12, WALL_H, 0.12]} />
        <meshStandardMaterial color={NEON_AMBER} emissive={NEON_AMBER} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Front-right (near entrance) */}
      <mesh position={[X_RIGHT, MID_Y, Z_FRONT]}>
        <boxGeometry args={[0.12, WALL_H, 0.12]} />
        <meshStandardMaterial color={NEON_CYAN} emissive={NEON_CYAN} emissiveIntensity={4} toneMapped={false} />
      </mesh>

    </group>
  );
}

export default ExteriorWalls;
