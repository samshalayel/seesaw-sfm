import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef, useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { GeminiLiveChat } from "../components/game/GeminiLiveChat";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Settings {
  apiKey: string;
  model: string;
  systemPrompt: string;
  geminiKey: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "office_lite_settings";

const DEFAULT_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
];

// ─────────────────────────────────────────────
// 3D Scene helpers
// ─────────────────────────────────────────────

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[12, 10]} />
      <meshStandardMaterial color="#e8e0d5" roughness={0.8} />
    </mesh>
  );
}

function Walls() {
  return (
    <>
      {/* back wall */}
      <mesh position={[0, 2.5, -5]} receiveShadow>
        <boxGeometry args={[12, 5, 0.12]} />
        <meshStandardMaterial color="#f0ebe4" roughness={0.9} />
      </mesh>
      {/* left wall */}
      <mesh position={[-6, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.12, 5, 10]} />
        <meshStandardMaterial color="#ede8e0" roughness={0.9} />
      </mesh>
      {/* right wall */}
      <mesh position={[6, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.12, 5, 10]} />
        <meshStandardMaterial color="#ede8e0" roughness={0.9} />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[12, 0.12, 10]} />
        <meshStandardMaterial color="#f5f2ee" roughness={1} />
      </mesh>
    </>
  );
}

function Window() {
  return (
    <group position={[0, 2.8, -4.93]}>
      {/* frame */}
      <mesh>
        <boxGeometry args={[2.6, 1.8, 0.08]} />
        <meshStandardMaterial color="#c8bfb0" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* glass */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[2.4, 1.6, 0.02]} />
        <meshStandardMaterial color="#d4eaf7" transparent opacity={0.4} roughness={0} metalness={0.1} />
      </mesh>
      {/* sunlight rect */}
      <rectAreaLight
        position={[0, 0, 0.2]}
        rotation={[0, 0, 0]}
        width={2.4}
        height={1.6}
        intensity={8}
        color="#fff5e0"
      />
    </group>
  );
}

function Desk() {
  const wood = "#8b6843";
  const leg  = "#6b4f30";
  return (
    <group position={[0, 0, -1]}>
      {/* top surface */}
      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.06, 0.9]} />
        <meshStandardMaterial color={wood} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* legs */}
      {([-0.95, 0.95] as number[]).map((x) =>
        ([-0.35, 0.35] as number[]).map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.38, z]} castShadow>
            <boxGeometry args={[0.06, 0.76, 0.06]} />
            <meshStandardMaterial color={leg} roughness={0.6} />
          </mesh>
        ))
      )}
      {/* monitor */}
      <mesh position={[0, 1.22, -0.28]} castShadow>
        <boxGeometry args={[0.7, 0.42, 0.04]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.22, -0.26]}>
        <boxGeometry args={[0.64, 0.36, 0.01]} />
        <meshStandardMaterial color="#0d1117" emissive="#1a2840" emissiveIntensity={0.6} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.84, -0.28]}>
        <boxGeometry args={[0.06, 0.08, 0.04]} />
        <meshStandardMaterial color="#222" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

function Plant() {
  return (
    <group position={[4.5, 0, -4]}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.45, 10]} />
        <meshStandardMaterial color="#7a6552" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.56, 0]} castShadow>
        <sphereGeometry args={[0.28, 10, 8]} />
        <meshStandardMaterial color="#4a7c59" roughness={0.9} />
      </mesh>
      <mesh position={[0.12, 0.7, 0.08]} castShadow>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#3d6b4a" roughness={0.9} />
      </mesh>
      <mesh position={[-0.1, 0.65, -0.1]} castShadow>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#55885e" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Bookshelf() {
  const wood = "#7a5c3a";
  return (
    <group position={[-5.8, 0, -3.5]}>
      {/* back panel */}
      <mesh position={[0.06, 1.5, 0]}>
        <boxGeometry args={[0.06, 3, 1.0]} />
        <meshStandardMaterial color={wood} roughness={0.6} />
      </mesh>
      {/* shelves */}
      {[0.3, 1.0, 1.7, 2.4, 3.0].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[0.28, 0.04, 1.0]} />
          <meshStandardMaterial color={wood} roughness={0.6} />
        </mesh>
      ))}
      {/* side panels */}
      {([-0.46, 0.46] as number[]).map((z) => (
        <mesh key={z} position={[0, 1.55, z]}>
          <boxGeometry args={[0.28, 3.1, 0.04]} />
          <meshStandardMaterial color={wood} roughness={0.6} />
        </mesh>
      ))}
      {/* decorative books */}
      {[
        { y: 0.52, z: -0.2, w: 0.07, h: 0.36, c: "#c0392b" },
        { y: 0.52, z: -0.1, w: 0.06, h: 0.28, c: "#2471a3" },
        { y: 0.52, z:  0.0, w: 0.08, h: 0.32, c: "#1e8449" },
        { y: 0.52, z:  0.1, w: 0.06, h: 0.30, c: "#d68910" },
        { y: 1.22, z: -0.15,w: 0.07, h: 0.34, c: "#6c3483" },
        { y: 1.22, z: -0.05,w: 0.06, h: 0.26, c: "#1a5276" },
        { y: 1.22, z:  0.05,w: 0.08, h: 0.32, c: "#7b241c" },
      ].map((b, i) => (
        <mesh key={i} position={[0.06, b.y, b.z]} castShadow>
          <boxGeometry args={[0.18, b.h, b.w]} />
          <meshStandardMaterial color={b.c} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────
// Animated Office Robot
// ─────────────────────────────────────────────
function OfficeRobot({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef  = useRef<THREE.Group>(null);
  const bodyRef  = useRef<THREE.Group>(null);
  const eyeL     = useRef<THREE.MeshStandardMaterial>(null);
  const eyeR     = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const color = isActive ? "#00c896" : "#7ca8cc";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 1.4) * 0.01;
    if (headRef.current) headRef.current.rotation.y = Math.sin(t * 0.7) * 0.1;
    const glow = 0.5 + Math.sin(t * 2) * 0.3;
    if (eyeL.current) eyeL.current.emissiveIntensity = glow;
    if (eyeR.current) eyeR.current.emissiveIntensity = glow;
  });

  return (
    <group
      ref={groupRef}
      position={[0, 0, -0.4]}
      scale={hovered ? 1.4 : 1.35}
      onClick={onClick}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      {/* seat */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.48]} />
        <meshStandardMaterial color="#1e1e2e" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.035, 0.042, 0.44, 10]} />
        <meshStandardMaterial color="#555566" metalness={0.9} roughness={0.1} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[0.22, 0.03, 0]}>
              <boxGeometry args={[0.38, 0.03, 0.05]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}

      {/* body */}
      <group ref={bodyRef} position={[0, 0.65, 0]}>
        <mesh position={[0, 0.52, 0]} castShadow>
          <boxGeometry args={[0.42, 0.38, 0.28]} />
          <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
        </mesh>
        <mesh position={[0, 0.62, 0.15]}>
          <boxGeometry args={[0.28, 0.018, 0.006]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.1} />
        </mesh>
        {/* neck */}
        <mesh position={[0, 0.78, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.10, 0.14, 10]} />
          <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6} />
        </mesh>
        {/* head */}
        <group ref={headRef} position={[0, 0.98, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.28, 0.28]} />
            <meshStandardMaterial color="#2e2e3a" roughness={0.25} metalness={0.75} />
          </mesh>
          {/* screen face */}
          <mesh position={[0, 0.01, 0.142]}>
            <planeGeometry args={[0.24, 0.18]} />
            <meshStandardMaterial color="#040d18" emissive="#0a1628" emissiveIntensity={0.9} roughness={0.05} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.07, 0.03, 0.145]}>
            <planeGeometry args={[0.065, 0.055]} />
            <meshStandardMaterial ref={eyeL} color={color} emissive={color} emissiveIntensity={0.7} roughness={0.05} />
          </mesh>
          <mesh position={[0.07, 0.03, 0.145]}>
            <planeGeometry args={[0.065, 0.055]} />
            <meshStandardMaterial ref={eyeR} color={color} emissive={color} emissiveIntensity={0.7} roughness={0.05} />
          </mesh>
          {/* mouth */}
          <mesh position={[0, -0.065, 0.143]}>
            <planeGeometry args={[0.10, 0.012]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
          </mesh>
          {/* antenna */}
          <mesh position={[0, 0.20, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
            <meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
          </mesh>
          <pointLight position={[0, 0, 0.4]} intensity={0.5} color={color} distance={1.2} decay={2} />
        </group>
      </group>

      {/* hover label */}
      {hovered && !isActive && (
        <group position={[0, 2.4, 0]}>
          <mesh>
            <planeGeometry args={[1.1, 0.3]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.7} depthTest={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────
// Settings Panel (pure HTML overlay)
// ─────────────────────────────────────────────
function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Settings>(settings);

  const save = () => {
    onChange(local);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#faf8f5",
        borderRadius: 16,
        padding: "28px 32px",
        width: 420,
        maxWidth: "90vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        direction: "rtl",
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#2c2c2c", fontFamily: "system-ui" }}>
          ⚙️ إعدادات المكتب
        </h2>

        <label style={labelStyle}>
          مفتاح API
          <input
            type="password"
            value={local.apiKey}
            onChange={e => setLocal(p => ({ ...p, apiKey: e.target.value }))}
            placeholder="sk-... أو sk-ant-..."
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          الموديل
          <input
            type="text"
            value={local.model}
            onChange={e => setLocal(p => ({ ...p, model: e.target.value }))}
            list="model-suggestions"
            placeholder="gpt-4o-mini"
            style={inputStyle}
          />
          <datalist id="model-suggestions">
            {DEFAULT_MODELS.map(m => <option key={m} value={m} />)}
          </datalist>
        </label>

        <label style={labelStyle}>
          Gemini API Key <span style={{ fontWeight: 400, color: "#999", fontSize: 12 }}>(للمحادثة الصوتية)</span>
          <input
            type="password"
            value={local.geminiKey}
            onChange={e => setLocal(p => ({ ...p, geminiKey: e.target.value }))}
            placeholder="AIza..."
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          تعليمات الروبوت
          <textarea
            value={local.systemPrompt}
            onChange={e => setLocal(p => ({ ...p, systemPrompt: e.target.value }))}
            placeholder="أنت مساعد طبي محترف..."
            rows={5}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button onClick={save} style={btnPrimary}>حفظ</button>
          <button onClick={onClose} style={btnSecondary}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Chat Overlay
// ─────────────────────────────────────────────
function ChatOverlay({
  messages,
  loading,
  onSend,
  onClose,
  geminiKey,
  systemPrompt,
}: {
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  geminiKey?: string;
  systemPrompt?: string;
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
      position: "fixed",
      bottom: 0, right: 0,
      width: 380, height: "100vh",
      background: "#ffffff",
      boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
      display: "flex", flexDirection: "column",
      zIndex: 100,
      direction: "rtl",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #f0ede8",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#faf8f5",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #7ca8cc, #00c896)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>المساعد</div>
            <div style={{ fontSize: 11, color: "#00c896" }}>● متصل</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 20, color: "#888", lineHeight: 1,
        }}>×</button>
      </div>

      {/* messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 14px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: "center", color: "#aaa", fontSize: 13, marginTop: 40,
          }}>
            انقر على الروبوت للتحدث معه أو اكتب رسالتك هنا
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "84%",
          }}>
            <div style={{
              background: m.role === "user" ? "#1a73e8" : "#f4f1ed",
              color: m.role === "user" ? "#fff" : "#1a1a1a",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              fontSize: 13.5,
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{
              background: "#f4f1ed",
              padding: "10px 16px",
              borderRadius: "18px 18px 18px 4px",
              fontSize: 13,
              color: "#888",
            }}>
              <span style={{ animation: "blink 1.2s step-end infinite" }}>●</span>
              <span style={{ animation: "blink 1.2s step-end 0.4s infinite", marginLeft: 3 }}>●</span>
              <span style={{ animation: "blink 1.2s step-end 0.8s infinite", marginLeft: 3 }}>●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* voice */}
      {geminiKey && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid #f0ede8", background: "#faf8f5" }}>
          <GeminiLiveChat
            geminiApiKey={geminiKey}
            systemPrompt={systemPrompt}
            messages={messages}
            robotName="المساعد"
          />
        </div>
      )}

      {/* input */}
      <div style={{
        padding: "12px 14px",
        borderTop: "1px solid #f0ede8",
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
            flex: 1,
            border: "1px solid #e5e0d8",
            borderRadius: 22,
            padding: "9px 16px",
            fontSize: 13.5,
            outline: "none",
            background: "#fff",
            direction: "rtl",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? "#d0ccc6" : "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 40, height: 40,
            cursor: loading || !input.trim() ? "default" : "pointer",
            fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >→</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main OfficePage
// ─────────────────────────────────────────────
export default function OfficePage() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { apiKey: "", model: "gpt-4o-mini", systemPrompt: "", geminiKey: "" };
    } catch {
      return { apiKey: "", model: "gpt-4o-mini", systemPrompt: "" };
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!settings.apiKey) {
      setShowSettings(true);
      return;
    }

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/lite/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          apiKey: settings.apiKey,
          model: settings.model,
          systemPrompt: settings.systemPrompt,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("no stream");

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      setLoading(false);

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (!value) continue;
        const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: last.content + parsed.content };
                }
                return msgs;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      setLoading(false);
      setMessages(prev => [...prev, { role: "assistant", content: `خطأ: ${err.message}` }]);
    }
  }, [settings, messages]);

  const handleRobotClick = () => {
    if (!settings.apiKey) {
      setShowSettings(true);
      return;
    }
    setChatOpen(true);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#e8e4de", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
      `}</style>

      {/* 3D Canvas */}
      <Canvas
        flat
        shadows
        camera={{ position: [0, 3.2, 5.5], fov: 52 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        style={{ width: chatOpen ? "calc(100% - 380px)" : "100%", height: "100%" }}
      >
        <color attach="background" args={["#d6d0c8"]} />
        <ambientLight intensity={1.8} color="#fff8f0" />
        <directionalLight
          position={[3, 8, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
        <pointLight position={[0, 3.5, 1]} intensity={15} color="#fff5e0" distance={10} decay={1.5} />

        <Suspense fallback={null}>
          <Floor />
          <Walls />
          <Window />
          <Desk />
          <Plant />
          <Bookshelf />
          <OfficeRobot onClick={handleRobotClick} isActive={chatOpen} />
        </Suspense>
      </Canvas>

      {/* Top bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: chatOpen ? 380 : 0,
        height: 52,
        background: "rgba(250,248,245,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
        zIndex: 50,
        direction: "rtl",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #7ca8cc, #00c896)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}>🤖</div>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#2c2c2c" }}>المكتب الذكي</span>
          {settings.model && (
            <span style={{
              fontSize: 11, color: "#888",
              background: "#f0ede8", padding: "2px 8px", borderRadius: 10,
            }}>{settings.model}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {chatOpen && (
            <button onClick={() => setChatOpen(false)} style={topBtn}>
              ✕ إغلاق الدردشة
            </button>
          )}
          {!chatOpen && settings.apiKey && (
            <button onClick={() => setChatOpen(true)} style={{ ...topBtn, background: "#1a73e8", color: "#fff" }}>
              💬 فتح الدردشة
            </button>
          )}
          <button onClick={() => setShowSettings(true)} style={topBtn}>
            ⚙️ الإعدادات
          </button>
        </div>
      </div>

      {/* No API key hint */}
      {!settings.apiKey && (
        <div style={{
          position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.72)",
          color: "#fff",
          padding: "12px 22px",
          borderRadius: 30,
          fontSize: 13,
          fontFamily: "system-ui",
          cursor: "pointer",
          zIndex: 50,
          direction: "rtl",
        }} onClick={() => setShowSettings(true)}>
          ⚙️ اضغط لإضافة API Key والبدء
        </div>
      )}

      {/* Robot click hint */}
      {settings.apiKey && !chatOpen && (
        <div style={{
          position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 30,
          fontSize: 12.5,
          fontFamily: "system-ui",
          pointerEvents: "none",
          zIndex: 50,
          direction: "rtl",
        }}>
          انقر على الروبوت للتحدث
        </div>
      )}

      {/* Panels */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {chatOpen && (
        <ChatOverlay
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          onClose={() => setChatOpen(false)}
          geminiKey={settings.geminiKey}
          systemPrompt={settings.systemPrompt}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 16,
  fontSize: 13.5,
  fontWeight: 500,
  color: "#3a3a3a",
  fontFamily: "system-ui",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #ddd8d0",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13.5,
  outline: "none",
  background: "#fff",
  direction: "ltr",
  width: "100%",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  flex: 1,
  background: "#1a73e8",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 0",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "system-ui",
};

const btnSecondary: React.CSSProperties = {
  flex: 1,
  background: "#f0ede8",
  color: "#444",
  border: "none",
  borderRadius: 8,
  padding: "10px 0",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "system-ui",
};

const topBtn: React.CSSProperties = {
  background: "#f0ede8",
  color: "#444",
  border: "none",
  borderRadius: 20,
  padding: "6px 14px",
  fontSize: 12.5,
  cursor: "pointer",
  fontFamily: "system-ui",
};
