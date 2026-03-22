import * as THREE from "three";

interface DeskProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export function Desk({ position, rotation = [0, 0, 0] }: DeskProps) {
  return (
    <group position={position} rotation={rotation}>
      <ExecutiveDesk />
      <ModernMonitor position={[0, 1.02, -0.22]} />
      <Keyboard     position={[0, 0.78, 0.12]} />
    </group>
  );
}

/* ── المكتب التنفيذي ─────────────────────────────────────────── */
function ExecutiveDesk() {
  // ألوان
  const wood   = new THREE.MeshStandardMaterial({ color: "#1c0f07", roughness: 0.25, metalness: 0.05 });
  const woodTop= new THREE.MeshStandardMaterial({ color: "#2b1507", roughness: 0.15, metalness: 0.08 });
  const chrome = new THREE.MeshStandardMaterial({ color: "#aaaaaa", roughness: 0.05, metalness: 0.98 });
  const glass  = new THREE.MeshStandardMaterial({ color: "#8ecae6", roughness: 0,    metalness: 0.1,
                                                   transparent: true, opacity: 0.18 });
  const dark   = new THREE.MeshStandardMaterial({ color: "#0d0d0d", roughness: 0.3,  metalness: 0.6 });

  return (
    <group>
      {/* ── سطح الطاولة الرئيسي ── */}
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow material={woodTop}>
        <boxGeometry args={[2.2, 0.055, 1.05]} />
      </mesh>

      {/* حافة أمامية معدنية */}
      <mesh position={[0, 0.74, 0.525]} castShadow material={chrome}>
        <boxGeometry args={[2.2, 0.02, 0.012]} />
      </mesh>
      {/* حافة خلفية */}
      <mesh position={[0, 0.74, -0.525]} material={chrome}>
        <boxGeometry args={[2.2, 0.02, 0.012]} />
      </mesh>
      {/* حافة يسار */}
      <mesh position={[-1.1, 0.74, 0]} material={chrome}>
        <boxGeometry args={[0.012, 0.02, 1.05]} />
      </mesh>
      {/* حافة يمين */}
      <mesh position={[1.1, 0.74, 0]} material={chrome}>
        <boxGeometry args={[0.012, 0.02, 1.05]} />
      </mesh>

      {/* طبقة زجاج فوق السطح */}
      <mesh position={[0, 0.79, 0]} material={glass}>
        <boxGeometry args={[2.18, 0.008, 1.03]} />
      </mesh>

      {/* ── القاعدة اليسرى (درج + جسم) ── */}
      {/* جسم القاعدة */}
      <mesh position={[-0.85, 0.36, 0]} castShadow receiveShadow material={wood}>
        <boxGeometry args={[0.48, 0.72, 0.95]} />
      </mesh>
      {/* مقبض درج علوي */}
      <mesh position={[-0.62, 0.56, 0.48]} material={chrome}>
        <boxGeometry args={[0.16, 0.018, 0.018]} />
      </mesh>
      {/* مقبض درج سفلي */}
      <mesh position={[-0.62, 0.30, 0.48]} material={chrome}>
        <boxGeometry args={[0.16, 0.018, 0.018]} />
      </mesh>
      {/* خط فاصل بين الدرجين */}
      <mesh position={[-0.85, 0.43, 0.478]} material={dark}>
        <boxGeometry args={[0.478, 0.006, 0.006]} />
      </mesh>

      {/* ── القاعدة اليمنى (أرفف) ── */}
      <mesh position={[0.85, 0.36, 0]} castShadow receiveShadow material={wood}>
        <boxGeometry args={[0.48, 0.72, 0.95]} />
      </mesh>
      {/* رف داخلي */}
      <mesh position={[0.85, 0.48, 0]} material={wood}>
        <boxGeometry args={[0.46, 0.012, 0.93]} />
      </mesh>

      {/* ── وسط الطاولة (فراغ + لوحة خلفية رفيعة) ── */}
      <mesh position={[0, 0.36, -0.47]} castShadow receiveShadow material={wood}>
        <boxGeometry args={[1.12, 0.72, 0.018]} />
      </mesh>

      {/* ── أرجل كروم في الوسط ── */}
      {([-0.3, 0.3] as number[]).map((x) => (
        <group key={x}>
          {/* عمود عمودي */}
          <mesh position={[x, 0.36, 0.4]} material={chrome}>
            <boxGeometry args={[0.025, 0.72, 0.025]} />
          </mesh>
          {/* قدم أفقية */}
          <mesh position={[x, 0.015, 0.4]} material={chrome}>
            <boxGeometry args={[0.025, 0.03, 0.22]} />
          </mesh>
        </group>
      ))}

      {/* ── قاعدة أرضية (لوحة تحت القاعدتين) ── */}
      <mesh position={[-0.85, 0.012, 0]} receiveShadow material={dark}>
        <boxGeometry args={[0.46, 0.024, 0.9]} />
      </mesh>
      <mesh position={[0.85, 0.012, 0]} receiveShadow material={dark}>
        <boxGeometry args={[0.46, 0.024, 0.9]} />
      </mesh>

      {/* ── لمسة ضوء تحت السطح (ambient glow) ── */}
      <pointLight position={[0, 0.65, 0]} intensity={0.3} color="#ffedd5" distance={1.8} decay={2} />
    </group>
  );
}

/* ── شاشة ── */
function ModernMonitor({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* إطار الشاشة */}
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.52, 0.028]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.15} metalness={0.92} />
      </mesh>
      {/* شاشة مضيئة */}
      <mesh position={[0, 0.005, 0.016]}>
        <planeGeometry args={[0.78, 0.45]} />
        <meshStandardMaterial color="#0d1b2a" emissive="#4fc3f7" emissiveIntensity={0.6} roughness={0.1} />
      </mesh>
      {/* حامل */}
      <mesh position={[0, -0.3, 0.01]} castShadow>
        <boxGeometry args={[0.06, 0.16, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* قاعدة الحامل */}
      <mesh position={[0, -0.39, 0.04]} castShadow>
        <boxGeometry args={[0.28, 0.016, 0.14]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.9} />
      </mesh>
      <pointLight position={[0, 0, 0.35]} intensity={0.5} color="#4fc3f7" distance={1.8} decay={2} />
    </group>
  );
}

/* ── كيبورد ── */
function Keyboard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* جسم الكيبورد */}
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.018, 0.17]} />
        <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* مضيء خفيف على الكيبورد */}
      <mesh position={[0, 0.012, 0]}>
        <planeGeometry args={[0.46, 0.14]} />
        <meshStandardMaterial color="#1a1a2e" emissive="#4fc3f7" emissiveIntensity={0.08} roughness={0.5} />
      </mesh>
    </group>
  );
}
