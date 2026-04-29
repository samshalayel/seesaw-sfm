/**
 * PerimeterWall.tsx
 * سور خارجي راقي حول مبنى SILLAR
 * أعمدة حجرية + غطاء رخامي + قاعدة + بوابة مشرفة + فوانيس + أشجار
 *
 * حدود المبنى:  X -24→+16   Z -29→+8
 * حدود السور:   X -30→+22   Z -35→+14
 * فتحة المدخل:  x -11 → +11  عند z=+14
 */

import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

// ── أبعاد السور ───────────────────────────────────────────────────────────
const W_LEFT   = -30;
const W_RIGHT  =  22;
const W_FRONT  =  14;
const W_BACK   = -35;

const WALL_H   = 2.5;
const WALL_T   = 0.55;

const SPAN_X   = W_RIGHT - W_LEFT;   // 52
const SPAN_Z   = W_FRONT - W_BACK;   // 49

const MID_X    = (W_LEFT + W_RIGHT) / 2;   // -4
const MID_Z    = (W_FRONT + W_BACK) / 2;   // -10.5

// ── حدود المبنى ──────────────────────────────────────────────────────────
const B_LEFT  = -24;
const B_RIGHT =  16;
const B_FRONT =   8;
const B_BACK  = -29;

// ── البوابة — نفس عرض المبنى لتجنب تداخل بصري مع الواجهة ───────────────
const GATE_L   = B_LEFT;    // -24
const GATE_R   = B_RIGHT;   // +16
const GATE_CX  = (GATE_L + GATE_R) / 2;  // -4

// ── ألوان ──────────────────────────────────────────────────────────────
const MARBLE_CAP  = "#e8e0d0";
const PILLAR_COL  = "#cfc4ae";
const BASE_COL    = "#8a7a62";
const GATE_MARBLE = "#ddd4be";

// ── مولّد مواضع الأعمدة ────────────────────────────────────────────────
function pillarsAlong(from: number, to: number, step = 8): number[] {
  const pos: number[] = [];
  for (let v = from; v <= to + 0.01; v += step) pos.push(Math.round(v * 10) / 10);
  return pos;
}

function stoneMap(tex: THREE.Texture, u: number, v: number) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(u, v);
  t.needsUpdate = true;
  return t;
}

// ── فانوس معلق ────────────────────────────────────────────────────────────
function Lantern({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, -WALL_H / 2 - 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, WALL_H + 0.9, 8]} />
        <meshStandardMaterial color="#2a3040" roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.0, 8]} />
        <meshStandardMaterial color="#2a3040" roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh position={[0.95, -0.22, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.45, 6]} />
        <meshStandardMaterial color="#1a2030" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0.95, -0.5, 0]} castShadow>
        <boxGeometry args={[0.26, 0.35, 0.26]} />
        <meshStandardMaterial color="#111820" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0.95, -0.5, 0]}>
        <boxGeometry args={[0.2, 0.27, 0.2]} />
        <meshStandardMaterial color="#ffe8a0" emissive="#ffcc44" emissiveIntensity={2.8} transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

// ── عمود زخرفي على الجدار ─────────────────────────────────────────────────
function WallPillar({ x, z, faceZ }: { x: number; z: number; faceZ?: boolean }) {
  const pw = 0.85; const pd = 0.85;
  const ph = WALL_H + 0.7;  // أطول من الجدار
  const capH = 0.18;
  const baseH = 0.22;
  return (
    <group position={[x, 0, z]}>
      {/* قاعدة العمود */}
      <mesh position={[0, baseH / 2, 0]} castShadow>
        <boxGeometry args={[pw + 0.12, baseH, pd + 0.12]} />
        <meshStandardMaterial color={BASE_COL} roughness={0.88} />
      </mesh>
      {/* جسم العمود */}
      <mesh position={[0, ph / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[pw, ph, pd]} />
        <meshStandardMaterial color={PILLAR_COL} roughness={0.82} metalness={0.04} />
      </mesh>
      {/* تاج العمود */}
      <mesh position={[0, ph + capH / 2, 0]} castShadow>
        <boxGeometry args={[pw + 0.2, capH, pd + 0.2]} />
        <meshStandardMaterial color={MARBLE_CAP} roughness={0.6} metalness={0.06} />
      </mesh>
      {/* بروز صغير فوق التاج */}
      <mesh position={[0, ph + capH + 0.06, 0]} castShadow>
        <boxGeometry args={[pw + 0.08, 0.1, pd + 0.08]} />
        <meshStandardMaterial color="#f0ece0" roughness={0.5} metalness={0.08} />
      </mesh>
    </group>
  );
}

// ── عمود بوابة فخم ────────────────────────────────────────────────────────
function GatePillar({ x }: { x: number }) {
  const w = 1.1; const ph = WALL_H + 2.2;
  return (
    <group position={[x, 0, W_FRONT]}>
      {/* قاعدة */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[w + 0.3, 0.36, w + 0.3]} />
        <meshStandardMaterial color={BASE_COL} roughness={0.85} />
      </mesh>
      {/* جسم */}
      <mesh position={[0, ph / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, ph, w]} />
        <meshStandardMaterial color={GATE_MARBLE} roughness={0.75} metalness={0.06} />
      </mesh>
      {/* حلية وسطى */}
      <mesh position={[0, ph * 0.5, 0]} castShadow>
        <boxGeometry args={[w + 0.12, 0.14, w + 0.12]} />
        <meshStandardMaterial color={MARBLE_CAP} roughness={0.6} metalness={0.08} />
      </mesh>
      {/* تاج */}
      <mesh position={[0, ph + 0.18, 0]} castShadow>
        <boxGeometry args={[w + 0.35, 0.32, w + 0.35]} />
        <meshStandardMaterial color={MARBLE_CAP} roughness={0.55} metalness={0.1} />
      </mesh>
      {/* بصلة فوق التاج */}
      <mesh position={[0, ph + 0.52, 0]} castShadow>
        <sphereGeometry args={[0.28, 10, 8]} />
        <meshStandardMaterial color="#c8b89a" roughness={0.5} metalness={0.15} />
      </mesh>
    </group>
  );
}

// ── مكوّن السور ───────────────────────────────────────────────────────────
export function PerimeterWall() {
  const stoneTex = useTexture("/images/box.png");
  const stoneH = useMemo(() => stoneMap(stoneTex, 13, 1), [stoneTex]);
  const stoneV = useMemo(() => stoneMap(stoneTex, 12, 1), [stoneTex]);

  const Y = WALL_H / 2;

  // مواضع الفوانيس — على الأعمدة
  const frontLanterns: number[] = [];
  for (let x = W_LEFT + 4; x <= W_RIGHT - 4; x += 8) {
    if (x < GATE_L - 0.5 || x > GATE_R + 0.5) frontLanterns.push(x);
  }
  const backLanterns:  number[] = pillarsAlong(W_LEFT, W_RIGHT, 8);
  const leftLanterns:  number[] = pillarsAlong(W_BACK + 2, W_FRONT - 2, 8);
  const rightLanterns: number[] = pillarsAlong(W_BACK + 2, W_FRONT - 2, 8);

  // أعمدة الجدار الأمامي
  const frontPillarsL = pillarsAlong(W_LEFT, GATE_L, 8);
  const frontPillarsR = pillarsAlong(GATE_R, W_RIGHT, 8);
  const backPillars   = pillarsAlong(W_LEFT, W_RIGHT, 8);
  const leftPillars   = pillarsAlong(W_BACK, W_FRONT, 8);
  const rightPillars  = pillarsAlong(W_BACK, W_FRONT, 8);

  return (
    <group>

      {/* ══ COURTYARD GROUND — 4 قطع حول المبنى تستثني بصمته لتجنب z-fighting ═ */}
      {/* أمام المبنى: Z[B_FRONT, W_FRONT] = [8, 14] */}
      <mesh position={[MID_X, -0.5, (B_FRONT + W_FRONT) / 2]} receiveShadow>
        <boxGeometry args={[SPAN_X - WALL_T * 2, 1.0, W_FRONT - B_FRONT]} />
        <meshStandardMaterial color="#c2bdb4" roughness={0.9} metalness={0.02} />
      </mesh>
      {/* خلف المبنى: Z[W_BACK, B_BACK] = [-35, -29] */}
      <mesh position={[MID_X, -0.5, (W_BACK + B_BACK) / 2]} receiveShadow>
        <boxGeometry args={[SPAN_X - WALL_T * 2, 1.0, B_BACK - W_BACK]} />
        <meshStandardMaterial color="#c2bdb4" roughness={0.9} metalness={0.02} />
      </mesh>
      {/* يسار المبنى: X[W_LEFT, B_LEFT] = [-30, -24] */}
      <mesh position={[(W_LEFT + B_LEFT) / 2, -0.5, (B_FRONT + B_BACK) / 2]} receiveShadow>
        <boxGeometry args={[B_LEFT - W_LEFT, 1.0, B_FRONT - B_BACK]} />
        <meshStandardMaterial color="#c2bdb4" roughness={0.9} metalness={0.02} />
      </mesh>
      {/* يمين المبنى: X[B_RIGHT, W_RIGHT] = [16, 22] */}
      <mesh position={[(B_RIGHT + W_RIGHT) / 2, -0.5, (B_FRONT + B_BACK) / 2]} receiveShadow>
        <boxGeometry args={[W_RIGHT - B_RIGHT, 1.0, B_FRONT - B_BACK]} />
        <meshStandardMaterial color="#c2bdb4" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* ══ BASE STRIP — قاعدة السور (أسفل) ═════════════════════════════ */}
      {[
        { x: W_LEFT + (GATE_L - W_LEFT) / 2, w: GATE_L - W_LEFT },
        { x: GATE_R + (W_RIGHT - GATE_R) / 2, w: W_RIGHT - GATE_R },
      ].map((s, i) => (
        <mesh key={`bf${i}`} position={[s.x, 0.15, W_FRONT]} receiveShadow>
          <boxGeometry args={[s.w, 0.3, WALL_T + 0.25]} />
          <meshStandardMaterial color={BASE_COL} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[MID_X, 0.15, W_BACK]} receiveShadow>
        <boxGeometry args={[SPAN_X, 0.3, WALL_T + 0.25]} />
        <meshStandardMaterial color={BASE_COL} roughness={0.9} />
      </mesh>
      <mesh position={[W_LEFT,  0.15, MID_Z]} receiveShadow>
        <boxGeometry args={[WALL_T + 0.25, 0.3, SPAN_Z]} />
        <meshStandardMaterial color={BASE_COL} roughness={0.9} />
      </mesh>
      <mesh position={[W_RIGHT, 0.15, MID_Z]} receiveShadow>
        <boxGeometry args={[WALL_T + 0.25, 0.3, SPAN_Z]} />
        <meshStandardMaterial color={BASE_COL} roughness={0.9} />
      </mesh>

      {/* ══ WALL BODY ════════════════════════════════════════════════════ */}
      {/* أمامي — يسار البوابة */}
      {(() => {
        const w = GATE_L - W_LEFT;
        return (
          <mesh position={[W_LEFT + w / 2, Y, W_FRONT]} castShadow receiveShadow>
            <boxGeometry args={[w, WALL_H, WALL_T]} />
            <meshStandardMaterial map={stoneH} roughness={0.85} metalness={0.05} />
          </mesh>
        );
      })()}
      {/* أمامي — يمين البوابة */}
      {(() => {
        const w = W_RIGHT - GATE_R;
        return (
          <mesh position={[GATE_R + w / 2, Y, W_FRONT]} castShadow receiveShadow>
            <boxGeometry args={[w, WALL_H, WALL_T]} />
            <meshStandardMaterial map={stoneH} roughness={0.85} metalness={0.05} />
          </mesh>
        );
      })()}
      <mesh position={[MID_X, Y, W_BACK]} castShadow receiveShadow>
        <boxGeometry args={[SPAN_X, WALL_H, WALL_T]} />
        <meshStandardMaterial map={stoneH} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[W_LEFT, Y, MID_Z]} castShadow receiveShadow>
        <boxGeometry args={[WALL_T, WALL_H, SPAN_Z]} />
        <meshStandardMaterial map={stoneV} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[W_RIGHT, Y, MID_Z]} castShadow receiveShadow>
        <boxGeometry args={[WALL_T, WALL_H, SPAN_Z]} />
        <meshStandardMaterial map={stoneV} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* ══ WALL CAP ══════════════════════════════════════════════════════ */}
      {[
        { x: W_LEFT + (GATE_L - W_LEFT) / 2, z: W_FRONT, w: GATE_L - W_LEFT,  d: WALL_T + 0.3 },
        { x: GATE_R + (W_RIGHT - GATE_R) / 2, z: W_FRONT, w: W_RIGHT - GATE_R, d: WALL_T + 0.3 },
        { x: MID_X,   z: W_BACK, w: SPAN_X,      d: WALL_T + 0.3 },
        { x: W_LEFT,  z: MID_Z,  w: WALL_T + 0.3, d: SPAN_Z },
        { x: W_RIGHT, z: MID_Z,  w: WALL_T + 0.3, d: SPAN_Z },
      ].map((s, i) => (
        <mesh key={`cap${i}`} position={[s.x, WALL_H + 0.09, s.z]} castShadow>
          <boxGeometry args={[s.w, 0.16, s.d]} />
          <meshStandardMaterial color={MARBLE_CAP} roughness={0.55} metalness={0.08} />
        </mesh>
      ))}

      {/* ══ WALL PILLARS ══════════════════════════════════════════════════ */}
      {frontPillarsL.map((x, i) => <WallPillar key={`fpl${i}`} x={x} z={W_FRONT} />)}
      {frontPillarsR.map((x, i) => <WallPillar key={`fpr${i}`} x={x} z={W_FRONT} />)}
      {backPillars.map((x,  i) => <WallPillar key={`bp${i}`}   x={x} z={W_BACK}  />)}
      {leftPillars.map((z,  i) => <WallPillar key={`lp${i}`}   x={W_LEFT}  z={z} />)}
      {rightPillars.map((z, i) => <WallPillar key={`rp${i}`}   x={W_RIGHT} z={z} />)}

      {/* ══ GATE — بوابة مشرفة بعرض المبنى ══════════════════════════════ */}
      <GatePillar x={GATE_L - 0.6} />
      <GatePillar x={GATE_R + 0.6} />

      {/* إضاءة نيون على أعمدة البوابة */}
      {[GATE_L - 0.6, GATE_R + 0.6].map((px, i) => (
        <group key={`gn${i}`}>
          <mesh position={[px, WALL_H + 1.6, W_FRONT + 0.56]}>
            <boxGeometry args={[0.08, 1.0, 0.06]} />
            <meshStandardMaterial color="#00aaff" emissive="#00aaff" emissiveIntensity={5} toneMapped={false} />
          </mesh>
          <pointLight position={[px, WALL_H + 1.6, W_FRONT + 0.7]} color="#0077ff" intensity={12} distance={8} />
        </group>
      ))}

      {/* ══ LANTERNS ════════════════════════════════════════════════════ */}
      {frontLanterns.map((x, i) => <Lantern key={`fl${i}`} position={[x, WALL_H, W_FRONT]} />)}
      {backLanterns.map((x,  i) => <Lantern key={`bl${i}`} position={[x, WALL_H, W_BACK]}  />)}
      {leftLanterns.map((z,  i) => <Lantern key={`ll${i}`} position={[W_LEFT,  WALL_H, z]} />)}
      {rightLanterns.map((z, i) => <Lantern key={`rl${i}`} position={[W_RIGHT, WALL_H, z]} />)}

      {/* ══ ACCENT LIGHTS ════════════════════════════════════════════════ */}
      <pointLight position={[MID_X - 14, WALL_H + 1, W_FRONT]} color="#ffdd88" intensity={10} distance={18} />
      <pointLight position={[MID_X + 14, WALL_H + 1, W_FRONT]} color="#ffdd88" intensity={10} distance={18} />
      <pointLight position={[MID_X,      WALL_H + 1, W_BACK]}  color="#ffcc66" intensity={8}  distance={22} />
      <pointLight position={[W_LEFT,     WALL_H + 1, MID_Z]}   color="#ffdd88" intensity={7}  distance={18} />
      <pointLight position={[W_RIGHT,    WALL_H + 1, MID_Z]}   color="#ffdd88" intensity={7}  distance={18} />


    </group>
  );
}

export default PerimeterWall;
