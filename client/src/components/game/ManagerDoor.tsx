import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGame } from "@/lib/stores/useGame";

interface ManagerDoorProps {
  isLocked: boolean;
}

export function ManagerDoor({ isLocked }: ManagerDoorProps) {
  const [hovered, setHovered] = useState(false);
  const isExteriorView = useGame((s) => s.isExteriorView);
  const doorGroupRef = useRef<THREE.Group>(null);
  const doorAngle = useRef(0);
  const targetAngle = isLocked ? 0 : -Math.PI / 2;

  const doorWidth = 2.2;
  const doorHeight = 4.5;

  useFrame((_, delta) => {
    if (!doorGroupRef.current) return;
    const diff = targetAngle - doorAngle.current;
    if (Math.abs(diff) > 0.01) {
      doorAngle.current += diff * Math.min(delta * 3, 0.15);
      doorGroupRef.current.rotation.y = doorAngle.current;
    } else {
      doorAngle.current = targetAngle;
      doorGroupRef.current.rotation.y = targetAngle;
    }
  });

  return (
    <group position={[7.92, 2.5, -3]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[-(doorWidth / 2 + 0.225), -0.25, -0.12]}>
        <boxGeometry args={[0.45, doorHeight + 0.5, 0.25]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[(doorWidth / 2 + 0.225), -0.25, -0.12]}>
        <boxGeometry args={[0.45, doorHeight + 0.5, 0.25]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, doorHeight / 2 - 0.25 + 0.15, -0.12]}>
        <boxGeometry args={[3.1, 0.3, 0.25]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, -(doorHeight / 2 + 0.25) + 0.1, -0.12]}>
        <boxGeometry args={[3.1, 0.2, 0.25]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.5} />
      </mesh>

      <mesh position={[-(doorWidth / 2 + 0.05), -0.25, -0.05]}>
        <boxGeometry args={[0.1, doorHeight + 0.2, 0.06]} />
        <meshStandardMaterial color="#1a1a28" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[(doorWidth / 2 + 0.05), -0.25, -0.05]}>
        <boxGeometry args={[0.1, doorHeight + 0.2, 0.06]} />
        <meshStandardMaterial color="#1a1a28" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0, doorHeight / 2 - 0.25 + 0.05, -0.05]}>
        <boxGeometry args={[doorWidth + 0.3, 0.1, 0.06]} />
        <meshStandardMaterial color="#1a1a28" roughness={0.4} metalness={0.4} />
      </mesh>

      <group ref={doorGroupRef} position={[doorWidth / 2, 0, 0]}>
        <mesh
          position={[-doorWidth / 2, -0.25, 0.01]}
          onPointerEnter={() => {
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerLeave={() => {
            setHovered(false);
            document.body.style.cursor = "default";
          }}
        >
          <planeGeometry args={[doorWidth, doorHeight]} />
          <meshStandardMaterial
            color={isLocked ? "#4a3020" : "#3a5030"}
            side={THREE.DoubleSide}
            emissive={hovered ? (isLocked ? "#332211" : "#223322") : "#000000"}
            emissiveIntensity={hovered ? 0.4 : 0}
            roughness={0.6}
            metalness={0.1}
          />
        </mesh>

        <mesh position={[-doorWidth / 2, -0.25, 0.015]}>
          <planeGeometry args={[doorWidth - 0.3, doorHeight - 0.3]} />
          <meshStandardMaterial
            color={isLocked ? "#5a3a28" : "#4a5a3a"}
            side={THREE.FrontSide}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>

        <mesh position={[-doorWidth / 2, -0.25, 0.02]}>
          <boxGeometry args={[doorWidth - 0.1, 0.04, 0.02]} />
          <meshStandardMaterial color="#3a2518" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[-doorWidth / 2, 0.8, 0.02]}>
          <boxGeometry args={[doorWidth - 0.1, 0.04, 0.02]} />
          <meshStandardMaterial color="#3a2518" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[-doorWidth / 2, -1.3, 0.02]}>
          <boxGeometry args={[doorWidth - 0.1, 0.04, 0.02]} />
          <meshStandardMaterial color="#3a2518" roughness={0.4} metalness={0.2} />
        </mesh>

        <mesh position={[-doorWidth + 0.85, -0.25, 0.04]}>
          <boxGeometry args={[0.08, 0.3, 0.06]} />
          <meshStandardMaterial color="#c4a44a" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[-doorWidth + 0.85, -0.25, 0.08]}>
          <boxGeometry args={[0.12, 0.05, 0.06]} />
          <meshStandardMaterial color="#d4b45a" roughness={0.2} metalness={0.8} />
        </mesh>

        <mesh position={[-doorWidth + 0.75, -0.6, 0.05]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial
            color={isLocked ? "#ef4444" : "#4ade80"}
            emissive={isLocked ? "#ef4444" : "#4ade80"}
            emissiveIntensity={0.8}
          />
        </mesh>
      </group>

      {!isExteriorView && (
        <Html
          transform
          position={[0, 1.6, 0.05]}
          scale={0.18}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            style={{
              background: hovered ? "rgba(196, 164, 74, 0.95)" : "rgba(42, 26, 16, 0.9)",
              color: hovered ? "#1a1a2e" : "#c4a44a",
              padding: "8px 24px",
              borderRadius: "4px",
              fontSize: "18px",
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "3px",
              textTransform: "uppercase",
              textAlign: "center",
              whiteSpace: "nowrap",
              border: "2px solid #c4a44a",
              transition: "all 0.3s",
            }}
          >
            General Manager
          </div>
        </Html>
      )}

      <pointLight
        position={[0, 2.5, 0.5]}
        intensity={hovered ? 0.4 : 0.2}
        distance={4}
        color="#f5e8c0"
      />
    </group>
  );
}
