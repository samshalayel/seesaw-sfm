import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGame } from "@/lib/stores/useGame";

/**
 * Stage1Door — on the BACK wall of Stage0 (x ≈ −16), z = −3.
 * Opens only when the player is carrying the S0 glass box (carryingBox = true).
 */
export function Stage1Door() {
  const [hovered, setHovered] = useState(false);
  const isLocked       = useGame((s) => s.stage1DoorLocked);
  const isExteriorView = useGame((s) => s.isExteriorView);

  const doorGroupRef = useRef<THREE.Group>(null);
  const doorAngle    = useRef(0);
  const targetAngle  = isLocked ? 0 : -Math.PI / 2;

  const doorWidth  = 2.2;
  const doorHeight = 4.5;
  const purple     = "#a855f7";
  const dark       = "#1a0a28";

  useFrame((_, delta) => {
    if (!doorGroupRef.current) return;
    const diff = targetAngle - doorAngle.current;
    if (Math.abs(diff) > 0.005) {
      doorAngle.current += diff * Math.min(delta * 3, 0.15);
      doorGroupRef.current.rotation.y = doorAngle.current;
    } else {
      doorAngle.current = targetAngle;
      doorGroupRef.current.rotation.y = targetAngle;
    }
  });

  return (
    <group position={[-15.82, 2.5, -3]} rotation={[0, Math.PI / 2, 0]}>

      {/* ── Frame ───────────────────────────────────────────────── */}
      <mesh position={[-(doorWidth / 2 + 0.225), -0.25, -0.12]}>
        <boxGeometry args={[0.45, doorHeight + 0.5, 0.25]} />
        <meshStandardMaterial color={dark} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[(doorWidth / 2 + 0.225), -0.25, -0.12]}>
        <boxGeometry args={[0.45, doorHeight + 0.5, 0.25]} />
        <meshStandardMaterial color={dark} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, doorHeight / 2 - 0.1, -0.12]}>
        <boxGeometry args={[3.1, 0.3, 0.25]} />
        <meshStandardMaterial color={dark} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, -(doorHeight / 2 + 0.25) + 0.1, -0.12]}>
        <boxGeometry args={[3.1, 0.2, 0.25]} />
        <meshStandardMaterial color={dark} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Purple neon frame trim */}
      <mesh position={[-(doorWidth / 2 + 0.05), -0.25, -0.05]}>
        <boxGeometry args={[0.1, doorHeight + 0.2, 0.06]} />
        <meshStandardMaterial color={purple} emissive={purple} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[(doorWidth / 2 + 0.05), -0.25, -0.05]}>
        <boxGeometry args={[0.1, doorHeight + 0.2, 0.06]} />
        <meshStandardMaterial color={purple} emissive={purple} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, doorHeight / 2 - 0.1 + 0.05, -0.05]}>
        <boxGeometry args={[doorWidth + 0.3, 0.1, 0.06]} />
        <meshStandardMaterial color={purple} emissive={purple} emissiveIntensity={0.5} />
      </mesh>

      {/* ── Door panel (animated) ────────────────────────────────── */}
      <group ref={doorGroupRef} position={[doorWidth / 2, 0, 0]}>
        {/* Main face */}
        <mesh
          position={[-doorWidth / 2, -0.25, 0.01]}
          onPointerEnter={() => { setHovered(true);  document.body.style.cursor = "pointer"; }}
          onPointerLeave={() => { setHovered(false); document.body.style.cursor = "default"; }}
        >
          <planeGeometry args={[doorWidth, doorHeight]} />
          <meshStandardMaterial
            color={isLocked ? "#0e0818" : "#120828"}
            side={THREE.DoubleSide}
            emissive={hovered ? (isLocked ? "#1a0828" : "#1a0840") : "#000000"}
            emissiveIntensity={hovered ? 0.4 : 0}
            roughness={0.6}
            metalness={0.25}
          />
        </mesh>
        {/* Inner panel */}
        <mesh position={[-doorWidth / 2, -0.25, 0.016]}>
          <planeGeometry args={[doorWidth - 0.3, doorHeight - 0.3]} />
          <meshStandardMaterial
            color={isLocked ? "#180a22" : "#1a1032"}
            side={THREE.FrontSide}
            roughness={0.7}
          />
        </mesh>
        {/* Horizontal accent lines */}
        {([-0.25, 0.8, -1.3] as number[]).map((y, i) => (
          <mesh key={i} position={[-doorWidth / 2, y, 0.022]}>
            <boxGeometry args={[doorWidth - 0.1, 0.035, 0.018]} />
            <meshStandardMaterial
              color={isLocked ? "#881122" : purple}
              emissive={isLocked ? "#881122" : purple}
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
        {/* Handle */}
        <mesh position={[-doorWidth + 0.85, -0.25, 0.04]}>
          <boxGeometry args={[0.08, 0.28, 0.06]} />
          <meshStandardMaterial color={isLocked ? "#993322" : purple} roughness={0.2} metalness={0.8} />
        </mesh>
        {/* Lock indicator dot */}
        <mesh position={[-doorWidth + 0.75, -0.6, 0.05]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial
            color={isLocked ? "#ef4444" : "#4ade80"}
            emissive={isLocked ? "#ef4444" : "#4ade80"}
            emissiveIntensity={0.9}
          />
        </mesh>
      </group>

      {/* ── Sign ────────────────────────────────────────────────── */}
      {!isExteriorView && <Html
        transform
        position={[0, 1.7, 0.06]}
        scale={0.17}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{
          background:    hovered ? "#a78bfa" : "rgba(12,5,28,0.96)",
          color:         hovered ? "#0c051c" : "#ffffff",
          padding:       "6px 20px 7px",
          borderRadius:  "4px",
          fontSize:      "15px",
          fontWeight:    "800",
          fontFamily:    "Inter, sans-serif",
          letterSpacing: "2.5px",
          textTransform: "uppercase",
          textAlign:     "center",
          whiteSpace:    "nowrap",
          border:        `2px solid ${isLocked ? "#ef4444" : "#a78bfa"}`,
          transition:    "all 0.3s",
          lineHeight:    "1.5",
        }}>
          Stage 2
          <br />
          <span style={{ fontSize: "9px", letterSpacing: "1.5px", color: hovered ? "#0c051c" : "#d8c8ff" }}>
            {isLocked ? "🔒 مقفل" : "Architecture Design"}
          </span>
        </div>
      </Html>}

      <pointLight
        position={[0, 2.5, 0.5]}
        intensity={hovered ? 0.55 : 0.28}
        distance={4}
        color={isLocked ? "#ff4444" : purple}
      />
    </group>
  );
}
