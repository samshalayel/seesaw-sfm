import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import React, { Suspense, useRef, useState, useEffect, useCallback, Component, useMemo } from "react";
import * as THREE from "three";
import { VoiceChat }      from "../components/VoiceChat";
import { VoiceRoomPanel } from "../components/VoiceRoomPanel";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message { role: "user" | "assistant"; content: string; }

// ─── Error Boundary ───────────────────────────────────────────────────────────
class SceneErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="red" />
        </mesh>
      );
    }
    return this.props.children;
  }
}

// ─── Room ─────────────────────────────────────────────────────────────────────
function Room() {
  return (
    <>
      {/* أرضية — باركيه فاتح دافئ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0.001, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#c8b99a" roughness={0.35} metalness={0.04}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* جدار خلفي — داكن (accent wall) */}
      <mesh position={[0, 2.5, -5]} receiveShadow>
        <boxGeometry args={[14, 5, 0.12]} />
        <meshStandardMaterial color="#1a1e2a" roughness={0.75} />
      </mesh>
      {/* جدار يسار */}
      <mesh position={[-7, 2.5, 0]}>
        <boxGeometry args={[0.12, 5, 10]} />
        <meshStandardMaterial color="#f0ece6" roughness={0.88} />
      </mesh>
      {/* جدار يمين */}
      <mesh position={[7, 2.5, 0]}>
        <boxGeometry args={[0.12, 5, 10]} />
        <meshStandardMaterial color="#f0ece6" roughness={0.88} />
      </mesh>
      {/* جدار أمامي (خلف الكاميرا) */}
      <mesh position={[0, 2.5, 5]}>
        <boxGeometry args={[14, 5, 0.12]} />
        <meshStandardMaterial color="#f0ece6" roughness={0.88} />
      </mesh>
      {/* سقف */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[14, 0.12, 10]} />
        <meshStandardMaterial color="#fafaf8" roughness={0.95} />
      </mesh>
      {/* شريط ديكور سقف (coving) */}
      <mesh position={[0, 4.96, -4.95]}>
        <boxGeometry args={[14, 0.06, 0.06]} />
        <meshStandardMaterial color="#e0dcd6" roughness={0.7} />
      </mesh>
      {/* خط قاعدة جدار داكن (baseboard) */}
      <mesh position={[0, 0.06, -4.94]}>
        <boxGeometry args={[14, 0.12, 0.04]} />
        <meshStandardMaterial color="#0d0f14" roughness={0.5} metalness={0.1} />
      </mesh>
    </>
  );
}

// ─── نافذة عصرية بإطار أسود ───────────────────────────────────────────────────
function Window() {
  return (
    <group position={[-3.5, 2.2, -4.94]}>
      {/* إطار خارجي أسود */}
      <mesh>
        <boxGeometry args={[3.2, 3.6, 0.07]} />
        <meshStandardMaterial color="#0d0f14" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* زجاج */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[2.9, 3.3, 0.02]} />
        <meshStandardMaterial color="#a8d4f5" transparent opacity={0.22} roughness={0} metalness={0.1} />
      </mesh>
      {/* شريط أفقي وسط الإطار */}
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[3.0, 0.05, 0.015]} />
        <meshStandardMaterial color="#0d0f14" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* ضوء طبيعي */}
      <rectAreaLight position={[0, 0, 0.5]} width={2.9} height={3.3} intensity={14} color="#e8f4ff" />
    </group>
  );
}

// ─── لوحة فنية عصرية على الجدار ──────────────────────────────────────────────
function WallPainting() {
  return (
    <group position={[3.5, 2.8, -4.89]}>
      {/* إطار رفيع مطفي */}
      <mesh>
        <boxGeometry args={[2.2, 1.4, 0.035]} />
        <meshStandardMaterial color="#1c1c24" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* لوحة تجريدية — خلفية غامقة مع لمسات لون */}
      <mesh position={[0, 0, 0.022]}>
        <boxGeometry args={[2.0, 1.2, 0.01]} />
        <meshStandardMaterial color="#0a0e18" roughness={0.8} emissive="#0a1428" emissiveIntensity={0.4} />
      </mesh>
      {/* شريط لوني أحمر */}
      <mesh position={[-0.5, 0.1, 0.03]}>
        <boxGeometry args={[0.08, 0.7, 0.008]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} emissive="#c0392b" emissiveIntensity={0.3} />
      </mesh>
      {/* شريط لوني ذهبي */}
      <mesh position={[0.2, -0.2, 0.03]}>
        <boxGeometry args={[0.6, 0.04, 0.008]} />
        <meshStandardMaterial color="#c9a227" roughness={0.3} emissive="#c9a227" emissiveIntensity={0.3} />
      </mesh>
      {/* دائرة لكسينت */}
      <mesh position={[0.5, 0.25, 0.03]}>
        <planeGeometry args={[0.22, 0.22]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.6} emissive="#1e3a5f" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

// ─── برواز الصورة على الجدار ─────────────────────────────────────────────────
function WallFrame({ imageUrl }: { imageUrl: string }) {
  const texture = useLoader(THREE.TextureLoader, imageUrl);
  const frameW = 11.0;
  const frameH = 3.8;

  // تأكيد colorSpace الصحيح للـ texture
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <group position={[1.5, 2.6, -4.93]}>
      {/* إطار خشبي */}
      <mesh position={[0, 0, -0.015]}>
        <boxGeometry args={[frameW + 0.18, frameH + 0.18, 0.05]} />
        <meshStandardMaterial color="#5a3e28" roughness={0.65} metalness={0.05} />
      </mesh>
      {/* الصورة — meshBasicMaterial لعرضها بكامل إضاءتها بدون اعتماد على الضوء */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[frameW, frameH]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  );
}

// ─── مكتب عصري ───────────────────────────────────────────────────────────────
function Desk() {
  return (
    <group position={[0, 0, -1.2]}>
      {/* سطح المكتب — خشب أوك فاتح */}
      <mesh position={[0, 0.80, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.05, 1.1]} />
        <meshStandardMaterial color="#ddd0b6" roughness={0.3} metalness={0.02} />
      </mesh>
      {/* حافة سفلية صلب مطفي */}
      <mesh position={[0, 0.775, 0]}>
        <boxGeometry args={[2.82, 0.015, 1.12]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.15} metalness={0.95} />
      </mesh>
      {/* أرجل — لوحتان جانبيتان من الصلب الأسود */}
      {([-1.18, 1.18] as number[]).map(x => (
        <mesh key={x} position={[x, 0.40, 0]} castShadow>
          <boxGeometry args={[0.04, 0.80, 0.9]} />
          <meshStandardMaterial color="#0d0d10" roughness={0.12} metalness={0.95} />
        </mesh>
      ))}
      {/* قاعدة أرضية */}
      {([-1.18, 1.18] as number[]).map(x => (
        <mesh key={x + "b"} position={[x, 0.015, 0]}>
          <boxGeometry args={[0.26, 0.03, 0.9]} />
          <meshStandardMaterial color="#0d0d10" roughness={0.12} metalness={0.95} />
        </mesh>
      ))}

      {/* شاشة — ultra-thin bezel */}
      <group position={[0.3, 1.22, -0.38]}>
        {/* هيكل الشاشة */}
        <mesh castShadow>
          <boxGeometry args={[0.92, 0.54, 0.02]} />
          <meshStandardMaterial color="#080810" roughness={0.1} metalness={0.85} />
        </mesh>
        {/* شاشة glowing */}
        <mesh position={[0, 0, 0.013]}>
          <boxGeometry args={[0.88, 0.50, 0.005]} />
          <meshStandardMaterial color="#050d1e" emissive="#0d2244" emissiveIntensity={1.2} roughness={0.02} />
        </mesh>
        {/* ضوء خفيف من الشاشة */}
        <pointLight position={[0, 0, 0.3]} intensity={0.5} color="#2060b0" distance={1.5} decay={2} />
        {/* عنق الشاشة */}
        <mesh position={[0, -0.36, 0.06]}>
          <boxGeometry args={[0.04, 0.18, 0.04]} />
          <meshStandardMaterial color="#0d0d10" roughness={0.15} metalness={0.9} />
        </mesh>
        {/* قاعدة الشاشة */}
        <mesh position={[0, -0.46, 0.10]}>
          <boxGeometry args={[0.28, 0.02, 0.18]} />
          <meshStandardMaterial color="#0d0d10" roughness={0.15} metalness={0.9} />
        </mesh>
      </group>

      {/* لاب توب صغير على اليسار */}
      <group position={[-0.8, 0.83, 0.1]} rotation={[0, 0.15, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.018, 0.26]} />
          <meshStandardMaterial color="#1c1c24" roughness={0.15} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.12, -0.11]} rotation={[-1.2, 0, 0]}>
          <boxGeometry args={[0.34, 0.18, 0.016]} />
          <meshStandardMaterial color="#1c1c24" roughness={0.15} metalness={0.8} />
        </mesh>
      </group>

      {/* كوب قهوة أبيض حديث */}
      <group position={[0.95, 0.84, 0.22]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.048, 0.042, 0.10, 14]} />
          <meshStandardMaterial color="#fafafa" roughness={0.2} metalness={0.0} />
        </mesh>
        {/* محتوى القهوة */}
        <mesh position={[0, 0.042, 0]}>
          <cylinderGeometry args={[0.038, 0.038, 0.008, 14]} />
          <meshStandardMaterial color="#2c1a0e" roughness={0.1} />
        </mesh>
      </group>

      {/* قلم + مسطرة على سطح المكتب */}
      <mesh position={[-0.3, 0.828, 0.3]} rotation={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.18, 8]} />
        <meshStandardMaterial color="#1c1c24" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ─── كرسي عصري ───────────────────────────────────────────────────────────────
function Chair() {
  const fabric = "#c8bfb0"; // بيج دافئ
  const metal  = "#0d0d10";
  return (
    <group position={[0, 0, -1.95]}>
      {/* مقعد */}
      <mesh position={[0, 0.50, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.07, 0.54]} />
        <meshStandardMaterial color={fabric} roughness={0.7} />
      </mesh>
      {/* حشوة المقعد */}
      <mesh position={[0, 0.545, 0]}>
        <boxGeometry args={[0.50, 0.04, 0.48]} />
        <meshStandardMaterial color="#d4c8b8" roughness={0.85} />
      </mesh>
      {/* ظهر الكرسي */}
      <mesh position={[0, 1.05, -0.26]} castShadow>
        <boxGeometry args={[0.52, 0.62, 0.07]} />
        <meshStandardMaterial color={fabric} roughness={0.7} />
      </mesh>
      {/* حشوة الظهر */}
      <mesh position={[0, 1.05, -0.225]}>
        <boxGeometry args={[0.46, 0.56, 0.03]} />
        <meshStandardMaterial color="#d4c8b8" roughness={0.85} />
      </mesh>
      {/* مساند الذراع */}
      {([-0.30, 0.30] as number[]).map(x => (
        <group key={x}>
          <mesh position={[x, 0.72, -0.02]} castShadow>
            <boxGeometry args={[0.04, 0.44, 0.04]} />
            <meshStandardMaterial color={metal} roughness={0.12} metalness={0.95} />
          </mesh>
          <mesh position={[x, 0.93, 0.06]}>
            <boxGeometry args={[0.04, 0.04, 0.28]} />
            <meshStandardMaterial color="#8a8278" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* عمود وسطي */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.028, 0.038, 0.48, 12]} />
        <meshStandardMaterial color={metal} roughness={0.1} metalness={0.95} />
      </mesh>
      {/* قرص الكيلوفة */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.025, 16]} />
        <meshStandardMaterial color={metal} roughness={0.1} metalness={0.95} />
      </mesh>
      {/* أرجل خمسة */}
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i}
            position={[Math.sin(a) * 0.23, 0.022, Math.cos(a) * 0.23]}
            rotation={[0, -a, 0.18]}
            castShadow>
            <boxGeometry args={[0.36, 0.022, 0.032]} />
            <meshStandardMaterial color={metal} roughness={0.1} metalness={0.95} />
          </mesh>
        );
      })}
      {/* عجلات */}
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={"w" + i}
            position={[Math.sin(a) * 0.40, 0.03, Math.cos(a) * 0.40]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#1a1a22" roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── رف عائم عصري ────────────────────────────────────────────────────────────
function Bookshelf() {
  const shelfColor = "#f4f1ec";
  const books = [
    { z: -0.32, w: 0.06, h: 0.30, c: "#1c1c24" },
    { z: -0.24, w: 0.05, h: 0.26, c: "#2e4057" },
    { z: -0.17, w: 0.07, h: 0.32, c: "#3d2b1f" },
    { z: -0.08, w: 0.05, h: 0.28, c: "#c9a227" },
    { z:  0.01, w: 0.06, h: 0.24, c: "#1c1c24" },
    { z:  0.09, w: 0.08, h: 0.30, c: "#2e4057" },
    { z:  0.19, w: 0.05, h: 0.26, c: "#8b4513" },
    { z:  0.27, w: 0.07, h: 0.32, c: "#1c1c24" },
  ];
  return (
    <group position={[6.83, 0, -2.5]}>
      {/* لوح خلفي رفيع يلصق بالجدار */}
      <mesh position={[0.07, 2.1, 0]}>
        <boxGeometry args={[0.04, 2.5, 1.14]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.6} />
      </mesh>
      {/* رفوف عائمة بيضاء */}
      {[1.0, 1.72, 2.44, 3.1].map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 0]} castShadow>
            <boxGeometry args={[0.22, 0.03, 1.1]} />
            <meshStandardMaterial color={shelfColor} roughness={0.5} />
          </mesh>
          {/* حامل عمودي رفيع */}
          <mesh position={[0.06, y - 0.04, 0]}>
            <boxGeometry args={[0.02, 0.08, 0.06]} />
            <meshStandardMaterial color="#0d0d10" roughness={0.15} metalness={0.9} />
          </mesh>
        </group>
      ))}
      {/* كتب بألوان مدروسة */}
      {[0, 1, 2].map(row =>
        books.slice(0, 6).map((b, i) => (
          <mesh key={`${row}${i}`}
            position={[0.04, 1.0 + row * 0.72 + b.h / 2, b.z - 0.15]}
            castShadow>
            <boxGeometry args={[0.18, b.h, b.w]} />
            <meshStandardMaterial color={b.c} roughness={0.75} />
          </mesh>
        ))
      )}
      {/* كائن ديكوري — كرة سيراميك */}
      <mesh position={[0.04, 3.22, 0.38]} castShadow>
        <sphereGeometry args={[0.072, 14, 14]} />
        <meshStandardMaterial color="#e8e2d8" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* إطار صغير */}
      <mesh position={[0.04, 1.74, 0.38]} castShadow>
        <boxGeometry args={[0.03, 0.22, 0.17]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.2} metalness={0.7} />
      </mesh>
    </group>
  );
}

// ─── نبتة عصرية ───────────────────────────────────────────────────────────────
function Plant() {
  return (
    <group position={[-5.8, 0, 3.2]}>
      {/* وعاء سيراميك أبيض مطفي */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.55, 16]} />
        <meshStandardMaterial color="#f0ece6" roughness={0.25} metalness={0.02} />
      </mesh>
      {/* حافة الوعاء — حلقة رفيعة */}
      <mesh position={[0, 0.562, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.016, 18, 1, false]} />
        <meshStandardMaterial color="#e0dbd3" roughness={0.3} />
      </mesh>
      {/* تربة */}
      <mesh position={[0, 0.54, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.02, 14]} />
        <meshStandardMaterial color="#2c1a0e" roughness={0.95} />
      </mesh>
      {/* جذع رئيسي */}
      <mesh position={[0, 0.90, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.036, 0.72, 8]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.85} />
      </mesh>
      {/* أوراق كبيرة (فيكوس ليراتا) */}
      {[
        [0, 1.42, 0, 0, 0.3], [0.18, 1.32, 0.1, 0.3, 0.2],
        [-0.2, 1.28, -0.08, -0.3, 0.15], [0.1, 1.52, -0.15, -0.1, 0.25],
        [-0.15, 1.48, 0.12, 0.2, 0.18],
      ].map(([x, y, z, ry, _s], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}
          rotation={[-0.2, ry as number, 0.1 * (i % 2 === 0 ? 1 : -1)]}
          castShadow>
          <boxGeometry args={[0.22, 0.32, 0.015]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#2d5a3d" : "#3a6e4a"} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ─── مصباح معلق فوق المكتب ────────────────────────────────────────────────────
function PendantLight() {
  return (
    <group position={[0, 5.0, -1.2]}>
      {/* سلك */}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.55, 6]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* غطاء المصباح — مخروط مبسط */}
      <mesh position={[0, -0.62, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.19, 0.28, 14]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.15} metalness={0.9} />
      </mesh>
      {/* قرص سفلي */}
      <mesh position={[0, -0.77, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.01, 14]} />
        <meshStandardMaterial color="#181820" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* ضوء */}
      <pointLight position={[0, -0.68, 0]} intensity={6} color="#ffe8c0" distance={4} decay={2} castShadow />
    </group>
  );
}

// ─── سجادة منطقة جلوس ────────────────────────────────────────────────────────
function Rug() {
  return (
    <mesh position={[0, 0.005, 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[3.0, 2.2]} />
      <meshStandardMaterial color="#2e3440" roughness={0.95} />
    </mesh>
  );
}

// ─── الروبوت المفصّل ──────────────────────────────────────────────────────────
// الإحداثيات مأخوذة من index2.html (RX=0, RZ=-0.9) ومحوّلة للمجموعة المحلية:
//   local_x = x_index2,  local_y = y_index2,  local_z = z_index2 + 0.9
function Robot({ onClick, talking }: { onClick: () => void; talking: boolean }) {
  const bodyRef      = useRef<THREE.Group>(null);
  const headRef      = useRef<THREE.Group>(null);
  const eyeGlowRef   = useRef<THREE.PointLight>(null);
  const chestGlowRef = useRef<THREE.PointLight>(null);
  const [hov, setHov] = useState(false);

  // مادة مضيئة مشتركة لكل العناصر الزرقاء المتوهجة (عينان + شريط صدر + رأس هوائي)
  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color("#33eeff"),
    roughness: 0.05,
    emissive: new THREE.Color("#0077bb"),
    emissiveIntensity: 5,
  }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const breath = 0.5 + 0.5 * Math.sin(t * (talking ? 2.5 : 0.85));
    eyeMat.emissiveIntensity        = 3.5 + breath * 2.5;
    if (eyeGlowRef.current)   eyeGlowRef.current.intensity   = 2.0 + breath * 1.8;
    if (chestGlowRef.current) chestGlowRef.current.intensity = 1.2 + breath * 0.8;
    // تنفس خفيف للجسم
    if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 0.85) * 0.006;
    // تأرجح الرأس
    if (headRef.current) headRef.current.rotation.y = Math.sin(t * 0.5) * 0.05;
  });

  return (
    <group
      position={[0, -0.05, -1.95]}
      rotation={[0, Math.PI, 0]}
      onClick={onClick}
      onPointerOver={() => { setHov(true);  document.body.style.cursor = "pointer"; }}
      onPointerOut={()  => { setHov(false); document.body.style.cursor = "default"; }}
      scale={hov ? 1.02 : 1.0}
    >
      <group ref={bodyRef}>

        {/* ── حوض + عمود فقري ── */}
        <mesh position={[0, 0.665, 0]} castShadow>
          <boxGeometry args={[0.34, 0.16, 0.28]} />
          <meshStandardMaterial color="#26263a" roughness={0.22} metalness={0.78} />
        </mesh>
        <mesh position={[0, 0.755, 0]}>
          <boxGeometry args={[0.12, 0.08, 0.10]} />
          <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
        </mesh>

        {/* ── جذع ── */}
        <mesh position={[0, 0.995, 0]} castShadow>
          <boxGeometry args={[0.38, 0.50, 0.26]} />
          <meshStandardMaterial color="#26263a" roughness={0.22} metalness={0.78} />
        </mesh>
        {/* صفيحة صدرية زرقاء */}
        <mesh position={[0, 1.00, -0.132]}>
          <boxGeometry args={[0.24, 0.36, 0.022]} />
          <meshStandardMaterial color="#2244dd" roughness={0.18} metalness={0.92}
            emissive="#0a1a55" emissiveIntensity={1} />
        </mesh>
        {/* شريط صدري متوهج — يشارك eyeMat */}
        <mesh position={[0, 1.00, -0.134]}>
          <boxGeometry args={[0.052, 0.30, 0.022]} />
          <primitive object={eyeMat} attach="material" />
        </mesh>
        {/* فتحات جانبية */}
        <mesh position={[-0.20, 0.98, 0]}>
          <boxGeometry args={[0.022, 0.22, 0.14]} />
          <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
        </mesh>
        <mesh position={[0.20, 0.98, 0]}>
          <boxGeometry args={[0.022, 0.22, 0.14]} />
          <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
        </mesh>

        {/* ── رقبة ── */}
        <mesh position={[0, 1.285, 0]}>
          <cylinderGeometry args={[0.07, 0.088, 0.14, 12]} />
          <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
        </mesh>
        <mesh position={[0, 1.235, 0]}>
          <boxGeometry args={[0.17, 0.025, 0.17]} />
          <meshStandardMaterial color="#2244dd" roughness={0.18} metalness={0.92}
            emissive="#0a1a55" emissiveIntensity={1} />
        </mesh>
        <mesh position={[0, 1.335, 0]}>
          <boxGeometry args={[0.17, 0.025, 0.17]} />
          <meshStandardMaterial color="#2244dd" roughness={0.18} metalness={0.92}
            emissive="#0a1a55" emissiveIntensity={1} />
        </mesh>

        {/* ── ضوء الصدر ── */}
        <pointLight ref={chestGlowRef}
          position={[0, 1.0, -0.20]} color="#2244dd"
          intensity={1.2} distance={0.7} decay={2} />

        {/* ── وسادات كتف ── */}
        <mesh position={[-0.28, 1.15, 0]} castShadow>
          <boxGeometry args={[0.15, 0.19, 0.24]} />
          <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
        </mesh>
        <mesh position={[0.28, 1.15, 0]} castShadow>
          <boxGeometry args={[0.15, 0.19, 0.24]} />
          <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
        </mesh>

        {/* ── ذراعان ممدودتان نحو المكتب ── */}
        {([-0.28, 0.28] as number[]).map(sx => (
          <group key={sx}>
            {/* عضد علوي rx=-0.87 */}
            <mesh position={[sx, 1.015, -0.20]} rotation={[-0.87, 0, 0]} castShadow>
              <boxGeometry args={[0.12, 0.50, 0.12]} />
              <meshStandardMaterial color="#26263a" roughness={0.22} metalness={0.78} />
            </mesh>
            {/* كوع */}
            <mesh position={[sx, 0.835, -0.41]}>
              <sphereGeometry args={[0.072, 12, 8]} />
              <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
            </mesh>
            {/* ساعد rx=-1.48 (شبه أفقي) */}
            <mesh position={[sx, 0.826, -0.61]} rotation={[-1.48, 0, 0]} castShadow>
              <boxGeometry args={[0.10, 0.38, 0.10]} />
              <meshStandardMaterial color="#26263a" roughness={0.22} metalness={0.78} />
            </mesh>
            {/* يد */}
            <mesh position={[sx, 0.862, -0.82]}>
              <boxGeometry args={[0.12, 0.06, 0.15]} />
              <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
            </mesh>
            {/* أصابع */}
            {([-1, 0, 1] as number[]).map(f => (
              <mesh key={f} position={[sx + f * 0.036, 0.862, -0.897]}>
                <boxGeometry args={[0.022, 0.04, 0.04]} />
                <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
              </mesh>
            ))}
          </group>
        ))}

        {/* ── أرجل (جالس: فخذ أفقي، ساق رأسية) ── */}
        {([-0.14, 0.14] as number[]).map(lx => (
          <group key={lx}>
            {/* فخذ */}
            <mesh position={[lx, 0.595, -0.25]} castShadow>
              <boxGeometry args={[0.13, 0.12, 0.44]} />
              <meshStandardMaterial color="#26263a" roughness={0.22} metalness={0.78} />
            </mesh>
            {/* ركبة */}
            <mesh position={[lx, 0.590, -0.48]}>
              <sphereGeometry args={[0.072, 12, 8]} />
              <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
            </mesh>
            {/* ساق */}
            <mesh position={[lx, 0.315, -0.48]} castShadow>
              <boxGeometry args={[0.12, 0.50, 0.12]} />
              <meshStandardMaterial color="#26263a" roughness={0.22} metalness={0.78} />
            </mesh>
            {/* كاحل */}
            <mesh position={[lx, 0.076, -0.48]}>
              <sphereGeometry args={[0.058, 12, 8]} />
              <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
            </mesh>
            {/* قدم */}
            <mesh position={[lx, 0.052, -0.50]}>
              <boxGeometry args={[0.14, 0.07, 0.24]} />
              <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
            </mesh>
          </group>
        ))}

        {/* ── ضوء العينين ── */}
        <pointLight ref={eyeGlowRef}
          position={[0, 1.482, -0.25]} color="#22ccff"
          intensity={2.0} distance={0.9} decay={2} />

        {/* ── رأس (مجموعة قابلة للتأرجح) ── */}
        <group ref={headRef} position={[0, 1.478, 0]}>
          {/* صندوق الرأس */}
          <mesh castShadow>
            <boxGeometry args={[0.30, 0.27, 0.28]} />
            <meshStandardMaterial color="#26263a" roughness={0.22} metalness={0.78} />
          </mesh>
          {/* لوحة علوية */}
          <mesh position={[0, 0.147, 0]}>
            <boxGeometry args={[0.28, 0.04, 0.26]} />
            <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
          </mesh>
          {/* هوائي أيسر */}
          <mesh position={[-0.09, 0.217, 0]}>
            <boxGeometry args={[0.018, 0.10, 0.018]} />
            <meshStandardMaterial color="#8a9098" roughness={0.22} metalness={0.88} />
          </mesh>
          <mesh position={[-0.09, 0.274, 0]}>
            <sphereGeometry args={[0.026, 10, 8]} />
            <meshStandardMaterial color="#2244dd" roughness={0.18} metalness={0.92}
              emissive="#0a1a55" emissiveIntensity={1} />
          </mesh>
          {/* هوائي أيمن — متوهج بلون العين */}
          <mesh position={[0.09, 0.206, 0]}>
            <boxGeometry args={[0.018, 0.075, 0.018]} />
            <meshStandardMaterial color="#8a9098" roughness={0.22} metalness={0.88} />
          </mesh>
          <mesh position={[0.09, 0.252, 0]}>
            <sphereGeometry args={[0.020, 10, 8]} />
            <primitive object={eyeMat} attach="material" />
          </mesh>
          {/* عين يسار */}
          <mesh position={[-0.09, 0.004, -0.142]}>
            <sphereGeometry args={[0.044, 14, 10]} />
            <primitive object={eyeMat} attach="material" />
          </mesh>
          {/* عين يمين */}
          <mesh position={[0.09, 0.004, -0.142]}>
            <sphereGeometry args={[0.044, 14, 10]} />
            <primitive object={eyeMat} attach="material" />
          </mesh>
          {/* حلقة مقبس عين يسار */}
          <mesh position={[-0.09, 0.004, -0.136]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.062, 0.062, 0.02, 12]} />
            <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
          </mesh>
          {/* حلقة مقبس عين يمين */}
          <mesh position={[0.09, 0.004, -0.136]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.062, 0.062, 0.02, 12]} />
            <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
          </mesh>
          {/* شبكة فم */}
          <mesh position={[0, -0.093, -0.141]}>
            <boxGeometry args={[0.180, 0.026, 0.020]} />
            <meshStandardMaterial color="#2244dd" roughness={0.18} metalness={0.92}
              emissive="#0a1a55" emissiveIntensity={1} />
          </mesh>
          <mesh position={[-0.06, -0.093, -0.141]}>
            <boxGeometry args={[0.040, 0.026, 0.020]} />
            <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
          </mesh>
          <mesh position={[0.06, -0.093, -0.141]}>
            <boxGeometry args={[0.040, 0.026, 0.020]} />
            <meshStandardMaterial color="#12121c" roughness={0.28} metalness={0.82} />
          </mesh>
          {/* لوحات أذن */}
          <mesh position={[-0.168, 0, 0]}>
            <boxGeometry args={[0.032, 0.16, 0.14]} />
            <meshStandardMaterial color="#363644" roughness={0.3} metalness={0.82} />
          </mesh>
          <mesh position={[0.168, 0, 0]}>
            <boxGeometry args={[0.032, 0.16, 0.14]} />
            <meshStandardMaterial color="#363644" roughness={0.3} metalness={0.82} />
          </mesh>
        </group>

      </group>
    </group>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  loading,
  onSend,
  onClose,
  systemPrompt,
  geminiKey,
}: {
  messages: Message[];
  loading: boolean;
  onSend: (t: string) => void;
  onClose: () => void;
  systemPrompt?: string;
  geminiKey?: string;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const t = input.trim();
    if (!t || loading) return;
    setInput("");
    onSend(t);
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0,
      width: 390, height: "100vh",
      background: "#ffffff",
      boxShadow: "-6px 0 30px rgba(0,0,0,0.14)",
      display: "flex", flexDirection: "column",
      zIndex: 100, direction: "rtl",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid #ede9e4",
        background: "#faf8f5",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "linear-gradient(135deg,#7ca8cc,#00d4aa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>المساعد الذكي</div>
            <div style={{ fontSize: 11, color: "#00d4aa" }}>● جاهز</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 22, color: "#999", lineHeight: 1,
        }}>×</button>
      </div>

      {/* messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "14px 12px",
        display: "flex", flexDirection: "column", gap: 10,
        background: "#fcfbf9",
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, marginTop: 50 }}>
            مرحباً! اكتب رسالتك أو اضغط على الروبوت للبدء
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <div style={{
              background: m.role === "user" ? "#1a73e8" : "#f0ede8",
              color: m.role === "user" ? "#fff" : "#1a1a1a",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              fontSize: 13.5, lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{
              background: "#f0ede8", padding: "10px 16px",
              borderRadius: "18px 18px 18px 4px",
              fontSize: 13, color: "#888",
              display: "flex", gap: 4,
            }}>
              {[0, 0.3, 0.6].map((d, i) => (
                <span key={i} style={{
                  animation: `bounce 1s ${d}s ease-in-out infinite`,
                  display: "inline-block",
                }}>●</span>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* voice */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #ede9e4", background: "#faf8f5" }}>
        <VoiceChat
          systemPrompt={systemPrompt}
          messages={messages.map(m => ({ role: m.role, content: m.content }))}
          geminiKey={geminiKey}
        />
      </div>

      {/* input */}
      <div style={{
        padding: "12px 12px",
        borderTop: "1px solid #ede9e4",
        background: "#faf8f5",
        display: "flex", gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="اكتب رسالتك..."
          disabled={loading}
          style={{
            flex: 1, border: "1px solid #ddd8d0", borderRadius: 22,
            padding: "9px 16px", fontSize: 13.5, outline: "none",
            background: "#fff", direction: "rtl",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            background: (loading || !input.trim()) ? "#ccc" : "#1a73e8",
            color: "#fff", border: "none", borderRadius: "50%",
            width: 42, height: 42,
            cursor: (loading || !input.trim()) ? "default" : "pointer",
            fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >→</button>
      </div>

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}

// ─── تحكم كاميرا منظور أول (FPS) ─────────────────────────────────────────────
function FPSController({
  keysRef,
  active,
}: {
  keysRef: React.MutableRefObject<Set<string>>;
  active: boolean;
}) {
  const { camera } = useThree();
  const yaw   = useRef(Math.PI);   // نظر للأمام نحو الروبوت
  const pitch = useRef(-0.08);
  const pos   = useRef(new THREE.Vector3(0, 1.65, 5.2)); // ارتفاع عين الإنسان

  // استمع لحركة الفأرة عبر pointer lock
  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      yaw.current   -= e.movementX * 0.002;
      pitch.current  = Math.max(-0.9, Math.min(0.9, pitch.current - e.movementY * 0.002));
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    const spd  = 4 * delta;
    const keys = keysRef.current;

    const dir = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    if (keys.has("ArrowUp")    || keys.has("w")) pos.current.addScaledVector(dir,  -spd);
    if (keys.has("ArrowDown")  || keys.has("s")) pos.current.addScaledVector(dir,   spd);
    if (keys.has("ArrowLeft")  || keys.has("a")) pos.current.addScaledVector(right, -spd);
    if (keys.has("ArrowRight") || keys.has("d")) pos.current.addScaledVector(right,  spd);

    // قيّد الحركة داخل الغرفة
    pos.current.x = Math.max(-6.5, Math.min(6.5, pos.current.x));
    pos.current.z = Math.max(-4.5, Math.min(4.8, pos.current.z));
    pos.current.y = 1.65;

    camera.position.copy(pos.current);

    const lookAt = new THREE.Vector3(
      pos.current.x + Math.sin(yaw.current) * Math.cos(pitch.current),
      pos.current.y + Math.sin(pitch.current),
      pos.current.z + Math.cos(yaw.current) * Math.cos(pitch.current),
    );
    camera.lookAt(lookAt);
  });
  return null;
}

// ─── OfficePage ───────────────────────────────────────────────────────────────
export default function OfficePage() {
  const [chatOpen,     setChatOpen]     = useState(false);
  const [voiceOpen,    setVoiceOpen]    = useState(false);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [noKey,        setNoKey]        = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [geminiKey,    setGeminiKey]    = useState("");
  const [wallImageUrl, setWallImageUrl] = useState("");
  const [fpsMode,      setFpsMode]      = useState(false);
  const [roomOpen,     setRoomOpen]     = useState(false);
  const fpsKeysRef = useRef<Set<string>>(new Set());

  // مفاتيح FPS
  useEffect(() => {
    if (!fpsMode) return;
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","w","a","s","d"].includes(e.key)) e.preventDefault();
      fpsKeysRef.current.add(e.key);
      if (e.key === "Escape") {
        setFpsMode(false);
        document.exitPointerLock?.();
      }
    };
    const onUp = (e: KeyboardEvent) => fpsKeysRef.current.delete(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
      fpsKeysRef.current.clear();
    };
  }, [fpsMode]);

  const toggleFps = () => {
    if (!fpsMode) {
      document.body.requestPointerLock?.();
      setFpsMode(true);
    } else {
      document.exitPointerLock?.();
      setFpsMode(false);
    }
  };

  // تحقق من الإعدادات عند التحميل
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => {
        setNoKey(!s.apiKey);
        if (s.systemPrompt) setSystemPrompt(s.systemPrompt);
        if (s.geminiKey)    setGeminiKey(s.geminiKey);
      })
      .catch(() => setNoKey(true));

    // تحقق من صورة الجدار
    fetch("/api/wall-image")
      .then(r => r.json())
      .then(d => { if (d.exists && d.url) setWallImageUrl(d.url + "?t=" + Date.now()); });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(p => [...p, { role: "assistant", content: err.error || "خطأ" }]);
        setLoading(false);
        if (err.error?.includes("API key")) setNoKey(true);
        return;
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      setMessages(p => [...p, { role: "assistant", content: "" }]);
      setLoading(false);

      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (!value) continue;
        const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") { done = true; break; }
          try {
            const { content } = JSON.parse(data);
            if (content) {
              setMessages(p => {
                const a = [...p];
                const last = a[a.length - 1];
                if (last?.role === "assistant") a[a.length - 1] = { ...last, content: last.content + content };
                return a;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      setLoading(false);
      setMessages(p => [...p, { role: "assistant", content: `خطأ: ${e.message}` }]);
    }
  }, [messages]);

  const handleRobotClick = () => {
    if (noKey) { window.location.href = "/settings"; return; }
    setChatOpen(true);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>

      {/* Canvas الرئيسي */}
      <Canvas
        flat shadows
        camera={{ position: [0, 1.65, 5.2], fov: 75 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        style={{ width: chatOpen ? "calc(100% - 390px)" : "100%", height: "100%" }}
        eventSource={document.body}
        eventPrefix="client"
        onClick={() => { if (fpsMode) document.body.requestPointerLock?.(); }}
      >
        {/* لون خلفية داكن دافئ */}
        <color attach="background" args={["#111318"]} />
        {/* ضوء محيط خافت دافئ */}
        <ambientLight intensity={0.55} color="#f0e8d8" />
        {/* ضوء اتجاهي من فوق اليمين */}
        <directionalLight position={[5, 8, 4]} intensity={0.8} castShadow
          shadow-mapSize-width={1024} shadow-mapSize-height={1024}
          shadow-camera-near={0.5} shadow-camera-far={30}
          shadow-camera-left={-10} shadow-camera-right={10}
          shadow-camera-top={10} shadow-camera-bottom={-10}
          color="#f8f0e0"
        />
        {/* ضوء fill خفيف من اليسار */}
        <directionalLight position={[-4, 3, 2]} intensity={0.25} color="#c8d8f0" />
        {/* ضوء نقطي من الجانب الأيسر (النافذة) */}
        <pointLight position={[-5, 3.5, -1]} intensity={12} color="#d0e8ff" distance={10} decay={2} />

        <FPSController keysRef={fpsKeysRef} active={fpsMode} />

        <SceneErrorBoundary>
          <Suspense fallback={null}>
            <Room />
            <Window />
            {wallImageUrl
              ? <WallFrame imageUrl={wallImageUrl} />
              : <WallPainting />
            }
            <Rug />
            <PendantLight />
            <Desk />
            <Chair />
            <Bookshelf />
            <Plant />
            <Robot onClick={handleRobotClick} talking={loading} />
          </Suspense>
        </SceneErrorBoundary>
      </Canvas>

      {/* شريط علوي */}
      <div style={{
        position: "fixed", top: 0, left: 0,
        right: chatOpen ? 390 : 0,
        height: 52,
        background: "rgba(13,15,20,0.82)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
        zIndex: 50, direction: "rtl",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg,#1e3a5f,#0d9488)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>🏢</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#f0ece6", letterSpacing: 0.3 }}>المكتب الذكي</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* زر منظور أول */}
          <button
            onClick={toggleFps}
            style={fpsMode ? btnTeal : btnGray}
            title="منظور أول — اضغط Escape للخروج"
          >
            📷 {fpsMode ? "خروج FPS" : "تجوّل"}
          </button>

          {/* زر غرفة الاجتماع */}
          <button
            onClick={() => setRoomOpen(v => !v)}
            style={roomOpen ? btnTeal : btnGray}
          >
            🤝 {roomOpen ? "إغلاق الاجتماع" : "اجتماع"}
          </button>

          {/* زر المحادثة الصوتية — يظهر دائماً إذا في geminiKey */}
          {geminiKey && (
            <button
              onClick={() => setVoiceOpen(v => !v)}
              style={voiceOpen ? btnPurple : btnGray}
            >
              🎤 {voiceOpen ? "إغلاق الصوت" : "محادثة صوتية"}
            </button>
          )}
          {!chatOpen && !noKey && (
            <button onClick={() => setChatOpen(true)} style={btnBlue}>
              💬 فتح المحادثة
            </button>
          )}
          {chatOpen && (
            <button onClick={() => setChatOpen(false)} style={btnGray}>✕ إغلاق</button>
          )}
          <a href="/settings" style={btnGray}>⚙️ الإعدادات</a>
        </div>
      </div>

      {/* تنبيه غياب API Key */}
      {noKey && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.76)",
          color: "#fff", padding: "12px 24px",
          borderRadius: 30, fontSize: 13,
          fontFamily: "system-ui",
          cursor: "pointer", zIndex: 50, direction: "rtl",
          whiteSpace: "nowrap",
        }} onClick={() => window.location.href = "/settings"}>
          ⚙️ أضف API Key من الإعدادات للبدء
        </div>
      )}

      {/* تلميح الروبوت */}
      {!noKey && !chatOpen && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.5)",
          color: "#fff", padding: "9px 20px",
          borderRadius: 30, fontSize: 12,
          fontFamily: "system-ui",
          pointerEvents: "none", zIndex: 50,
        }}>
          انقر على الروبوت أو 💬 للتحدث
        </div>
      )}

      {/* لوحة غرفة الاجتماع */}
      {roomOpen && (
        <VoiceRoomPanel onClose={() => setRoomOpen(false)} />
      )}

      {/* لوحة المحادثة */}
      {chatOpen && (
        <ChatPanel
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          onClose={() => setChatOpen(false)}
          systemPrompt={systemPrompt}
          geminiKey={geminiKey}
        />
      )}

      {/* كادر مركزي — يظهر فقط في وضع FPS */}
      {fpsMode && (
        <div style={{
          position: "fixed",
          top: "50%", left: chatOpen ? "calc(50% - 195px)" : "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 80,
        }}>
          {/* خط أفقي */}
          <div style={{
            position: "absolute",
            width: 20, height: 2,
            background: "rgba(255,255,255,0.9)",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: 1,
          }} />
          {/* خط رأسي */}
          <div style={{
            position: "absolute",
            width: 2, height: 20,
            background: "rgba(255,255,255,0.9)",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: 1,
          }} />
          {/* نقطة مركزية */}
          <div style={{
            position: "absolute",
            width: 4, height: 4,
            background: "rgba(255,255,255,0.95)",
            borderRadius: "50%",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
          }} />
        </div>
      )}

      {/* تلميح FPS */}
      {fpsMode && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.6)",
          color: "#fff", padding: "9px 20px",
          borderRadius: 30, fontSize: 12,
          fontFamily: "system-ui",
          pointerEvents: "none", zIndex: 80,
          direction: "rtl",
        }}>
          WASD / الأسهم للتحرك · فأرة للنظر · Escape للخروج
        </div>
      )}

      {/* لوحة الصوت العائمة — مستقلة عن لوحة الكتابة */}
      {voiceOpen && geminiKey && (
        <div style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 340,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          padding: "16px 18px",
          zIndex: 200,
          direction: "rtl",
          fontFamily: "system-ui",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#333" }}>🎤 المحادثة الصوتية</div>
            <button
              onClick={() => setVoiceOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#999" }}
            >×</button>
          </div>
          <VoiceChat
            systemPrompt={systemPrompt}
            messages={messages.map(m => ({ role: m.role, content: m.content }))}
            geminiKey={geminiKey}
          />
        </div>
      )}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  border: "none", borderRadius: 8,
  padding: "7px 16px", fontSize: 12.5,
  cursor: "pointer", fontFamily: "system-ui",
  textDecoration: "none", display: "inline-block",
  letterSpacing: 0.2, fontWeight: 500,
  transition: "opacity 0.15s",
};
const btnBlue: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg,#1e6fd9,#1a5fc8)",
  color: "#fff",
  boxShadow: "0 2px 8px rgba(30,111,217,0.35)",
};
const btnGray: React.CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,0.1)",
  color: "#d0ccc6",
  border: "1px solid rgba(255,255,255,0.1)",
};
const btnPurple: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
  color: "#fff",
  boxShadow: "0 2px 8px rgba(124,58,237,0.35)",
};
const btnTeal: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg,#0d9488,#0f766e)",
  color: "#fff",
  boxShadow: "0 2px 8px rgba(13,148,136,0.35)",
};
