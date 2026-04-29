/**
 * ProductionHall.tsx
 * Large production hall — interactive sliding doors + modern wall design.
 *
 * World coords:  X -24→+16 (w=40)  Z -7→-19 (d=12)  Y 0→8 (h=8)
 * Doors at world x=-20 (Stage1) and x=+12 (Manager), both at z=-7.
 */

import * as THREE from "three";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls, Html } from "@react-three/drei";
import { useGame } from "@/lib/stores/useGame";
import { SillarStagePanel, RoomStageSign } from "./SillarStagePanel";

type Controls = "forward" | "back" | "left" | "right" | "interact";

// ── Constants ─────────────────────────────────────────────────────────────────
const HALL_CX = -4;
const HALL_CZ = -13;
const HALL_W  = 40;
const HALL_D  = 12;
const HALL_H  = 8;
const X_MIN   = -24;
const X_MAX   =  16;
const Z_FRONT = -7;
const Z_BACK  = -19;
const WTHK    = 0.3;

// Wall palette — deep navy-teal modern industrial
const WALL_BASE   = "#1a2238";   // base wall color
const WALL_PANEL  = "#1e2d4a";   // raised panel inset
const FLOOR_COLOR = "#141820";
const ACCENT_TEAL = "#00c8d4";   // primary neon
const ACCENT_DIM  = "#005f6b";   // dim version for secondary strips

// Door
const DOOR_W = 3.0;
const DOOR_H = 5.0;

// ── Interactive swinging door (same system as Stage1Door) ─────────────────────
function HallDoor({
  cx,
  accentColor,
  storeLock = false,
}: {
  cx: number;
  accentColor: string;
  storeLock?: boolean;
}) {
  const doorGroupRef = useRef<THREE.Group>(null);
  const openRef      = useRef(false);
  const prevInteract = useRef(false);
  const nearbyRef    = useRef(false);
  const doorAngle    = useRef(0);
  const [nearby, setNearby] = useState(false);
  const [open,   setOpen  ] = useState(false);

  const isExteriorView = useGame((s) => s.isExteriorView);
  const [, getKeys] = useKeyboardControls<Controls>();

  useFrame(({ camera }, delta) => {
    const { x: px, z: pz } = useGame.getState().playerPos;
    const dx = Math.abs(px - cx);
    const dz = Math.abs(pz - Z_FRONT);
    const isNear = dx < 4.5 && dz < 6;

    if (isNear !== nearbyRef.current) {
      nearbyRef.current = isNear;
      setNearby(isNear);
    }

    if (storeLock) {
      // Store-controlled: door opens based on which door this is
      const shouldOpen = cx === -20
        ? !useGame.getState().hallDoorLocked
        : !useGame.getState().hall2DoorLocked;
      if (shouldOpen !== openRef.current) {
        openRef.current = shouldOpen;
        setOpen(shouldOpen);
      }
    } else {
      // F key rising edge
      const { interact } = getKeys();
      if (interact && !prevInteract.current && isNear) {
        openRef.current = !openRef.current;
        setOpen(openRef.current);
      }
      prevInteract.current = interact;
    }

    // swing door open/close — same pattern as Stage1Door
    if (doorGroupRef.current) {
      const targetAngle = openRef.current ? Math.PI / 2 : 0;
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

  // Hinge on the left edge of the door (cx - DOOR_W/2)
  // Door panel hangs to the right; swings PI/2 into the hall on open
  return (
    <group position={[cx, 0, Z_FRONT - 0.1]}>

      {/* ── Swinging panel — pivot at left edge ── */}
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
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        ))}
        {/* Handle */}
        <mesh position={[DOOR_W - 0.3, DOOR_H / 2, 0.08]}>
          <boxGeometry args={[0.07, 0.26, 0.07]} />
          <meshStandardMaterial color={accentColor} roughness={0.2} metalness={0.85} />
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

      {/* ── Fixed door frame ── */}
      {/* Left jamb */}
      <mesh position={[-(DOOR_W / 2) - 0.1, DOOR_H / 2, 0]}>
        <boxGeometry args={[0.18, DOOR_H, 0.18]} />
        <meshStandardMaterial color="#1a2545" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[(DOOR_W / 2) + 0.1, DOOR_H / 2, 0]}>
        <boxGeometry args={[0.18, DOOR_H, 0.18]} />
        <meshStandardMaterial color="#1a2545" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Header */}
      <mesh position={[0, DOOR_H + 0.1, 0]}>
        <boxGeometry args={[DOOR_W + 0.36, 0.18, 0.18]} />
        <meshStandardMaterial color="#1a2545" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Header neon */}
      <mesh position={[0, DOOR_H + 0.2, 0]}>
        <boxGeometry args={[DOOR_W + 0.36, 0.04, 0.05]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>

      {/* ── Proximity hint ── */}
      {nearby && !isExteriorView && !storeLock && (
        <Html
          transform
          position={[0, 1.4, -0.3]}
          scale={0.3}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div style={{
            color: "#ffffff",
            background: "rgba(0,10,20,0.82)",
            border: `1px solid ${accentColor}`,
            padding: "6px 16px",
            borderRadius: "8px",
            fontSize: "17px",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
            textAlign: "center",
            direction: "rtl",
            boxShadow: `0 0 12px ${accentColor}55`,
          }}>
            {open ? "F — إغلاق الباب" : "F — فتح الباب"}
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Wall panel strip helper ───────────────────────────────────────────────────
function WallPanels({
  axis,
  positions,
  size,
  baseZ,
  rot,
}: {
  axis:      "x" | "z";
  positions: number[];
  size:      [number, number];   // [width, height]
  baseZ:     number;
  rot:       [number, number, number];
}) {
  return (
    <>
      {positions.map((p, i) => {
        const pos: [number, number, number] =
          axis === "x"
            ? [p, HALL_H / 2, baseZ]
            : [baseZ, HALL_H / 2, p];
        return (
          <mesh key={i} position={pos} rotation={rot}>
            <boxGeometry args={[size[0], size[1], 0.04]} />
            <meshStandardMaterial color={WALL_PANEL} roughness={0.55} metalness={0.25} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ProductionHall() {
  return (
    <group>

      {/* ═══ FLOOR ═══════════════════════════════════════════════════════════ */}
      <mesh position={[HALL_CX, 0.1, HALL_CZ]} receiveShadow>
        <boxGeometry args={[HALL_W, 0.18, HALL_D]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Floor grid — subtle lines */}
      {([-15, -8, -1, 6, 13] as number[]).map((dx, i) => (
        <mesh key={`fgx-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[HALL_CX + dx, 0.2, HALL_CZ]}>
          <planeGeometry args={[0.05, HALL_D]} />
          <meshStandardMaterial color="#1c2535" />
        </mesh>
      ))}
      {([-10, -13, -16] as number[]).map((z, i) => (
        <mesh key={`fgz-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[HALL_CX, 0.2, z]}>
          <planeGeometry args={[HALL_W, 0.05]} />
          <meshStandardMaterial color="#1c2535" />
        </mesh>
      ))}

      {/* Floor perimeter teal neon */}
      <mesh position={[HALL_CX, 0.012, Z_BACK + 0.18]}>
        <boxGeometry args={[HALL_W - 0.6, 0.03, 0.05]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[X_MIN + 0.18, 0.012, HALL_CZ]}>
        <boxGeometry args={[0.05, 0.03, HALL_D - 0.6]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[X_MAX - 0.18, 0.012, HALL_CZ]}>
        <boxGeometry args={[0.05, 0.03, HALL_D - 0.6]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* ═══ CEILING — glass ═════════════════════════════════════════════════ */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[HALL_CX, HALL_H, HALL_CZ]}>
        <planeGeometry args={[HALL_W, HALL_D]} />
        <meshStandardMaterial
          color="#c0cce8"
          side={THREE.BackSide}
          transparent
          opacity={0.16}
          roughness={0.05}
          metalness={0.3}
        />
      </mesh>

      {/* Ceiling grid — z bars (span full width in X, stay within hall) */}
      {([-9, -13, -17] as number[]).map((z, i) => (
        <mesh key={`cgz-${i}`} position={[HALL_CX, HALL_H - 0.02, z]}>
          <boxGeometry args={[HALL_W, 0.04, 0.08]} />
          <meshStandardMaterial color="#2a3a58" emissive="#2a3a58" emissiveIntensity={0.2} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}
      {/* Ceiling grid — x bars (span full depth in Z, stay within hall) */}
      {([-20, -12, -4, 4, 12] as number[]).map((x, i) => (
        <mesh key={`cgx-${i}`} position={[x, HALL_H - 0.02, HALL_CZ]}>
          <boxGeometry args={[0.08, 0.04, HALL_D]} />
          <meshStandardMaterial color="#2a3a58" emissive="#2a3a58" emissiveIntensity={0.2} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}

      {/* ═══ BACK WALL (z = -19) — 4 segments with 3 door openings ══════════ */}
      {/*
          Door A center: x=-17.5  opening: -19 to -16
          Door B center: x=-3.5   opening:  -5 to  -2
          Door C center: x=+10    opening: +8.5 to +11.5
          Seg1: -24 to -19  (W=5,  center=-21.5)
          Seg2: -16 to -5   (W=11, center=-10.5)
          Seg3:  -2 to +8.5 (W=10.5, center=3.25)
          Seg4: +11.5 to +16 (W=4.5, center=13.75)
      */}
      {/* Seg 1 — leftmost */}
      <mesh position={[-21.5, HALL_H / 2, Z_BACK - WTHK / 2]} castShadow receiveShadow>
        <boxGeometry args={[5, HALL_H, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Seg 2 — between door A and B */}
      <mesh position={[-10.5, HALL_H / 2, Z_BACK - WTHK / 2]} castShadow receiveShadow>
        <boxGeometry args={[11, HALL_H, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Seg 3 — between door B and C */}
      <mesh position={[3.25, HALL_H / 2, Z_BACK - WTHK / 2]} castShadow receiveShadow>
        <boxGeometry args={[10.5, HALL_H, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Seg 4 — rightmost */}
      <mesh position={[13.75, HALL_H / 2, Z_BACK - WTHK / 2]} castShadow receiveShadow>
        <boxGeometry args={[4.5, HALL_H, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Above door A (y: 5→8, h=3) */}
      <mesh position={[-17.5, DOOR_H + 1.5, Z_BACK - WTHK / 2]}>
        <boxGeometry args={[DOOR_W, 3, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Above door B */}
      <mesh position={[-3.5, DOOR_H + 1.5, Z_BACK - WTHK / 2]}>
        <boxGeometry args={[DOOR_W, 3, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Above door C */}
      <mesh position={[10, DOOR_H + 1.5, Z_BACK - WTHK / 2]}>
        <boxGeometry args={[DOOR_W, 3, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Back wall top neon — segmented (skips door gaps) */}
      <mesh position={[-21.5, HALL_H - 0.5, Z_BACK + 0.02]}>
        <boxGeometry args={[4.5, 0.06, 0.04]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[-10.5, HALL_H - 0.5, Z_BACK + 0.02]}>
        <boxGeometry args={[10.5, 0.06, 0.04]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[3.25, HALL_H - 0.5, Z_BACK + 0.02]}>
        <boxGeometry args={[10, 0.06, 0.04]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <mesh position={[13.75, HALL_H - 0.5, Z_BACK + 0.02]}>
        <boxGeometry args={[4, 0.06, 0.04]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* ═══ LEFT WALL (x = -24) ════════════════════════════════════════════ */}
      <mesh position={[X_MIN - WTHK / 2, HALL_H / 2, HALL_CZ]} castShadow receiveShadow>
        <boxGeometry args={[WTHK, HALL_H, HALL_D]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Left wall panel inset */}
      <mesh position={[X_MIN + 0.02, HALL_H / 2, HALL_CZ]}>
        <boxGeometry args={[0.04, HALL_H - 1.2, HALL_D - 2]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.55} metalness={0.25} />
      </mesh>
      {/* Left wall top neon */}
      <mesh position={[X_MIN + 0.02, HALL_H - 0.5, HALL_CZ]}>
        <boxGeometry args={[0.04, 0.06, HALL_D - 1]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* Left wall bottom neon */}
      <mesh position={[X_MIN + 0.02, 0.28, HALL_CZ]}>
        <boxGeometry args={[0.04, 0.06, HALL_D - 1]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* ═══ RIGHT WALL (x = +16) ═══════════════════════════════════════════ */}
      <mesh position={[X_MAX + WTHK / 2, HALL_H / 2, HALL_CZ]} castShadow receiveShadow>
        <boxGeometry args={[WTHK, HALL_H, HALL_D]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Right wall panel inset */}
      <mesh position={[X_MAX - 0.02, HALL_H / 2, HALL_CZ]}>
        <boxGeometry args={[0.04, HALL_H - 1.2, HALL_D - 2]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.55} metalness={0.25} />
      </mesh>
      {/* Right wall top neon */}
      <mesh position={[X_MAX - 0.02, HALL_H - 0.5, HALL_CZ]}>
        <boxGeometry args={[0.04, 0.06, HALL_D - 1]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* Right wall bottom neon */}
      <mesh position={[X_MAX - 0.02, 0.28, HALL_CZ]}>
        <boxGeometry args={[0.04, 0.06, HALL_D - 1]} />
        <meshStandardMaterial color={ACCENT_TEAL} emissive={ACCENT_TEAL} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* ═══ FRONT PARTIAL WALL gap filler (x = -8 → +8) ═══════════════════ */}
      <mesh position={[0, HALL_H / 2, Z_FRONT + WTHK / 2]}>
        <boxGeometry args={[16, HALL_H, WTHK]} />
        <meshStandardMaterial color={WALL_BASE} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Gap filler raised panel */}
      <mesh position={[0, HALL_H / 2, Z_FRONT + 0.18]}>
        <boxGeometry args={[15, HALL_H - 1.2, 0.04]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.55} metalness={0.25} />
      </mesh>

      {/* ═══ INTERACTIVE DOORS ═══════════════════════════════════════════════ */}
      {/* Stage1 door — purple accent (matches Stage1Room theme), keypad-locked */}
      <HallDoor cx={-20} accentColor="#a855f7" storeLock />
      {/* Manager door — gold accent (matches ManagerRoom theme), keypad-locked */}
      <HallDoor cx={ 12} accentColor="#c4a44a" storeLock />

      {/* ═══ CEILING STRIP LIGHTS ════════════════════════════════════════════ */}
      {([-9, -13, -17] as number[]).map((z, row) => (
        <group key={`row-${row}`}>
          <mesh position={[HALL_CX, HALL_H - 0.04, z]}>
            <boxGeometry args={[HALL_W - 6, 0.07, 0.32]} />
            <meshStandardMaterial
              color="#e8f4ff"
              emissive="#7aaaff"
              emissiveIntensity={4}
              toneMapped={false}
            />
          </mesh>
          <pointLight position={[-13, HALL_H - 0.5, z]} color="#b0ccff" intensity={10} distance={15} />
          <pointLight position={[  5, HALL_H - 0.5, z]} color="#b0ccff" intensity={10} distance={15} />
        </group>
      ))}

      {/* Teal accent point lights near doors */}
      <pointLight position={[-20, 3, Z_FRONT - 1]} color={ACCENT_TEAL} intensity={3} distance={6} />
      <pointLight position={[ 12, 3, Z_FRONT - 1]} color="#c4a44a"    intensity={3} distance={6} />

      {/* Ambient fill */}
      <pointLight position={[HALL_CX, 3.5, HALL_CZ]} color="#6688aa" intensity={2.5} distance={24} />

      {/* ── Sillar Stage 3 Panel — on left side wall (X_MIN), facing +X ── */}
      <SillarStagePanel
        position={[X_MIN + 0.15, 4.5, HALL_CZ]}
        rotation={[0, Math.PI / 2, 0]}
        stageNum={3}
      />
      {/* Sign on right wall (X_MAX), no door */}
      <RoomStageSign
        position={[X_MAX - 0.05, 6.3, HALL_CZ]}
        rotation={[0, -Math.PI / 2, 0]}
        stageNum={3}
      />

    </group>
  );
}

export default ProductionHall;
