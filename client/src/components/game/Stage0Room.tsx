import * as THREE from "three";
import { SillarStagePanel } from "./SillarStagePanel";

export function Stage0Room() {
  const roomWidth  = 8;
  const roomDepth  = 8;
  const roomHeight = 8;

  const wallColor  = "#d4dce8";
  const accentWall = "#050c1e";
  const floorColor = "#2e3a48";
  const baseColor  = "#1a2840";
  const cyan       = "#4fc3f7";

  // Room is centered at world [-12, 0, -3]
  const oX = -12;
  const oZ = -3;

  return (
    <group position={[oX, 0, oZ]}>

      {/* ── Floor ──────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color={floorColor} roughness={0.6} metalness={0.05} />
      </mesh>
      {([-2, 0, 2] as number[]).map((z, i) => (
        <mesh key={`fg-z-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, z]}>
          <planeGeometry args={[roomWidth, 0.04]} />
          <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={0.4} />
        </mesh>
      ))}
      {([-2, 0, 2] as number[]).map((x, i) => (
        <mesh key={`fg-x-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.003, 0]}>
          <planeGeometry args={[0.04, roomDepth]} />
          <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* ── Ceiling ─────────────────────────────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, roomHeight, 0]}>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="#a8e8ff" side={THREE.DoubleSide} transparent opacity={0.18} roughness={0.05} metalness={0.3} />
      </mesh>
      {([-2, 0, 2] as number[]).map((v, i) => (
        <mesh key={`cfx-${i}`} rotation={[Math.PI / 2, 0, 0]} position={[v, roomHeight - 0.01, 0]}>
          <boxGeometry args={[0.07, roomDepth, 0.04]} />
          <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}
      {([-2, 0, 2] as number[]).map((v, i) => (
        <mesh key={`cfz-${i}`} rotation={[Math.PI / 2, 0, Math.PI / 2]} position={[0, roomHeight - 0.01, v]}>
          <boxGeometry args={[0.07, roomWidth, 0.04]} />
          <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}

      {/* ── Back wall (-x) — 3 sections with Stage1 door gap ───────── */}
      <mesh position={[-roomWidth / 2, roomHeight / 2, -2.75]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={accentWall} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[-roomWidth / 2, roomHeight / 2, 2.75]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={accentWall} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[-roomWidth / 2, 6.25, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3, 3.5]} />
        <meshStandardMaterial color={accentWall} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>

      {/* ── Entrance wall (+x) — 3 sections with door gap ──────── */}
      <mesh position={[roomWidth / 2, roomHeight / 2, -2.75]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[roomWidth / 2, roomHeight / 2, 2.75]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[roomWidth / 2, 6.25, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3, 3.5]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>

      {/* ── Side wall (-z) ──────────────────────────────────────── */}
      <mesh position={[0, roomHeight / 2, -roomDepth / 2]} receiveShadow>
        <planeGeometry args={[roomWidth, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>

      {/* ── Side wall (+z) ──────────────────────────────────────── */}
      <mesh position={[0, roomHeight / 2, roomDepth / 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>

      {/* ── Baseboards ──────────────────────────────────────────── */}
      <mesh position={[-roomWidth / 2 + 0.05, 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[roomDepth, 0.15, 0.1]} />
        <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.08, -roomDepth / 2 + 0.05]}>
        <boxGeometry args={[roomWidth, 0.15, 0.1]} />
        <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.08, roomDepth / 2 - 0.05]}>
        <boxGeometry args={[roomWidth, 0.15, 0.1]} />
        <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.4} />
      </mesh>

      {/* ── Cyan neon baseboard glow ─────────────────────────────── */}
      <mesh position={[-roomWidth / 2 + 0.03, 0.19, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[roomDepth, 0.04, 0.02]} />
        <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.19, -roomDepth / 2 + 0.03]}>
        <boxGeometry args={[roomWidth, 0.04, 0.02]} />
        <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.19, roomDepth / 2 - 0.03]}>
        <boxGeometry args={[roomWidth, 0.04, 0.02]} />
        <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={1.5} />
      </mesh>

      {/* ── Ceiling strip light ───────────────────────────────────── */}
      <mesh position={[0, roomHeight - 0.04, 0]}>
        <boxGeometry args={[roomWidth - 2, 0.07, 0.32]} />
        <meshStandardMaterial color="#e8f4ff" emissive="#7aaaff" emissiveIntensity={4} toneMapped={false} />
      </mesh>

      {/* ── Lighting ────────────────────────────────────────────── */}
      <pointLight position={[0,  6, 0]}  intensity={10} distance={15} color="#e8f4ff" />
      <pointLight position={[-3, 3, -2]} intensity={0.6} distance={8}  color={cyan} />
      <pointLight position={[-3, 3,  2]} intensity={0.6} distance={8}  color={cyan} />

      {/* ── Sillar Stage 1 Panel ── */}
      <SillarStagePanel
        position={[0, 4.0, -3.85]}
        rotation={[0, 0, 0]}
        stageNum={1}
      />
    </group>
  );
}
