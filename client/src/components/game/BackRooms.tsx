/**
 * BackRooms.tsx
 * Three rooms behind the production hall.
 *
 * Room A (Left)   : X [-24, -11]  Z [-29, -19]  center (-17.5, 0, -24)  — amber/orange
 * Room B (Center) : X [-10,  +3]  Z [-29, -19]  center ( -3.5, 0, -24)  — purple/indigo
 * Room C (Right)  : X [  +4, +16] Z [-29, -19]  center ( +10,  0, -24)  — teal/green
 *
 * Doors in hall back wall at X = -17.5, -3.5, +10  (width 3, height 5)
 */

import * as THREE from "three";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useGame } from "@/lib/stores/useGame";
import { SillarStagePanel } from "./SillarStagePanel";

const ROOM_H   = 8;
const WTHK     = 0.3;
const DOOR_W   = 3.0;
const DOOR_H   = 5.0;
const Z_FRONT  = -19.0;
const Z_BACK   = -29.0;
const ROOM_D   = Math.abs(Z_BACK - Z_FRONT); // 10
const ROOM_CZ  = (Z_FRONT + Z_BACK) / 2;     // -24

// ── Room A ────────────────────────────────────────────────────────────────────
const A_X_MIN  = -24.0;
const A_X_MAX  = -11.0;
const A_W      = A_X_MAX - A_X_MIN;
const A_CX     = (A_X_MIN + A_X_MAX) / 2; // -17.5
const A_ACCENT = "#f59e0b";
const A_DIM    = "#78350f";
const A_FLOOR  = "#1a1008";
const A_WALL   = "#1c1508";

// ── Room B ────────────────────────────────────────────────────────────────────
const B_X_MIN  = -10.0;
const B_X_MAX  =   3.0;
const B_W      = B_X_MAX - B_X_MIN;
const B_CX     = (B_X_MIN + B_X_MAX) / 2; // -3.5
const B_ACCENT = "#a855f7";
const B_DIM    = "#4c1d95";
const B_FLOOR  = "#0d0a1a";
const B_WALL   = "#110d20";

// ── Room C ────────────────────────────────────────────────────────────────────
const C_X_MIN  =  4.0;
const C_X_MAX  = 16.0;
const C_W      = C_X_MAX - C_X_MIN;
const C_CX     = (C_X_MIN + C_X_MAX) / 2; // 10
const C_ACCENT = "#10b981";
const C_DIM    = "#064e3b";
const C_FLOOR  = "#080f0d";
const C_WALL   = "#0b1510";

// Shared divider X positions
const DIV1_X = (A_X_MAX + B_X_MIN) / 2; // -10.5
const DIV2_X = (B_X_MAX + C_X_MIN) / 2; //  3.5

// ── Swinging door ─────────────────────────────────────────────────────────────
function BackRoomDoor({ cx, accent, stageNum, stageLabel }: { cx: number; accent: string; stageNum: number; stageLabel: string }) {
  const doorGroupRef = useRef<THREE.Group>(null);
  const openRef      = useRef(false);
  const nearbyRef    = useRef(false);
  const doorAngle    = useRef(0);
  const [nearby, setNearby] = useState(false);
  const [open,   setOpen  ] = useState(false);

  const isExteriorView = useGame((s) => s.isExteriorView);
  // read all three lock states (hooks must not be conditional)
  const brALocked = useGame((s) => s.brADoorLocked);
  const brBLocked = useGame((s) => s.brBDoorLocked);
  const brCLocked = useGame((s) => s.brCDoorLocked);
  const storeLocked = cx < -10 ? brALocked : cx < 5 ? brBLocked : brCLocked;

  useFrame(({ camera }, delta) => {
    const { x: px, z: pz } = useGame.getState().playerPos;
    const dx = Math.abs(px - cx);
    const dz = Math.abs(pz - Z_FRONT);
    const isNear = dx < 4.5 && dz < 6;

    if (isNear !== nearbyRef.current) {
      nearbyRef.current = isNear;
      setNearby(isNear);
    }

    // Store-controlled: door opens when unlocked
    const shouldOpen = !useGame.getState()[cx < -10 ? "brADoorLocked" : cx < 5 ? "brBDoorLocked" : "brCDoorLocked"];
    if (shouldOpen !== openRef.current) {
      openRef.current = shouldOpen;
      setOpen(shouldOpen);
    }

    if (doorGroupRef.current) {
      const targetAngle = openRef.current ? -Math.PI / 2 : 0;
      const diff = targetAngle - doorAngle.current;
      if (Math.abs(diff) > 0.005) {
        doorAngle.current += diff * Math.min(delta * 3, 0.15);
        doorGroupRef.current.rotation.y = doorAngle.current;
      } else {
        doorAngle.current = targetAngle;
        doorGroupRef.current.rotation.y = targetAngle;
      }
    }
  });

  // Hinge at left edge — door swings into back room (negative Z)
  return (
    <group position={[cx, 0, Z_FRONT - 0.08]}>

      {/* Swinging panel — pivot at left edge */}
      <group ref={doorGroupRef} position={[-(DOOR_W / 2), 0, 0]}>
        {/* Main door panel */}
        <mesh position={[DOOR_W / 2, DOOR_H / 2, 0]} castShadow>
          <boxGeometry args={[DOOR_W, DOOR_H, 0.12]} />
          <meshStandardMaterial color="#18202e" roughness={0.2} metalness={0.75} />
        </mesh>
        {/* Horizontal accent lines */}
        {([1.2, 2.5, 3.8] as number[]).map((y, i) => (
          <mesh key={i} position={[DOOR_W / 2, y, 0.07]}>
            <boxGeometry args={[DOOR_W - 0.2, 0.03, 0.01]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2} toneMapped={false} />
          </mesh>
        ))}
        {/* Handle */}
        <mesh position={[DOOR_W - 0.3, DOOR_H / 2, 0.08]}>
          <boxGeometry args={[0.07, 0.26, 0.07]} />
          <meshStandardMaterial color={accent} roughness={0.2} metalness={0.85} />
        </mesh>
        {/* Lock dot */}
        <mesh position={[DOOR_W - 0.42, DOOR_H / 2 - 0.42, 0.09]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial
            color={open ? "#4ade80" : "#ef4444"}
            emissive={open ? "#4ade80" : "#ef4444"}
            emissiveIntensity={1.2}
          />
        </mesh>
      </group>

      {/* Fixed door frame */}
      {/* Left jamb */}
      <mesh position={[-(DOOR_W / 2) - 0.1, DOOR_H / 2, 0]}>
        <boxGeometry args={[0.18, DOOR_H, 0.35]} />
        <meshStandardMaterial color="#1a2545" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[(DOOR_W / 2) + 0.1, DOOR_H / 2, 0]}>
        <boxGeometry args={[0.18, DOOR_H, 0.35]} />
        <meshStandardMaterial color="#1a2545" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Header */}
      <mesh position={[0, DOOR_H + 0.1, 0]}>
        <boxGeometry args={[DOOR_W + 0.36, 0.18, 0.35]} />
        <meshStandardMaterial color="#1a2545" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Header neon */}
      <mesh position={[0, DOOR_H + 0.22, 0]}>
        <boxGeometry args={[DOOR_W + 0.36, 0.04, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Floor threshold neon */}
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[DOOR_W - 0.2, 0.03, 0.1]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} toneMapped={false} />
      </mesh>

      {/* Stage sign above door */}
      {!isExteriorView && (
        <Html transform position={[0, DOOR_H + 0.55, 0.2]} scale={0.18} style={{ pointerEvents: "none", userSelect: "none" }}>
          <div style={{
            background:    "rgba(5,10,22,0.96)",
            color:         "#ffffff",
            padding:       "6px 22px 7px",
            borderRadius:  "4px",
            fontSize:      "15px",
            fontWeight:    "800",
            fontFamily:    "Inter, sans-serif",
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            textAlign:     "center",
            whiteSpace:    "nowrap",
            border:        `2px solid ${accent}`,
            lineHeight:    "1.5",
          }}>
            Stage {stageNum}
            <br />
            <span style={{ fontSize: "9px", letterSpacing: "1.5px", color: accent }}>
              {stageLabel}
            </span>
          </div>
        </Html>
      )}

      {/* Proximity hint — only shown when unlocked (locked doors show keypad overlay) */}
      {nearby && !isExteriorView && !storeLocked && (
        <Html transform position={[0, 1.4, 0.4]} scale={0.3} style={{ pointerEvents: "none", userSelect: "none" }}>
          <div style={{
            color: "#ffffff",
            background: "rgba(0,10,20,0.85)",
            border: `1px solid ${accent}`,
            padding: "6px 16px",
            borderRadius: "8px",
            fontSize: "17px",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
            textAlign: "center",
            direction: "rtl",
            boxShadow: `0 0 12px ${accent}55`,
          }}>
            {open ? "الباب مفتوح" : "الباب مفتوح"}
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Single room geometry ──────────────────────────────────────────────────────
function Room({
  cx, w, accent, dim, floorColor, wallColor,
}: {
  cx: number; w: number;
  accent: string; dim: string;
  floorColor: string; wallColor: string;
}) {
  const hw = w / 2;

  return (
    <group>
      {/* Floor */}
      <mesh position={[cx, 0.1, ROOM_CZ]} receiveShadow>
        <boxGeometry args={[w, 0.18, ROOM_D]} />
        <meshStandardMaterial color={floorColor} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Floor neon border — back + sides */}
      <mesh position={[cx, 0.2, Z_BACK + 0.2]}>
        <boxGeometry args={[w - 0.6, 0.03, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[cx - hw + 0.2, 0.2, ROOM_CZ]}>
        <boxGeometry args={[0.05, 0.03, ROOM_D - 0.6]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[cx + hw - 0.2, 0.2, ROOM_CZ]}>
        <boxGeometry args={[0.05, 0.03, ROOM_D - 0.6]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* Floor grid */}
      {[-3, 0, 3].map((dz, i) => (
        <mesh key={`fgz-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.2, ROOM_CZ + dz]}>
          <planeGeometry args={[w, 0.04]} />
          <meshStandardMaterial color={dim} emissive={dim} emissiveIntensity={0.3} />
        </mesh>
      ))}
      {[-3, 0, 3].map((dx, i) => (
        <mesh key={`fgx-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[cx + dx, 0.2, ROOM_CZ]}>
          <planeGeometry args={[0.04, ROOM_D]} />
          <meshStandardMaterial color={dim} emissive={dim} emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, ROOM_H, ROOM_CZ]}>
        <planeGeometry args={[w, ROOM_D]} />
        <meshStandardMaterial
          color="#c0cce8" side={THREE.BackSide}
          transparent opacity={0.14} roughness={0.05} metalness={0.3}
        />
      </mesh>
      {/* Ceiling strip light */}
      <mesh position={[cx, ROOM_H - 0.04, ROOM_CZ]}>
        <boxGeometry args={[w - 3, 0.07, 0.3]} />
        <meshStandardMaterial color="#e8f4ff" emissive="#7aaaff" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <pointLight position={[cx, ROOM_H - 0.5, ROOM_CZ - 2]} color={accent} intensity={8} distance={14} />
      <pointLight position={[cx, ROOM_H - 0.5, ROOM_CZ + 2]} color="#b0ccff" intensity={6} distance={14} />

      {/* Back wall (Z = -29) */}
      <mesh position={[cx, ROOM_H / 2, Z_BACK - WTHK / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, ROOM_H, WTHK]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[cx, ROOM_H - 0.5, Z_BACK + 0.02]}>
        <boxGeometry args={[w - 1, 0.06, 0.04]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[cx, 0.28, Z_BACK + 0.02]}>
        <boxGeometry args={[w - 1, 0.06, 0.04]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* Back wall panels */}
      {[-hw / 2, hw / 2].map((dx, i) => (
        <mesh key={`bp-${i}`} position={[cx + dx, ROOM_H / 2, Z_BACK + 0.02]}>
          <boxGeometry args={[hw - 0.8, ROOM_H - 1.4, 0.04]} />
          <meshStandardMaterial color={dim} roughness={0.55} metalness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function BackRooms() {
  return (
    <group>

      {/* ── Room geometry ──────────────────────────────────────────────────── */}
      <Room cx={A_CX} w={A_W} accent={A_ACCENT} dim={A_DIM} floorColor={A_FLOOR} wallColor={A_WALL} />
      <Room cx={B_CX} w={B_W} accent={B_ACCENT} dim={B_DIM} floorColor={B_FLOOR} wallColor={B_WALL} />
      <Room cx={C_CX} w={C_W} accent={C_ACCENT} dim={C_DIM} floorColor={C_FLOOR} wallColor={C_WALL} />

      {/* ── Swinging doors ─────────────────────────────────────────────────── */}
      <BackRoomDoor cx={A_CX} accent={A_ACCENT} stageNum={4} stageLabel="Observability & Ops" />
      <BackRoomDoor cx={B_CX} accent={B_ACCENT} stageNum={5} stageLabel="Reproducibility" />
      <BackRoomDoor cx={C_CX} accent={C_ACCENT} stageNum={6} stageLabel="Production Ready" />

      {/* ── Divider wall 1: X = -10.5 (between A and B), Z: -29 to -19 ─────── */}
      <mesh position={[DIV1_X, ROOM_H / 2, ROOM_CZ]} castShadow receiveShadow>
        <boxGeometry args={[WTHK, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color="#141820" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[DIV1_X, ROOM_H - 0.5, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.05, ROOM_D - 1]} />
        <meshStandardMaterial color="#334155" emissive="#334155" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[DIV1_X, 0.28, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.05, ROOM_D - 1]} />
        <meshStandardMaterial color="#334155" emissive="#334155" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>

      {/* ── Divider wall 2: X = +3.5 (between B and C), Z: -29 to -19 ──────── */}
      <mesh position={[DIV2_X, ROOM_H / 2, ROOM_CZ]} castShadow receiveShadow>
        <boxGeometry args={[WTHK, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color="#141820" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[DIV2_X, ROOM_H - 0.5, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.05, ROOM_D - 1]} />
        <meshStandardMaterial color="#334155" emissive="#334155" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[DIV2_X, 0.28, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.05, ROOM_D - 1]} />
        <meshStandardMaterial color="#334155" emissive="#334155" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>

      {/* ── Left outer wall: X = -24, Z: -29 to -19 ────────────────────────── */}
      <mesh position={[A_X_MIN - WTHK / 2, ROOM_H / 2, ROOM_CZ]} castShadow receiveShadow>
        <boxGeometry args={[WTHK, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color={A_WALL} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[A_X_MIN + 0.02, ROOM_H - 0.5, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.06, ROOM_D - 1]} />
        <meshStandardMaterial color={A_ACCENT} emissive={A_ACCENT} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[A_X_MIN + 0.02, 0.28, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.06, ROOM_D - 1]} />
        <meshStandardMaterial color={A_ACCENT} emissive={A_ACCENT} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* ── Right outer wall: X = +16, Z: -29 to -19 ───────────────────────── */}
      <mesh position={[C_X_MAX + WTHK / 2, ROOM_H / 2, ROOM_CZ]} castShadow receiveShadow>
        <boxGeometry args={[WTHK, ROOM_H, ROOM_D]} />
        <meshStandardMaterial color={C_WALL} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[C_X_MAX - 0.02, ROOM_H - 0.5, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.06, ROOM_D - 1]} />
        <meshStandardMaterial color={C_ACCENT} emissive={C_ACCENT} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[C_X_MAX - 0.02, 0.28, ROOM_CZ]}>
        <boxGeometry args={[0.04, 0.06, ROOM_D - 1]} />
        <meshStandardMaterial color={C_ACCENT} emissive={C_ACCENT} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* ── لوحات المراحل — جدار خلفي كل غرفة، تواجه المدخل ─────────────── */}
      {/* s4 — Room A (amber)  — جدار خلفي Z=-29 */}
      <SillarStagePanel position={[A_CX, 4.5, Z_BACK + 0.18]} rotation={[0, 0, 0]} stageNum={4} />
      {/* s5 — Room B (purple) — جدار خلفي Z=-29 */}
      <SillarStagePanel position={[B_CX, 4.5, Z_BACK + 0.18]} rotation={[0, 0, 0]} stageNum={5} />
      {/* s6 — Room C (teal)   — جدار خلفي Z=-29 */}
      <SillarStagePanel position={[C_CX, 4.5, Z_BACK + 0.18]} rotation={[0, 0, 0]} stageNum={6} />

    </group>
  );
}

export default BackRooms;
