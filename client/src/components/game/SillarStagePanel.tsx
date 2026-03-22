import { Text } from "@react-three/drei";

// Returns true if a hex color is perceptually light (needs dark text)
function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45;
}

// ── Sillar Seesaw Stage Data ──────────────────────────────────────────────────
export interface StageInfo {
  stageNum: number;
  nameEn: string;
  nameAr: string;
  humanPct: number;
  humanColor: string;
  aiColor: string;
  humanRoles: string[];
  aiRoles: string[];
  gate: string;
  gateColor: string;
}

export const STAGE_DATA: StageInfo[] = [
  {
    stageNum: 0,
    nameEn: "Problem Definition",
    nameAr: "تعريف المشكلة",
    humanPct: 95,
    humanColor: "#3b82f6",
    aiColor: "#818cf8",
    humanRoles: ["Define the real problem", "Business context", "Identify constraints"],
    aiRoles: ["Critical thinking support", "Surface blind spots"],
    gate: "HUMAN ONLY",
    gateColor: "#3b82f6",
  },
  {
    stageNum: 1,
    nameEn: "Product Shaping",
    nameAr: "تشكيل المنتج",
    humanPct: 80,
    humanColor: "#22d3ee",
    aiColor: "#818cf8",
    humanRoles: ["Define product vision", "Set MVP scope", "Decide priorities"],
    aiRoles: ["Draft user stories", "Edge cases", "Market insights"],
    gate: "HUMAN ONLY",
    gateColor: "#22d3ee",
  },
  {
    stageNum: 2,
    nameEn: "Architecture Design",
    nameAr: "تصميم المعمارية",
    humanPct: 70,
    humanColor: "#a78bfa",
    aiColor: "#818cf8",
    humanRoles: ["Architectural decisions", "Evaluate trade-offs", "Approve stack"],
    aiRoles: ["Suggest patterns", "Generate diagrams", "Alternative approaches"],
    gate: "HUMAN",
    gateColor: "#a78bfa",
  },
  {
    stageNum: 3,
    nameEn: "Implementation",
    nameAr: "التنفيذ — شريحة الإنتاج",
    humanPct: 40,
    humanColor: "#60a5fa",
    aiColor: "#a855f7",
    humanRoles: ["Review code", "Business-critical logic", "Validate intent"],
    aiRoles: ["Generate boilerplate", "CRUD & tests", "Assist refactoring"],
    gate: "HUMAN + AI",
    gateColor: "#c084fc",
  },
  {
    stageNum: 4,
    nameEn: "Observability & Ops",
    nameAr: "المراقبة والعمليات",
    humanPct: 50,
    humanColor: "#f59e0b",
    aiColor: "#a855f7",
    humanRoles: ["Define KPIs & SLOs", "Interpret incidents", "Operational decisions"],
    aiRoles: ["Log analysis", "Anomaly detection", "Alert tuning"],
    gate: "HUMAN + AI",
    gateColor: "#f59e0b",
  },
  {
    stageNum: 5,
    nameEn: "Reproducibility",
    nameAr: "قابلية التكرار",
    humanPct: 60,
    humanColor: "#c084fc",
    aiColor: "#818cf8",
    humanRoles: ["Governance rules", "Versioning strategy", "Compliance"],
    aiRoles: ["IaC generation", "Pipeline templates", "Documentation"],
    gate: "HUMAN",
    gateColor: "#c084fc",
  },
  {
    stageNum: 6,
    nameEn: "Production Ready",
    nameAr: "جاهزية الإنتاج",
    humanPct: 80,
    humanColor: "#10b981",
    aiColor: "#818cf8",
    humanRoles: ["Go / No-Go decisions", "Risk acceptance", "Final accountability"],
    aiRoles: ["Stress-test scenarios", "Readiness checklists"],
    gate: "HUMAN ONLY",
    gateColor: "#10b981",
  },
];

const BG  = "#040d1a";  // panel dark background
const BG2 = "#060f20";  // header dark background

// ── Panel component ───────────────────────────────────────────────────────────
interface SillarStagePanelProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  stageNum: number;
}

export function SillarStagePanel({ position, rotation = [0, 0, 0], stageNum }: SillarStagePanelProps) {
  const d = STAGE_DATA[stageNum];
  if (!d) return null;

  const W  = 4.2;
  const H  = 5.8;
  const ai = 100 - d.humanPct;
  const gateTextColor = isLight(d.gateColor) ? "#0a1020" : "#ffffff";

  // bar widths (total bar width = W - 0.5)
  const barTotal = W - 0.5;
  const hBarW    = (d.humanPct / 100) * barTotal;
  const aBarW    = (ai / 100) * barTotal;
  const barStart = -(barTotal / 2);

  return (
    <group position={position} rotation={rotation}>
      {/* ── Backing panel ─────────────────────────────────────────── */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[W, H, 0.06]} />
        <meshStandardMaterial color={BG} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* ── Glowing border ────────────────────────────────────────── */}
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[W + 0.08, H + 0.08, 0.03]} />
        <meshStandardMaterial color={d.gateColor} emissive={d.gateColor} emissiveIntensity={0.35} />
      </mesh>

      {/* ── Header strip — always dark ────────────────────────────── */}
      <mesh position={[0, H / 2 - 0.48, 0.01]}>
        <boxGeometry args={[W, 0.9, 0.02]} />
        <meshStandardMaterial color={BG2} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Colored accent line under header */}
      <mesh position={[0, H / 2 - 0.97, 0.02]}>
        <boxGeometry args={[W, 0.04, 0.01]} />
        <meshStandardMaterial color={d.humanColor} emissive={d.humanColor} emissiveIntensity={0.6} />
      </mesh>

      {/* Stage number */}
      <Text
        position={[-W / 2 + 0.7, H / 2 - 0.48, 0.05]}
        fontSize={0.52}
        color={d.humanColor}
        anchorX="center"
        anchorY="middle"
        backgroundColor={BG2}
        backgroundOpacity={1}
      >
        {`S${d.stageNum}`}
      </Text>

      {/* Arabic name */}
      <Text
        position={[0.3, H / 2 - 0.34, 0.05]}
        fontSize={0.22}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        backgroundColor={BG2}
        backgroundOpacity={1}
      >
        {d.nameAr}
      </Text>

      {/* English name */}
      <Text
        position={[0.3, H / 2 - 0.62, 0.05]}
        fontSize={0.17}
        color="#a0b8d0"
        anchorX="center"
        anchorY="middle"
        backgroundColor={BG2}
        backgroundOpacity={1}
      >
        {d.nameEn}
      </Text>

      {/* ── Ratio bar background ──────────────────────────────────── */}
      <mesh position={[0, H / 2 - 1.35, 0.01]}>
        <boxGeometry args={[barTotal, 0.38, 0.02]} />
        <meshStandardMaterial color="#0a1628" roughness={0.5} />
      </mesh>

      {/* Human bar */}
      <mesh position={[barStart + hBarW / 2, H / 2 - 1.35, 0.025]}>
        <boxGeometry args={[hBarW, 0.32, 0.02]} />
        <meshStandardMaterial color={d.humanColor} emissive={d.humanColor} emissiveIntensity={0.4} />
      </mesh>

      {/* AI bar */}
      <mesh position={[barStart + hBarW + aBarW / 2, H / 2 - 1.35, 0.025]}>
        <boxGeometry args={[aBarW, 0.32, 0.02]} />
        <meshStandardMaterial color={d.aiColor} emissive={d.aiColor} emissiveIntensity={0.3} />
      </mesh>

      {/* Human % label */}
      <Text
        position={[barStart + hBarW / 2, H / 2 - 1.35, 0.06]}
        fontSize={0.16}
        color={isLight(d.humanColor) ? "#000" : "#fff"}
        anchorX="center"
        anchorY="middle"
        backgroundColor={d.humanColor}
        backgroundOpacity={1}
      >
        {`HUMAN ${d.humanPct}%`}
      </Text>

      {/* AI % label */}
      <Text
        position={[barStart + hBarW + aBarW / 2, H / 2 - 1.35, 0.06]}
        fontSize={0.16}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        backgroundColor={d.aiColor}
        backgroundOpacity={1}
      >
        {`AI ${ai}%`}
      </Text>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <mesh position={[0, H / 2 - 1.72, 0.02]}>
        <boxGeometry args={[W - 0.3, 0.025, 0.01]} />
        <meshStandardMaterial color={d.gateColor} emissive={d.gateColor} emissiveIntensity={0.5} />
      </mesh>

      {/* ── Human roles label ─────────────────────────────────────── */}
      <Text
        position={[-W / 2 + 0.55, H / 2 - 2.02, 0.05]}
        fontSize={0.155}
        color={d.humanColor}
        anchorX="left"
        anchorY="middle"
        backgroundColor={BG}
        backgroundOpacity={1}
      >
        HUMAN OWNS:
      </Text>
      {d.humanRoles.map((role, i) => (
        <Text
          key={`h-${i}`}
          position={[-W / 2 + 0.65, H / 2 - 2.35 - i * 0.3, 0.05]}
          fontSize={0.135}
          color="#c8dff0"
          anchorX="left"
          anchorY="middle"
          backgroundColor={BG}
          backgroundOpacity={1}
        >
          {`› ${role}`}
        </Text>
      ))}

      {/* ── AI roles label ────────────────────────────────────────── */}
      <Text
        position={[-W / 2 + 0.55, H / 2 - 2.35 - d.humanRoles.length * 0.3 - 0.22, 0.05]}
        fontSize={0.155}
        color={d.aiColor}
        anchorX="left"
        anchorY="middle"
        backgroundColor={BG}
        backgroundOpacity={1}
      >
        AI DELIVERS:
      </Text>
      {d.aiRoles.map((role, i) => (
        <Text
          key={`a-${i}`}
          position={[-W / 2 + 0.65, H / 2 - 2.35 - d.humanRoles.length * 0.3 - 0.55 - i * 0.28, 0.05]}
          fontSize={0.135}
          color="#d8c8ff"
          anchorX="left"
          anchorY="middle"
          backgroundColor={BG}
          backgroundOpacity={1}
        >
          {`› ${role}`}
        </Text>
      ))}

      {/* ── Gate strip at bottom ──────────────────────────────────── */}
      <mesh position={[0, -H / 2 + 0.35, 0.02]}>
        <boxGeometry args={[W, 0.58, 0.03]} />
        <meshStandardMaterial color={d.gateColor} emissive={d.gateColor} emissiveIntensity={0.25} />
      </mesh>
      <Text
        position={[0, -H / 2 + 0.35, 0.06]}
        fontSize={0.19}
        color={gateTextColor}
        anchorX="center"
        anchorY="middle"
        backgroundColor={d.gateColor}
        backgroundOpacity={1}
      >
        {`⚡ ${d.gate} GATE`}
      </Text>
    </group>
  );
}

// ── Small room sign (frame + stage label) ─────────────────────────────────────
interface RoomStageSignProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  stageNum: number;
}
export function RoomStageSign({ position, rotation = [0, 0, 0], stageNum }: RoomStageSignProps) {
  const d = STAGE_DATA[stageNum];
  if (!d) return null;
  return (
    <group position={position} rotation={rotation}>
      {/* Panel background */}
      <mesh position={[0, 0, -0.025]}>
        <boxGeometry args={[2.9, 1.5, 0.04]} />
        <meshStandardMaterial color="#0a1628" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Glowing border */}
      <mesh position={[0, 0, -0.015]}>
        <boxGeometry args={[3.02, 1.62, 0.02]} />
        <meshStandardMaterial color={d.gateColor} emissive={d.gateColor} emissiveIntensity={0.7} />
      </mesh>
      {/* Stage number */}
      <Text
        position={[0, 0.28, 0.01]}
        fontSize={0.52}
        color={d.gateColor}
        anchorX="center"
        anchorY="middle"
        backgroundColor="#0a1628"
        backgroundOpacity={1}
      >
        {`S${d.stageNum}`}
      </Text>
      {/* Stage name */}
      <Text
        position={[0, -0.22, 0.01]}
        fontSize={0.19}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        backgroundColor="#0a1628"
        backgroundOpacity={1}
      >
        {d.nameEn}
      </Text>
    </group>
  );
}
