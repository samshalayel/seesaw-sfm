import * as THREE from "three";
import { useTexture } from "@react-three/drei";

export function ManagerRoom() {
  const woodTexture = useTexture("/textures/wood.jpg");
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(4, 4);

  const logoTexture = useTexture("/textures/sillar_logo.png");

  const roomWidth = 8;
  const roomDepth = 8;
  const roomHeight = 8;
  const wallColor = "#e8e0d4";
  const accentWall = "#1a1520";
  const floorTint = "#c4a882";
  const ceilingColor = "#fafafa";
  const baseboardColor = "#2a2a3e";

  const offsetX = 12;
  const offsetZ = -3;

  return (
    <group position={[offsetX, 0, offsetZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial map={woodTexture} color={floorTint} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* ── Ceiling — glass ─────────────────────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, roomHeight, 0]}>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial
          color="#fff8e8"
          side={THREE.DoubleSide}
          transparent
          opacity={0.18}
          roughness={0.05}
          metalness={0.3}
        />
      </mesh>
      {/* Ceiling frame grid — gold */}
      {([-2, 0, 2] as number[]).map((v, i) => (
        <mesh key={`cfx-${i}`} rotation={[Math.PI / 2, 0, 0]} position={[v, roomHeight - 0.01, 0]}>
          <boxGeometry args={[0.07, roomDepth, 0.04]} />
          <meshStandardMaterial color="#c4a44a" emissive="#c4a44a" emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}
      {([-2, 0, 2] as number[]).map((v, i) => (
        <mesh key={`cfz-${i}`} rotation={[Math.PI / 2, 0, Math.PI / 2]} position={[0, roomHeight - 0.01, v]}>
          <boxGeometry args={[0.07, roomWidth, 0.04]} />
          <meshStandardMaterial color="#c4a44a" emissive="#c4a44a" emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
        </mesh>
      ))}

      {/* ── Back wall (-z) — split for production-hall door at x=0 ── */}
      {/* Left section: x -4 to -1.5 (width 2.5) */}
      <mesh position={[-2.75, roomHeight / 2, -roomDepth / 2]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={accentWall} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      {/* Right section: x 1.5 to 4 (width 2.5) */}
      <mesh position={[2.75, roomHeight / 2, -roomDepth / 2]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={accentWall} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      {/* Lintel above door: x -1.5 to 1.5 (width 3), y 5 to 8 */}
      <mesh position={[0, 6.5, -roomDepth / 2]} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial color={accentWall} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>

      <mesh position={[roomWidth / 2, roomHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[roomDepth, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>

      <mesh position={[0, roomHeight / 2, roomDepth / 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>

      <mesh position={[-roomWidth / 2, roomHeight / 2, -2.75]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[-roomWidth / 2, roomHeight / 2, 2.75]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[2.5, roomHeight]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[-roomWidth / 2, 6.25, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3, 3.5]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>

      {/* Baseboard on -z back wall — split for door opening */}
      <mesh position={[-2.75, 0.08, -roomDepth / 2 + 0.05]}>
        <boxGeometry args={[2.5, 0.15, 0.1]} />
        <meshStandardMaterial color={baseboardColor} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[2.75, 0.08, -roomDepth / 2 + 0.05]}>
        <boxGeometry args={[2.5, 0.15, 0.1]} />
        <meshStandardMaterial color={baseboardColor} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[roomWidth / 2 - 0.05, 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[roomDepth, 0.15, 0.1]} />
        <meshStandardMaterial color={baseboardColor} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.08, roomDepth / 2 - 0.05]}>
        <boxGeometry args={[roomWidth, 0.15, 0.1]} />
        <meshStandardMaterial color={baseboardColor} roughness={0.3} metalness={0.4} />
      </mesh>

      <ModernTDesk position={[0, 0, -1.2]} />

      <ExecutiveChair position={[0, 0, 1]} />

      <SmallLogoFrame position={[-3.95, 2.8, -2.75]} logoTexture={logoTexture} />

      <VaultSafe position={[3.2, 0, -3]} />

      <DecoPlant position={[-3.2, 0, -3]} />
      <DecoPlant position={[3.2, 0, 3]} scale={0.8} />

      <Rug />

      <CeilingLight position={[0, 7.9, 0]} />
      <CeilingLight position={[-2, 7.9, -2]} />
      <CeilingLight position={[2, 7.9, 2]} />

      <pointLight position={[0, 6, 0]} intensity={0.8} distance={14} color="#f5f0e0" />
      <pointLight position={[0, 3, -1]} intensity={0.5} distance={10} color="#fff5e0" />

      <spotLight position={[0, 5, -3.5]} target-position={[0, 3.5, -4]} angle={0.4} penumbra={0.5} intensity={0.6} distance={6} color="#ffe8c0" />
    </group>
  );
}

function ModernTDesk({ position }: { position: [number, number, number] }) {
  const deskHeight = 0.76;
  const thickness = 0.05;

  const topWidth = 3.2;
  const topDepth = 1.0;
  const stemWidth = 1.4;
  const stemDepth = 1.6;

  const surfaceColor = "#1a1a2e";
  const edgeColor = "#c4a44a";
  const legColor = "#2a2a3e";

  return (
    <group position={position}>
      <mesh position={[0, deskHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[topWidth, thickness, topDepth]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh position={[0, deskHeight + thickness / 2 + 0.003, 0]}>
        <boxGeometry args={[topWidth + 0.02, 0.006, topDepth + 0.02]} />
        <meshStandardMaterial color={edgeColor} roughness={0.2} metalness={0.7} />
      </mesh>

      <mesh position={[0, deskHeight, topDepth / 2 + stemDepth / 2]} castShadow receiveShadow>
        <boxGeometry args={[stemWidth, thickness, stemDepth]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh position={[0, deskHeight + thickness / 2 + 0.003, topDepth / 2 + stemDepth / 2]}>
        <boxGeometry args={[stemWidth + 0.02, 0.006, stemDepth + 0.02]} />
        <meshStandardMaterial color={edgeColor} roughness={0.2} metalness={0.7} />
      </mesh>

      <mesh position={[-(topWidth / 2 - 0.15), deskHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.06, deskHeight, topDepth - 0.1]} />
        <meshStandardMaterial color={legColor} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[(topWidth / 2 - 0.15), deskHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.06, deskHeight, topDepth - 0.1]} />
        <meshStandardMaterial color={legColor} roughness={0.3} metalness={0.5} />
      </mesh>

      <mesh position={[0, deskHeight / 2, topDepth / 2 + stemDepth - 0.15]} castShadow>
        <boxGeometry args={[stemWidth - 0.2, deskHeight, 0.06]} />
        <meshStandardMaterial color={legColor} roughness={0.3} metalness={0.5} />
      </mesh>

      <mesh position={[-(topWidth / 2 - 0.15), 0.03, 0]}>
        <boxGeometry args={[0.08, 0.06, topDepth - 0.05]} />
        <meshStandardMaterial color={edgeColor} roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[(topWidth / 2 - 0.15), 0.03, 0]}>
        <boxGeometry args={[0.08, 0.06, topDepth - 0.05]} />
        <meshStandardMaterial color={edgeColor} roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.03, topDepth / 2 + stemDepth - 0.15]}>
        <boxGeometry args={[stemWidth - 0.15, 0.06, 0.08]} />
        <meshStandardMaterial color={edgeColor} roughness={0.2} metalness={0.7} />
      </mesh>

      <WideMonitor position={[-0.5, deskHeight + 0.35, -0.15]} />
      <Laptop position={[0.8, deskHeight + 0.02, -0.1]} />
      <DeskLamp position={[-1.3, deskHeight + 0.01, -0.3]} />
      <PenHolder position={[1.3, deskHeight + 0.01, 0.1]} />
      <PhoneStand position={[0.2, deskHeight + 0.01, topDepth / 2 + 0.3]} />
    </group>
  );
}

function WideMonitor({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[1.0, 0.55, 0.03]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.22, 0.016]}>
        <planeGeometry args={[0.92, 0.48]} />
        <meshStandardMaterial color="#0a1525" emissive="#0a2040" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, -0.06, 0.01]} castShadow>
        <boxGeometry args={[0.04, 0.14, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, -0.13, 0.01]} castShadow>
        <boxGeometry args={[0.3, 0.015, 0.18]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.6} />
      </mesh>
    </group>
  );
}

function Laptop({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.01, 0]} castShadow>
        <boxGeometry args={[0.4, 0.02, 0.28]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.15, -0.13]} rotation={[-0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.38, 0.26, 0.01]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.155, -0.125]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[0.34, 0.22]} />
        <meshStandardMaterial color="#0a1020" emissive="#0a1530" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function DeskLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.04, 12]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 8]} />
        <meshStandardMaterial color="#c4a44a" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0.06, 0.38, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
        <meshStandardMaterial color="#c4a44a" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0.14, 0.44, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.06, 0.1, 12]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.5} />
      </mesh>
      <pointLight position={[0.18, 0.38, 0]} intensity={0.3} distance={2} color="#ffe8b0" />
    </group>
  );
}

function PenHolder({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.1, 8]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0.01, 0.12, 0]} rotation={[0.05, 0, 0.02]}>
        <cylinderGeometry args={[0.005, 0.005, 0.1, 6]} />
        <meshStandardMaterial color="#c4a44a" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[-0.01, 0.11, 0.01]} rotation={[-0.05, 0, -0.03]}>
        <cylinderGeometry args={[0.005, 0.005, 0.09, 6]} />
        <meshStandardMaterial color="#333" roughness={0.4} />
      </mesh>
    </group>
  );
}

function PhoneStand({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.12, 0.06]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.08, 0.01]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[0.065, 0.1]} />
        <meshStandardMaterial color="#0a0a15" emissive="#0a1525" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function ExecutiveChair({ position }: { position: [number, number, number] }) {
  const seatColor = "#1a1a2e";
  const metalColor = "#c4a44a";

  return (
    <group position={position}>
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[0.55, 0.08, 0.55]} />
        <meshStandardMaterial color={seatColor} roughness={0.4} metalness={0.3} />
      </mesh>

      <mesh position={[0, 0.85, -0.24]} castShadow>
        <boxGeometry args={[0.55, 0.8, 0.06]} />
        <meshStandardMaterial color={seatColor} roughness={0.4} metalness={0.3} />
      </mesh>

      <mesh position={[0, 1.28, -0.24]} castShadow>
        <boxGeometry args={[0.5, 0.12, 0.08]} />
        <meshStandardMaterial color={seatColor} roughness={0.4} metalness={0.3} />
      </mesh>

      <mesh position={[-0.3, 0.65, 0]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.3]} />
        <meshStandardMaterial color={seatColor} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.3, 0.65, 0]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.3]} />
        <meshStandardMaterial color={seatColor} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-0.3, 0.56, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
        <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0.3, 0.56, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
        <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.8} />
      </mesh>

      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.45, 8]} />
        <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.8} />
      </mesh>

      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <group key={i}>
            <mesh position={[Math.cos(angle) * 0.22, 0.04, Math.sin(angle) * 0.22]} rotation={[0, angle, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, 0.44, 6]} />
              <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.7} />
            </mesh>
            <mesh position={[Math.cos(angle) * 0.4, 0.02, Math.sin(angle) * 0.4]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial color="#222" roughness={0.3} metalness={0.5} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function SmallLogoFrame({ position, logoTexture }: { position: [number, number, number]; logoTexture: THREE.Texture }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.02]} castShadow>
        <boxGeometry args={[1.2, 0.8, 0.04]} />
        <meshStandardMaterial color="#c4a44a" roughness={0.2} metalness={0.8} />
      </mesh>

      <mesh position={[0, 0, -0.005]}>
        <boxGeometry args={[1.05, 0.65, 0.03]} />
        <meshStandardMaterial color="#fff" roughness={0.9} />
      </mesh>

      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[0.9, 0.55]} />
        <meshStandardMaterial map={logoTexture} transparent side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

function VaultSafe({ position }: { position: [number, number, number] }) {
  const bodyColor = "#2a2a3e";
  const doorColor = "#333348";
  const metalColor = "#c4a44a";
  const darkMetal = "#1a1a28";

  return (
    <group position={position}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[1.2, 2.0, 0.9]} />
        <meshStandardMaterial color={bodyColor} roughness={0.2} metalness={0.6} />
      </mesh>

      <mesh position={[0, 1.0, 0.451]}>
        <boxGeometry args={[1.1, 1.9, 0.02]} />
        <meshStandardMaterial color={doorColor} roughness={0.15} metalness={0.7} />
      </mesh>

      <mesh position={[0, 1.0, 0.465]}>
        <boxGeometry args={[1.0, 1.8, 0.01]} />
        <meshStandardMaterial color={darkMetal} roughness={0.2} metalness={0.6} />
      </mesh>

      <mesh position={[0, 1.2, 0.48]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.18, 0.025, 8, 24]} />
        <meshStandardMaterial color={metalColor} roughness={0.15} metalness={0.9} />
      </mesh>

      <mesh position={[0, 1.2, 0.47]}>
        <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
        <meshStandardMaterial color={darkMetal} roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.2, 0.485]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.04, 6]} />
        <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[0, 1.2, 0.485]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.04, 6]} />
        <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {[0.5, 0.7, 0.9, 1.1].map((y, i) => (
        <mesh key={`bolt-l-${i}`} position={[-0.48, y + 0.3, 0.47]}>
          <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
          <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.85} />
        </mesh>
      ))}
      {[0.5, 0.7, 0.9, 1.1].map((y, i) => (
        <mesh key={`bolt-r-${i}`} position={[0.48, y + 0.3, 0.47]}>
          <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
          <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.85} />
        </mesh>
      ))}

      <mesh position={[0.42, 1.0, 0.48]}>
        <boxGeometry args={[0.08, 0.25, 0.04]} />
        <meshStandardMaterial color={metalColor} roughness={0.15} metalness={0.9} />
      </mesh>

      <mesh position={[0, 1.95, 0.46]}>
        <boxGeometry args={[1.05, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.05, 0.46]}>
        <boxGeometry args={[1.05, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} roughness={0.2} metalness={0.85} />
      </mesh>

      <mesh position={[0, 0.6, 0.48]}>
        <boxGeometry args={[0.25, 0.12, 0.02]} />
        <meshStandardMaterial color={darkMetal} roughness={0.1} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.6, 0.495]}>
        <boxGeometry args={[0.18, 0.06, 0.01]} />
        <meshStandardMaterial color="#0a0a12" roughness={0.1} metalness={0.5} />
      </mesh>
    </group>
  );
}

function DecoPlant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.7, 8]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.1, 8]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#1a4a2a" roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 1.1, 0.08]} castShadow>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#2a5a3a" roughness={0.8} />
      </mesh>
      <mesh position={[-0.08, 1.05, -0.1]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#1a5030" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Rug() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.5]} receiveShadow>
      <planeGeometry args={[4, 3]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.0, 0.06, 0.35]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      <pointLight position={[0, -0.5, 0]} intensity={0.5} distance={8} color="#f5f0e0" />
    </group>
  );
}
