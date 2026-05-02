import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useGame, getMeetingLayout } from "@/lib/stores/useGame";
import { SillarStagePanel, RoomStageSign } from "./SillarStagePanel";

export function Room() {
  return (
    <group>
      {/* ══════════════════════════════════
          FLOOR & CEILING
      ══════════════════════════════════ */}
      {/* Floor - main hall (box يغطي أرضية المدينة) */}
      <mesh position={[0, -0.09, 0]} receiveShadow>
        <boxGeometry args={[16, 0.18, 16]} />
        <meshStandardMaterial color="#1e2235" roughness={0.75} metalness={0.12} />
      </mesh>
      {/* Tile grid lines X */}
      {([-6, -4, -2, 0, 2, 4, 6] as number[]).map((x, i) => (
        <mesh key={`tgx-${i}`} position={[x, 0.205, 0]}>
          <boxGeometry args={[0.05, 0.01, 16]} />
          <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.5} />
        </mesh>
      ))}
      {/* Tile grid lines Z */}
      {([-6, -4, -2, 0, 2, 4, 6] as number[]).map((z, i) => (
        <mesh key={`tgz-${i}`} position={[0, 0.205, z]}>
          <boxGeometry args={[16, 0.01, 0.05]} />
          <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* Ceiling — glass (BackSide = only visible from above, not from inside) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 8, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial
          color="#a8d8ff"
          side={THREE.BackSide}
          transparent
          opacity={0.18}
          roughness={0.05}
          metalness={0.3}
        />
      </mesh>
      {/* Glass ceiling frame grid */}
      {([-4, 0, 4] as number[]).map((x, i) => (
        <mesh key={`cf-x-${i}`} rotation={[Math.PI / 2, 0, 0]} position={[x, 7.99, 0]}>
          <boxGeometry args={[0.08, 16, 0.05]} />
          <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}
      {([-4, 0, 4] as number[]).map((z, i) => (
        <mesh key={`cf-z-${i}`} rotation={[Math.PI / 2, 0, Math.PI / 2]} position={[0, 7.99, z]}>
          <boxGeometry args={[0.08, 16, 0.05]} />
          <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}

      {/* ══════════════════════════════════
          WALLS
      ══════════════════════════════════ */}
      {/* Back wall removed — gap filler in ProductionHall serves as shared wall */}
      {/* Left wall — 3 sections with doorway gap (z: -4.5→-1.5) matching Stage0Door */}
      <mesh position={[-7.99, 4, -6.25]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3.5, 8]} />
        <meshStandardMaterial color="#161b22" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[-7.99, 6.25, -3]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3, 3.5]} />
        <meshStandardMaterial color="#161b22" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[-7.99, 4, 3.25]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[9.5, 8]} />
        <meshStandardMaterial color="#161b22" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      {/* Right wall — 3 sections with doorway gap (z: -4.5→-1.5, y: 0→4.5) */}
      <mesh position={[7.99, 4, -6.25]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3.5, 8]} />
        <meshStandardMaterial color="#161b22" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[7.99, 6.25, -3]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3, 3.5]} />
        <meshStandardMaterial color="#161b22" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[7.99, 4, 3.25]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[9.5, 8]} />
        <meshStandardMaterial color="#161b22" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      {/* Front wall */}
      <mesh position={[0, 4, 7.99]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color="#161b22" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>

      {/* ══════════════════════════════════
          NEON BASEBOARDS (green)
      ══════════════════════════════════ */}
      <mesh position={[0, 0.06, -6.85]}>
        <boxGeometry args={[16, 0.1, 0.06]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      {/* Left baseboard — split around doorway gap */}
      <mesh position={[-7.95, 0.06, -6.25]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[3.5, 0.1, 0.06]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-7.95, 0.06, 3.25]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[9.5, 0.1, 0.06]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      {/* Right baseboard — split around doorway gap */}
      <mesh position={[7.95, 0.06, -6.25]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[3.5, 0.1, 0.06]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      <mesh position={[7.95, 0.06, 3.25]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[9.5, 0.1, 0.06]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 0.06, 7.95]}>
        <boxGeometry args={[16, 0.1, 0.06]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>

      {/* ══════════════════════════════════
          CEILING LIGHT BARS (3 strips)
      ══════════════════════════════════ */}
      {([-4.5, 0, 4.5] as number[]).map((x, i) => (
        <group key={i} position={[x, 7.88, 0]}>
          <mesh>
            <boxGeometry args={[0.22, 0.1, 14]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} />
          </mesh>
          <pointLight intensity={25} color="#e8f4ff" distance={14} decay={1.5} />
        </group>
      ))}


      {/* ══════════════════════════════════
          LEFT WALL — SERVER RACKS
      ══════════════════════════════════ */}
      <ServerRack position={[-7.3, 0, -6]} />
      {/* ServerRack at z=-3 removed — doorway to Stage0Room */}
      <ServerRack position={[-7.3, 0, 0]} />

      {/* ══════════════════════════════════
          WORKSTATIONS (3 desks)
      ══════════════════════════════════ */}
      <WorkStation position={[-3.5, 0, -5.2]} />
      <WorkStation position={[0,    0, -5.2]} />
      <WorkStation position={[3.5,  0, -5.2]} />

      {/* ══════════════════════════════════
          MEETING TABLE (center)
      ══════════════════════════════════ */}
      <MeetingTable position={[0, 0, 1.5]} />


      {/* ══════════════════════════════════
          PLANTS (Minecraft blocks)
      ══════════════════════════════════ */}
      <BlockPlant position={[7.2, 0, -6.5]} />
      <BlockPlant position={[-5.5, 0, 5.5]} />
      <BlockPlant position={[7.2, 0, 6.5]} />

      {/* ══════════════════════════════════
          COFFEE CORNER
      ══════════════════════════════════ */}
      <CoffeeCorner position={[6.2, 0, 5.5]} />

      {/* ── Sillar Stage 0 Panel — back wall (z=-7.99) ─────── */}
      <SillarStagePanel position={[3.5, 4.0, -6.65]} stageNum={0} />
    </group>
  );
}


/* ════════════════════════════════════════════
   NEON SIGN — company sign above screen
════════════════════════════════════════════ */
function NeonSign({ position }: { position: [number, number, number] }) {
  const isExteriorView = useGame((s) => s.isExteriorView);
  return (
    <group position={position}>
      {/* Sign board */}
      <mesh>
        <boxGeometry args={[5, 0.7, 0.12]} />
        <meshStandardMaterial color="#0d1117" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Green neon glow bar */}
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[4.6, 0.4, 0.04]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={3} />
      </mesh>
      {/* Text label */}
      {!isExteriorView && <Html position={[0, 0, 0.15]} center transform>
        <div style={{
          color: "#00ff88",
          fontFamily: "'Courier New', monospace",
          fontSize: "18px",
          fontWeight: "bold",
          textShadow: "0 0 10px #00ff88, 0 0 20px #00ff88",
          whiteSpace: "nowrap",
          letterSpacing: "4px",
          pointerEvents: "none",
        }}>
          {"{ CODE }"}
        </div>
      </Html>}
      <pointLight intensity={3} color="#00ff88" distance={5} />
    </group>
  );
}

/* ════════════════════════════════════════════
   SERVER RACK
════════════════════════════════════════════ */
function ServerRack({ position }: { position: [number, number, number] }) {
  const units = [0.85, 0.6, 0.35, 0.1, -0.15, -0.4, -0.65, -0.85];
  const ledColors = ["#00ff88", "#00ff88", "#ff4444", "#00ff88", "#00ff88", "#4fc3f7", "#00ff88", "#ff4444"];

  return (
    <group position={position}>
      {/* Rack body */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.55, 2.1, 0.75]} />
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Rack rails */}
      <mesh position={[-0.24, 1.05, 0.38]}>
        <boxGeometry args={[0.04, 2.1, 0.03]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0.24, 1.05, 0.38]}>
        <boxGeometry args={[0.04, 2.1, 0.03]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Server units */}
      {units.map((y, i) => (
        <group key={i} position={[0, 1.05 + y, 0.38]}>
          <mesh>
            <boxGeometry args={[0.46, 0.18, 0.03]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.9} />
          </mesh>
          {/* Status LED */}
          <mesh position={[0.18, 0, 0.025]}>
            <boxGeometry args={[0.03, 0.03, 0.02]} />
            <meshStandardMaterial
              color={ledColors[i]}
              emissive={ledColors[i]}
              emissiveIntensity={2.5}
            />
          </mesh>
          {/* Drive indicator */}
          <mesh position={[0.1, 0, 0.025]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={i % 3 === 0 ? 2 : 0.2} />
          </mesh>
        </group>
      ))}
      {/* Bottom feet */}
      {([-0.2, 0.2] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 0.04, 0]}>
          <boxGeometry args={[0.12, 0.08, 0.7]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
      {/* Ambient glow */}
      <pointLight position={[0.4, 1.05, 0.5]} intensity={0.4} color="#00ff88" distance={2} />
    </group>
  );
}

/* ════════════════════════════════════════════
   WORKSTATION (desk + monitor + keyboard)
════════════════════════════════════════════ */
function WorkStation({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Desk top */}
      <mesh position={[0, 0.76, 0]} castShadow>
        <boxGeometry args={[1.6, 0.08, 0.85]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.15} metalness={0.6} />
      </mesh>
      {/* Neon edge on desk */}
      <mesh position={[0, 0.72, 0.43]}>
        <boxGeometry args={[1.6, 0.03, 0.03]} />
        <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={2} />
      </mesh>
      {/* Legs (4 blocky) */}
      {([[-0.73, 0.38, 0.37], [0.73, 0.38, 0.37], [-0.73, 0.38, -0.37], [0.73, 0.38, -0.37]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.07, 0.76, 0.07]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      {/* Monitor frame */}
      <mesh position={[0, 1.38, -0.32]} castShadow>
        <boxGeometry args={[0.95, 0.6, 0.06]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.15} metalness={0.9} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 1.38, -0.29]}>
        <boxGeometry args={[0.87, 0.52, 0.02]} />
        <meshStandardMaterial color="#001122" emissive="#4fc3f7" emissiveIntensity={0.35} roughness={0.05} />
      </mesh>
      {/* Code line on screen */}
      <mesh position={[0, 1.41, -0.28]}>
        <boxGeometry args={[0.5, 0.04, 0.01]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-0.15, 1.34, -0.28]}>
        <boxGeometry args={[0.3, 0.04, 0.01]} />
        <meshStandardMaterial color="#ff79c6" emissive="#ff79c6" emissiveIntensity={2} />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 1.05, -0.3]}>
        <boxGeometry args={[0.07, 0.3, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.82, -0.3]}>
        <boxGeometry args={[0.28, 0.05, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Keyboard */}
      <mesh position={[0, 0.81, 0.08]}>
        <boxGeometry args={[0.72, 0.025, 0.27]} />
        <meshStandardMaterial color="#1e1e2e" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* RGB keyboard glow */}
      <mesh position={[0, 0.825, 0.08]}>
        <boxGeometry args={[0.68, 0.01, 0.23]} />
        <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.5} />
      </mesh>
      {/* Mouse */}
      <mesh position={[0.42, 0.81, 0.08]}>
        <boxGeometry args={[0.1, 0.025, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Screen glow */}
      <pointLight position={[0, 1.38, -0.15]} intensity={0.6} color="#4fc3f7" distance={2} decay={2} />
    </group>
  );
}

/* ════════════════════════════════════════════
   MEETING TABLE + CHAIRS — ديناميكية حسب عدد الروبوتات
════════════════════════════════════════════ */
function MeetingTable({ position }: { position: [number, number, number] }) {
  const models      = useGame((s) => s.models);
  const hallWorkers = useGame((s) => s.hallWorkers);
  const { tableW, legX, relChairs } = getMeetingLayout(models.length + hallWorkers.length);

  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <boxGeometry args={[tableW, 0.1, 2.0]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.15} metalness={0.5} />
      </mesh>
      {/* Neon edges — تتمدد مع الطاولة */}
      <mesh position={[0, 0.78,  1.01]}>
        <boxGeometry args={[tableW, 0.04, 0.04]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 0.78, -1.01]}>
        <boxGeometry args={[tableW, 0.04, 0.04]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} />
      </mesh>
      {/* الأرجل — تتحرك مع الحواف */}
      {([-legX, legX] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 0.41, 0]} castShadow>
          <boxGeometry args={[0.1, 0.82, 0.1]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      {/* الكراسي — تتولد حسب عدد الروبوتات */}
      {relChairs.map((c, i) => (
        <BlockChair key={i} position={c.pos} rotation={c.rot} />
      ))}
      {/* Table ambient */}
      <pointLight position={[0, 1.5, 0]} intensity={0.4} color="#00ff88" distance={Math.max(4, tableW)} />
    </group>
  );
}

function BlockChair({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Seat */}
      <mesh position={[0, 0.47, 0]} castShadow>
        <boxGeometry args={[0.44, 0.06, 0.44]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.75, -0.2]} castShadow>
        <boxGeometry args={[0.44, 0.52, 0.06]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* 4 legs */}
      {([[-0.18, 0.23, -0.18], [0.18, 0.23, -0.18], [-0.18, 0.23, 0.18], [0.18, 0.23, 0.18]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.04, 0.46, 0.04]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ════════════════════════════════════════════
   WHITEBOARD
════════════════════════════════════════════ */
function Whiteboard({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[0.1, 2.6, 4.0]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* White surface */}
      <mesh position={[-0.07, 0, 0]}>
        <boxGeometry args={[0.04, 2.3, 3.6]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.85} />
      </mesh>
      {/* Diagram lines - architecture diagram style */}
      <mesh position={[-0.1, 0.5, -0.8]}>
        <boxGeometry args={[0.02, 0.5, 0.9]} />
        <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.1, 0.5, 0.3]}>
        <boxGeometry args={[0.02, 0.5, 0.8]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.1, -0.3, -0.3]}>
        <boxGeometry args={[0.02, 0.6, 1.5]} />
        <meshStandardMaterial color="#ff79c6" emissive="#ff79c6" emissiveIntensity={0.4} />
      </mesh>
      {/* Connecting arrow line */}
      <mesh position={[-0.1, 0.5, -0.2]}>
        <boxGeometry args={[0.02, 0.04, 1.1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Whiteboard light */}
      <pointLight position={[-0.5, 0, 0]} intensity={1} color="#ffffff" distance={3} />
    </group>
  );
}

/* ════════════════════════════════════════════
   BLOCK PLANT (Minecraft style)
════════════════════════════════════════════ */
function BlockPlant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.5, 0.44, 0.5]} />
        <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Neon pot rim */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.52, 0.04, 0.52]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={1} />
      </mesh>
      {/* Dirt */}
      <mesh position={[0, 0.47, 0]}>
        <boxGeometry args={[0.46, 0.06, 0.46]} />
        <meshStandardMaterial color="#3d2b1f" roughness={0.99} />
      </mesh>
      {/* Plant - block stack (Minecraft leaves) */}
      <mesh position={[0, 0.84, 0]} castShadow>
        <boxGeometry args={[0.62, 0.6, 0.62]} />
        <meshStandardMaterial color="#1b5e20" roughness={0.85} />
      </mesh>
      <mesh position={[0.28, 1.12, 0.12]} castShadow>
        <boxGeometry args={[0.52, 0.52, 0.52]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.85} />
      </mesh>
      <mesh position={[-0.22, 1.08, -0.18]} castShadow>
        <boxGeometry args={[0.52, 0.52, 0.52]} />
        <meshStandardMaterial color="#1b5e20" roughness={0.85} />
      </mesh>
      <mesh position={[0.08, 1.42, 0.06]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#388e3c" roughness={0.85} />
      </mesh>
      {/* Top tiny block */}
      <mesh position={[0.05, 1.66, 0.02]} castShadow>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshStandardMaterial color="#43a047" roughness={0.85} />
      </mesh>
    </group>
  );
}

/* ════════════════════════════════════════════
   COFFEE CORNER
════════════════════════════════════════════ */
function CoffeeCorner({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Counter base */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[1.3, 1.04, 0.65]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Counter top */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[1.3, 0.06, 0.65]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.15} metalness={0.8} />
      </mesh>
      {/* Neon counter edge */}
      <mesh position={[0, 1.08, 0.33]}>
        <boxGeometry args={[1.3, 0.03, 0.03]} />
        <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={2} />
      </mesh>
      {/* Coffee machine body */}
      <mesh position={[-0.3, 1.42, -0.1]} castShadow>
        <boxGeometry args={[0.38, 0.66, 0.42]} />
        <meshStandardMaterial color="#111111" roughness={0.15} metalness={0.9} />
      </mesh>
      {/* Machine display */}
      <mesh position={[-0.3, 1.52, 0.12]}>
        <boxGeometry args={[0.22, 0.16, 0.02]} />
        <meshStandardMaterial color="#001a11" emissive="#00ff88" emissiveIntensity={1} roughness={0.05} />
      </mesh>
      {/* Brew button */}
      <mesh position={[-0.3, 1.35, 0.12]}>
        <boxGeometry args={[0.08, 0.08, 0.03]} />
        <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={1.5} />
      </mesh>
      {/* Coffee mug */}
      <mesh position={[0.2, 1.12, 0]} castShadow>
        <boxGeometry args={[0.14, 0.16, 0.14]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.6} />
      </mesh>
      {/* Steam (blocks) */}
      <mesh position={[0.2, 1.32, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.05]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0.23, 1.42, 0]}>
        <boxGeometry args={[0.04, 0.06, 0.04]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
      {/* Warm glow */}
      <pointLight position={[0, 1.6, 0.2]} intensity={0.8} color="#ff9900" distance={2.5} decay={2} />
    </group>
  );
}
