import * as THREE from "three";
import { useTexture, Html } from "@react-three/drei";
import { useGame } from "@/lib/stores/useGame";
import { useState } from "react";

export function LogoutDoor() {
  const isExteriorView = useGame((s) => s.isExteriorView);
  const [hovered, setHovered] = useState(false);

  const doorTexture = useTexture("/images/door.png");
  doorTexture.center.set(0.5, 0.5);
  doorTexture.rotation = Math.PI;
  doorTexture.flipY = true;

  const doorWidth = 2.6;
  const doorHeight = 5.2;

  return (
    <group position={[0, 2.7, 7.92]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, -0.1, -0.12]}>
        <boxGeometry args={[doorWidth + 0.5, doorHeight + 0.5, 0.2]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.3} metalness={0.5} />
      </mesh>

      <mesh position={[0, -0.1, -0.05]}>
        <boxGeometry args={[doorWidth + 0.2, doorHeight + 0.2, 0.06]} />
        <meshStandardMaterial color="#1a1a28" roughness={0.4} metalness={0.4} />
      </mesh>

      <mesh
        position={[0, -0.1, 0.01]}
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
          map={doorTexture}
          side={THREE.FrontSide}
          emissive={hovered ? "#222233" : "#000000"}
          emissiveIntensity={hovered ? 0.4 : 0}
        />
      </mesh>

      <mesh position={[0.9, -0.1, 0.04]}>
        <boxGeometry args={[0.08, 0.35, 0.06]} />
        <meshStandardMaterial color="#888" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0.9, -0.1, 0.08]}>
        <boxGeometry args={[0.12, 0.06, 0.06]} />
        <meshStandardMaterial color="#999" roughness={0.2} metalness={0.8} />
      </mesh>

      {!isExteriorView && <Html
        transform
        position={[0, -3.1, 0.05]}
        scale={0.25}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          style={{
            color: hovered ? "#ef4444" : "#999",
            fontSize: "22px",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "5px",
            textTransform: "uppercase",
            textShadow: "0 2px 8px rgba(0,0,0,0.9)",
            textAlign: "center",
            transition: "color 0.3s",
            background: "rgba(0,0,0,0.5)",
            padding: "6px 18px",
            borderRadius: "6px",
          }}
        >
          LOGOUT
        </div>
      </Html>}

      <pointLight
        position={[0, 2.5, 0.5]}
        intensity={hovered ? 0.5 : 0.2}
        distance={4}
        color={hovered ? "#ff6666" : "#f5f0e0"}
      />
    </group>
  );
}
