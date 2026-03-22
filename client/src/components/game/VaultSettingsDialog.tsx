import { useEffect, useRef, useState } from "react";
import { useGame, getMaxModels, getMaxHallWorkers } from "@/lib/stores/useGame";
import { apiFetch } from "@/lib/utils";

interface ModelEntry {
  id?: string;
  name: string;
  alias?: string; // اسم ظاهر مخصص (Funny Name)
  apiKey: string;
  modelId?: string; // sub-model للـ OpenRouter (مثل anthropic/claude-3.5-sonnet)
  systemPrompt?: string; // تعليمات خاصة بهذا الموديل
  roomAssignment?: string; // الغرفة التي يظهر فيها الروبوت
}

const ROOM_OPTIONS = [
  { value: "main",    label: "🏢 الغرفة الرئيسية" },
  { value: "stage0",  label: "🔵 المرحلة 1 — Product Shaping" },
  { value: "stage1",  label: "🟣 المرحلة 2 — Architecture" },
  { value: "manager", label: "🔑 غرفة المدير" },
  { value: "brA",     label: "🟡 المرحلة 4 — Observability" },
  { value: "brB",     label: "🟤 المرحلة 5 — Reproducibility" },
  { value: "brC",     label: "🟢 المرحلة 6 — Production Ready" },
];

const MODEL_PRESETS = ["Groq", "GPT", "Claude", "GLM", "Grok", "Gemini", "Mistral", "OpenRouter", "OpenCode", "v0", "Devin", "Other"];
const FREE_MODELS = ["Groq", "GLM", "Gemini", "OpenCode", "v0"];

// الموديلات الشائعة على OpenRouter
const OPENROUTER_MODELS = [
  { label: "🆓 Llama 3.3 70B", value: "meta-llama/llama-3.3-70b-instruct:free" },
  { label: "🆓 DeepSeek R1", value: "deepseek/deepseek-r1:free" },
  { label: "🆓 Gemini Flash 2.0", value: "google/gemini-2.0-flash-exp:free" },
  { label: "🆓 Mistral 7B", value: "mistralai/mistral-7b-instruct:free" },
  { label: "💳 Claude 3.5 Sonnet", value: "anthropic/claude-3.5-sonnet" },
  { label: "💳 Claude 3 Haiku", value: "anthropic/claude-3-haiku" },
  { label: "💳 GPT-4o", value: "openai/gpt-4o" },
  { label: "💳 GPT-4o Mini", value: "openai/gpt-4o-mini" },
];

// موديلات ZhipuAI (OpenCode)
const OPENCODE_MODELS = [
  { label: "🆓 GLM-4.7-Flash", value: "glm-4.7-flash", free: true },
  { label: "🆓 GLM-4.5-Flash", value: "glm-4.5-flash", free: true },
  { label: "💳 GLM-5", value: "glm-5", free: false },
  { label: "💳 GLM-5-Code", value: "glm-5-code", free: false },
  { label: "💳 GLM-4.7", value: "glm-4.7", free: false },
  { label: "💳 GLM-4.7-Flashx", value: "glm-4.7-flashx", free: false },
  { label: "💳 GLM-4.6", value: "glm-4.6", free: false },
  { label: "💳 GLM-4.5", value: "glm-4.5", free: false },
  { label: "💳 GLM-4.5-X", value: "glm-4.5-x", free: false },
  { label: "💳 GLM-4.5-Air", value: "glm-4.5-air", free: false },
  { label: "💳 GLM-4.5-Airx", value: "glm-4.5-airx", free: false },
  { label: "💳 GLM-4-32B-128K", value: "glm-4-32b-0414-128k", free: false },
];

// موديلات v0 (Vercel)
const V0_MODELS = [
  { label: "🔧 v0-1.5-md", value: "v0-1.5-md" },
  { label: "🔧 v0-1.5-lg", value: "v0-1.5-lg" },
  { label: "🔧 v0-1.0-md", value: "v0-1.0-md" },
];

// موديلات Devin (Cognition)
const DEVIN_MODELS = [
  { label: "🤖 devin", value: "devin" },
];

export function VaultSettingsDialog() {
  const isOpen = useGame((s) => s.vaultOpen);
  const closeVault = useGame((s) => s.closeVault);
  const fetchModels = useGame((s) => s.fetchModels);
  const fetchHallWorkers = useGame((s) => s.fetchHallWorkers);
  const setCompanyInfo = useGame((s) => s.setCompanyInfo);
  const [activeTab, setActiveTab] = useState<"company" | "github" | "clickup" | "models" | "ai-worker" | "instructions" | "stats">("company");

  const [mainCode, setMainCode] = useState("1977");
  const [managerCode, setManagerCode] = useState("0000");

  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");

  const [githubToken, setGithubToken] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  const [clickupToken, setClickupToken] = useState("");
  const [clickupListId, setClickupListId] = useState("");
  const [clickupAssignee, setClickupAssignee] = useState("");

  const [models, setModels] = useState<ModelEntry[]>([]);
  const [hallWorkers, setHallWorkers] = useState<ModelEntry[]>([]);
  const [defaultModel, setDefaultModelState] = useState<string>("Groq");
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  // رابط المشاركة (Guest Link)
  const [shareLink, setShareLink] = useState("");
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // OpenRouter dynamic models list (room robots)
  const [orModels, setOrModels] = useState<Record<number, { id: string; name: string; isFree: boolean }[]>>({});
  const [orFetching, setOrFetching] = useState<Record<number, boolean>>({});
  // OpenRouter dynamic models list (hall workers)
  const [hwOrModels, setHwOrModels] = useState<Record<number, { id: string; name: string; isFree: boolean }[]>>({});
  const [hwOrFetching, setHwOrFetching] = useState<Record<number, boolean>>({});

  const fetchOrModels = async (idx: number, apiKey: string) => {
    setOrFetching((prev) => ({ ...prev, [idx]: true }));
    try {
      const params = apiKey.trim() ? `?key=${encodeURIComponent(apiKey.trim())}` : "";
      const r = await fetch(`/api/openrouter/models${params}`);
      const data = await r.json();
      if (data.models) {
        setOrModels((prev) => ({ ...prev, [idx]: data.models }));
      }
    } catch {
      // ignore
    }
    setOrFetching((prev) => ({ ...prev, [idx]: false }));
  };
  const fetchHwOrModels = async (idx: number, apiKey: string) => {
    setHwOrFetching((prev) => ({ ...prev, [idx]: true }));
    try {
      const params = apiKey.trim() ? `?key=${encodeURIComponent(apiKey.trim())}` : "";
      const r = await fetch(`/api/openrouter/models${params}`);
      const data = await r.json();
      if (data.models) {
        setHwOrModels((prev) => ({ ...prev, [idx]: data.models }));
      }
    } catch {
      // ignore
    }
    setHwOrFetching((prev) => ({ ...prev, [idx]: false }));
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Drag & Resize state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 480, h: 560 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Center dialog when it opens
  useEffect(() => {
    if (isOpen) {
      setPos({
        x: Math.round(window.innerWidth / 2 - size.w / 2),
        y: Math.round(window.innerHeight / 2 - size.h / 2),
      });
    }
  }, [isOpen]);

  const onDragStart = (e: React.MouseEvent) => {
    if (!pos) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, dragRef.current.origX + ev.clientX - dragRef.current.startX),
        y: Math.max(0, dragRef.current.origY + ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setSize({
        w: Math.max(380, resizeRef.current.origW + ev.clientX - resizeRef.current.startX),
        h: Math.max(400, resizeRef.current.origH + ev.clientY - resizeRef.current.startY),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Admin stats
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number;
    totalModels: number;
    users: Array<{
      id: number; username: string; roomId: string;
      companyName: string; modelCount: number;
      models: Array<{ name: string; hasKey: boolean; modelId: string | null }>;
      defaultModel: string; hasSystemPrompt: boolean;
      hasGitHub: boolean; hasClickUp: boolean;
    }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ github?: { connected: boolean; user?: string; error?: string }; clickup?: { connected: boolean; workspace?: string; error?: string } } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      apiFetch("/api/vault-settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.doors) {
            setMainCode(data.doors.mainCode || "1977");
            setManagerCode(data.doors.managerCode || "2024");
          }
          if (data.company) {
            const name = data.company.name || "";
            const logo = data.company.logo || "";
            setCompanyName(name);
            setCompanyLogo(logo);
            setCompanyInfo(name, logo);
          }
          if (data.github) {
            setGithubToken(data.github.token || "");
            setGithubOwner(data.github.owner || "");
            setGithubRepo(data.github.repo || "");
          }
          if (data.clickup) {
            setClickupToken(data.clickup.token || "");
            setClickupListId(data.clickup.listId || "");
            setClickupAssignee(data.clickup.assignee || "");
          }
          if (data.models && Array.isArray(data.models)) {
            setModels(data.models);
          }
          if (data.hallWorkers && Array.isArray(data.hallWorkers)) {
            setHallWorkers(data.hallWorkers);
          }
          if (data.systemPrompt !== undefined) {
            setSystemPrompt(data.systemPrompt || "");
          }
        })
        .catch(() => {});
      // Load default model separately
      apiFetch("/api/default-model")
        .then((r) => r.json())
        .then((data) => {
          if (data.defaultModel) setDefaultModelState(data.defaultModel);
        })
        .catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeVault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeVault]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/vault-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doors: { mainCode: mainCode, managerCode: managerCode },
          company: { name: companyName, logo: companyLogo },
          github: { token: githubToken, owner: githubOwner, repo: githubRepo },
          clickup: { token: clickupToken, listId: clickupListId, assignee: clickupAssignee },
          models: models.filter(m => m.name.trim() || m.apiKey.trim()),
          hallWorkers: hallWorkers.filter(m => m.name.trim() || m.apiKey.trim()),
          systemPrompt: systemPrompt,
        }),
      });
      // Save default model
      if (defaultModel) {
        await apiFetch("/api/default-model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelName: defaultModel }),
        });
      }
      // تحديث الروبوتات في الصالة فوراً بدون تسجيل خروج
      await Promise.all([fetchModels(), fetchHallWorkers()]);
      // تحديث شعار الشركة على الجدار فوراً
      setCompanyInfo(companyName, companyLogo);
      setSaved(true);
      // hint: أين انتقلت الروبوتات
      const nonMain = models.filter(m => (m.name.trim() || m.apiKey.trim()) && m.roomAssignment && m.roomAssignment !== "main");
      if (nonMain.length > 0) {
        const roomLabel = (v: string) => ROOM_OPTIONS.find(o => o.value === v)?.label || v;
        setSavedHint(nonMain.map(m => `${m.name || "روبوت"} → ${roomLabel(m.roomAssignment!)}`).join(" | "));
      } else {
        setSavedHint(null);
      }
      setTimeout(() => { setSaved(false); setSavedHint(null); }, 4000);
    } catch {
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch("/api/vault-settings/test", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ github: { connected: false, error: "Connection failed" }, clickup: { connected: false, error: "Connection failed" } });
    }
    setTesting(false);
  };

  const maxHallWorkers = getMaxHallWorkers();
  const addHallWorker = () => {
    if (hallWorkers.length >= maxHallWorkers) return;
    const id = "hw-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    setHallWorkers([...hallWorkers, { id, name: "", apiKey: "" }]);
  };
  const removeHallWorker = (index: number) => {
    setHallWorkers(hallWorkers.filter((_, i) => i !== index));
  };
  const updateHallWorker = (index: number, field: "name" | "apiKey" | "modelId" | "systemPrompt", value: string) => {
    const updated = [...hallWorkers];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "name" && value === "OpenRouter" && !updated[index].modelId) {
      updated[index].modelId = OPENROUTER_MODELS[0].value;
    }
    if (field === "name" && value === "OpenCode" && !updated[index].modelId) {
      updated[index].modelId = OPENCODE_MODELS[0].value;
    }
    if (field === "name" && value === "Devin") {
      updated[index].modelId = DEVIN_MODELS[0].value;
    }
    setHallWorkers(updated);
  };

  const maxModels = getMaxModels();
  const addModel = () => {
    if (models.length >= maxModels) return;
    const id = "model-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    setModels([...models, { id, name: "", apiKey: "" }]);
  };

  const removeModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const updateModel = (index: number, field: "name" | "alias" | "apiKey" | "modelId" | "systemPrompt" | "roomAssignment", value: string) => {
    const updated = [...models];
    updated[index] = { ...updated[index], [field]: value };
    // عند اختيار OpenRouter تلقائياً حدد أول موديل مجاني
    if (field === "name" && value === "OpenRouter" && !updated[index].modelId) {
      updated[index].modelId = OPENROUTER_MODELS[0].value;
    }
    // عند اختيار OpenCode تلقائياً حدد أول موديل مجاني (GLM-4.7-Flash)
    if (field === "name" && value === "OpenCode" && !updated[index].modelId) {
      updated[index].modelId = OPENCODE_MODELS[0].value;
    }
    if (field === "name" && value === "v0" && !updated[index].modelId) {
      updated[index].modelId = V0_MODELS[0].value;
    }
    if (field === "name" && value === "Devin") {
      updated[index].modelId = DEVIN_MODELS[0].value;
    }
    setModels(updated);
  };

  const accentColor = "#c4a44a";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "white",
    fontSize: "14px",
    outline: "none",
    direction: "ltr",
    textAlign: "left",
    fontFamily: "monospace",
  };

  const labelStyle: React.CSSProperties = {
    color: "#aaa",
    fontSize: "13px",
    marginBottom: "4px",
    direction: "rtl",
    display: "block",
  };

  const tabs = ["company", "github", "clickup", "models", "ai-worker", "instructions", "stats"] as const;
  const tabLabels: Record<string, string> = {
    company: "الشركة",
    github: "GitHub",
    clickup: "ClickUp",
    models: "Models",
    "ai-worker": "🤖 AI Workers",
    instructions: "📋 تعليمات",
    stats: "📊 إحصائيات",
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const r = await apiFetch("/api/admin/stats");
      const data = await r.json();
      setAdminStats(data);
    } catch { }
    setStatsLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: pos ? pos.x : "50%",
        top: pos ? pos.y : "50%",
        transform: pos ? "none" : "translate(-50%, -50%)",
        width: size.w,
        height: size.h,
        minWidth: 380,
        minHeight: 400,
        background: "rgba(15, 15, 25, 0.97)",
        borderRadius: "16px",
        border: `2px solid ${accentColor}`,
        fontFamily: "Inter, sans-serif",
        zIndex: 100,
        boxShadow: `0 0 40px ${accentColor}30`,
        display: "flex",
        flexDirection: "column",
        userSelect: dragRef.current || resizeRef.current ? "none" : "auto",
      }}
    >
      {/* ── HEADER (drag handle) ── */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderBottom: `1px solid ${accentColor}40`,
          cursor: "grab",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "20px" }}>🔐</div>
          <span style={{ color: "white", fontSize: "17px", fontWeight: "bold", direction: "rtl" }}>
            اعدادات الخزنة
          </span>
          <span style={{ color: "#444", fontSize: "11px", marginRight: "4px" }}>⠿</span>
        </div>
        <button
          onClick={closeVault}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            background: "none",
            border: "none",
            color: "#888",
            fontSize: "20px",
            cursor: "pointer",
            padding: "0 4px",
          }}
        >
          X
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${accentColor}20`, flexShrink: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === tab ? `${accentColor}20` : "transparent",
              border: "none",
              borderBottom: activeTab === tab ? `2px solid ${accentColor}` : "2px solid transparent",
              color: activeTab === tab ? accentColor : "#888",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1 }}>
        {activeTab === "company" ? (
          <>
            {/* ── اسم الشركة ── */}
            <div>
              <label style={labelStyle}>اسم الشركة</label>
              <input
                ref={inputRef}
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="اسم شركتك"
                style={{
                  ...inputStyle,
                  fontFamily: "'Almarai', sans-serif",
                  fontSize: "16px",
                  direction: "rtl",
                  textAlign: "right",
                }}
              />
            </div>

            {/* ── شعار الشركة (رفع ملف) ── */}
            <div>
              <label style={labelStyle}>شعار الشركة</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", direction: "rtl" }}>
                <button
                  onClick={() => logoFileRef.current?.click()}
                  style={{
                    background: "#1a1a2e",
                    border: `1px dashed ${accentColor}80`,
                    borderRadius: "8px",
                    padding: "8px 16px",
                    color: accentColor,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                  }}
                >
                  🖼️ رفع شعار
                </button>
                {companyLogo && (
                  <button
                    onClick={() => setCompanyLogo("")}
                    style={{
                      background: "#f4433620",
                      border: "1px solid #f4433640",
                      borderRadius: "6px",
                      color: "#f44336",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: "6px 12px",
                    }}
                  >
                    حذف الشعار
                  </button>
                )}
              </div>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const data = ev.target?.result as string;
                    if (data) setCompanyLogo(data);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              {companyLogo && (
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    justifyContent: "center",
                    background: "#1a1a2e",
                    borderRadius: "8px",
                    padding: "12px",
                    border: "1px solid #333",
                  }}
                >
                  <img
                    src={companyLogo}
                    alt="Company Logo"
                    style={{ maxWidth: "160px", maxHeight: "90px", objectFit: "contain" }}
                  />
                </div>
              )}
            </div>

            {/* ── فاصل ── */}
            <div style={{ borderTop: "1px solid #333", paddingTop: "4px" }} />

            {/* ── باب المدير ── */}
            <div>
              <label style={labelStyle}>كود باب المدير (4 أرقام)</label>
              <input
                type="text"
                value={managerCode}
                onChange={(e) => setManagerCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="0000"
                maxLength={4}
                style={inputStyle}
              />
            </div>

            {/* ── فاصل ── */}
            <div style={{ borderTop: "1px solid #333", paddingTop: "4px" }} />

            {/* ── رابط المشاركة ── */}
            <div>
              <label style={labelStyle}>رابط المشاركة (وضع الضيف)</label>
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "10px", direction: "rtl", textAlign: "right" }}>
                الضيف يدخل مباشرة بدون لوجين — لا يستطيع دخول الغرف
              </div>
              <button
                onClick={async () => {
                  setShareLinkLoading(true);
                  try {
                    const res = await apiFetch("/api/share-link/generate", { method: "POST" });
                    const data = await res.json();
                    if (data.token) {
                      const link = `${window.location.origin}/?guest=${data.token}`;
                      setShareLink(link);
                    }
                  } finally {
                    setShareLinkLoading(false);
                  }
                }}
                style={{
                  background: `${accentColor}15`,
                  border: `1px solid ${accentColor}40`,
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: accentColor,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                  marginBottom: shareLink ? "10px" : "0",
                }}
              >
                {shareLinkLoading ? "⏳ جارٍ التوليد..." : "🔗 توليد رابط مشاركة"}
              </button>
              {shareLink && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    readOnly
                    value={shareLink}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{
                      ...inputStyle,
                      flex: 1,
                      fontSize: "11px",
                      color: "#aaa",
                      cursor: "text",
                    }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                      setShareLinkCopied(true);
                      setTimeout(() => setShareLinkCopied(false), 2000);
                    }}
                    style={{
                      background: shareLinkCopied ? "#4ade8020" : `${accentColor}15`,
                      border: `1px solid ${shareLinkCopied ? "#4ade8060" : accentColor + "40"}`,
                      borderRadius: "8px",
                      padding: "8px 14px",
                      color: shareLinkCopied ? "#4ade80" : accentColor,
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.2s",
                    }}
                  >
                    {shareLinkCopied ? "✓ تم النسخ" : "نسخ"}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : activeTab === "github" ? (
          <>
            <div>
              <label style={labelStyle}>GitHub Token</label>
              <input
                ref={inputRef}
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="ghp_xxxxxxxxxxxx"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Owner / Organization</label>
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="my-org"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Repository</label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="my-repo"
                style={inputStyle}
              />
            </div>
          </>
        ) : activeTab === "clickup" ? (
          <>
            <div>
              <label style={labelStyle}>ClickUp API Token</label>
              <input
                ref={inputRef}
                type="password"
                value={clickupToken}
                onChange={(e) => setClickupToken(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="pk_xxxxxxxxxxxx"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>List ID</label>
              <input
                type="text"
                value={clickupListId}
                onChange={(e) => setClickupListId(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="123456789"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Assignee</label>
              <input
                type="text"
                value={clickupAssignee}
                onChange={(e) => setClickupAssignee(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="user@email.com"
                style={inputStyle}
              />
            </div>
          </>
        ) : activeTab === "models" ? (
          <>
            {/* Default Model Banner */}
            {defaultModel && (
              <div style={{
                background: `${accentColor}15`,
                border: `1px solid ${accentColor}50`,
                borderRadius: "10px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                direction: "rtl",
              }}>
                <span style={{ fontSize: "16px" }}>⭐</span>
                <div>
                  <div style={{ color: accentColor, fontSize: "12px", fontWeight: "bold" }}>الموديل الافتراضي</div>
                  <div style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>
                    {defaultModel}
                    {FREE_MODELS.includes(defaultModel) && (
                      <span style={{
                        marginRight: "8px",
                        background: "#4caf5020",
                        border: "1px solid #4caf5050",
                        borderRadius: "4px",
                        padding: "1px 6px",
                        color: "#4caf50",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}>مجاني</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ direction: "rtl", color: "#888", fontSize: "13px", marginBottom: "4px" }}>
              أضف الموديلات ومفاتيح الـ API الخاصة بها
            </div>
            {models.map((model, idx) => {
              const isDefault = model.name && model.name.toLowerCase() === defaultModel.toLowerCase();
              const isFree = FREE_MODELS.some(f => model.name.toLowerCase() === f.toLowerCase());
              return (
              <div
                key={idx}
                style={{
                  background: "#1a1a2e",
                  borderRadius: "10px",
                  padding: "14px",
                  border: isDefault ? `1px solid ${accentColor}` : "1px solid #333",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  position: "relative",
                  boxShadow: isDefault ? `0 0 10px ${accentColor}20` : "none",
                }}
              >
                {/* Delete button */}
                <button
                  onClick={() => removeModel(idx)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    background: "#f4433620",
                    border: "1px solid #f4433640",
                    borderRadius: "6px",
                    color: "#f44336",
                    fontSize: "14px",
                    cursor: "pointer",
                    width: "26px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  ✕
                </button>

                {/* Set as default button */}
                <button
                  onClick={() => setDefaultModelState(model.name || "")}
                  title={isDefault ? "الموديل الافتراضي الحالي" : "تعيين كموديل افتراضي"}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: isDefault ? `${accentColor}30` : "transparent",
                    border: isDefault ? `1px solid ${accentColor}` : "1px solid #444",
                    borderRadius: "6px",
                    color: isDefault ? accentColor : "#666",
                    fontSize: "14px",
                    cursor: isDefault ? "default" : "pointer",
                    width: "26px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    transition: "all 0.2s",
                  }}
                >
                  {isDefault ? "⭐" : "☆"}
                </button>

                <div style={{ marginTop: "4px" }}>
                  {/* Model name header with FREE badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", direction: "rtl", marginBottom: "6px" }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Model Name</label>
                    {isFree && model.name && (
                      <span style={{
                        background: "#4caf5020",
                        border: "1px solid #4caf5050",
                        borderRadius: "4px",
                        padding: "1px 6px",
                        color: "#4caf50",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}>مجاني</span>
                    )}
                    {isDefault && (
                      <span style={{
                        background: `${accentColor}20`,
                        border: `1px solid ${accentColor}50`,
                        borderRadius: "4px",
                        padding: "1px 6px",
                        color: accentColor,
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}>افتراضي</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                    {MODEL_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => updateModel(idx, "name", preset)}
                        style={{
                          background: model.name === preset ? `${accentColor}30` : "#252540",
                          border: model.name === preset ? `1px solid ${accentColor}` : "1px solid #444",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          color: model.name === preset ? accentColor : FREE_MODELS.includes(preset) ? "#4caf50" : "#ccc",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          position: "relative",
                        }}
                      >
                        {preset}
                        {FREE_MODELS.includes(preset) && (
                          <span style={{
                            position: "absolute",
                            top: "-5px",
                            right: "-5px",
                            background: "#4caf50",
                            borderRadius: "50%",
                            width: "8px",
                            height: "8px",
                            display: "block",
                          }} />
                        )}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={model.name}
                    onChange={(e) => updateModel(idx, "name", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="GPT, Claude, Grok..."
                    style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>API Key</label>
                  <input
                    type="password"
                    value={model.apiKey}
                    onChange={(e) => updateModel(idx, "apiKey", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder={model.name === "OpenRouter" ? "sk-or-xxxxxxxxxxxx" : model.name === "OpenCode" ? "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "sk-xxxxxxxxxxxx"}
                    style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                  />
                </div>


                <div>
                  <label style={labelStyle}>الاسم الظاهر (Alias)</label>
                  <input
                    type="text"
                    value={model.alias || ""}
                    onChange={(e) => updateModel(idx, "alias", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="مثال: سمير الذكي 🤖"
                    style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                  />
                </div>

                {/* الغرفة */}
                <div>
                  <label style={labelStyle}>📍 الغرفة</label>
                  <select
                    value={model.roomAssignment || "main"}
                    onChange={(e) => updateModel(idx, "roomAssignment", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}
                  >
                    {ROOM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* حقل اختيار الموديل — يظهر فقط لـ OpenRouter */}
                {model.name === "OpenRouter" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", direction: "rtl" }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>الموديل</label>
                      <button
                        onClick={() => fetchOrModels(idx, model.apiKey)}
                        disabled={orFetching[idx]}
                        style={{
                          background: orFetching[idx] ? "#333" : "#1a2a1a",
                          border: "1px solid #4caf5060",
                          borderRadius: "6px",
                          padding: "3px 10px",
                          color: orFetching[idx] ? "#666" : "#4caf50",
                          fontSize: "11px",
                          cursor: orFetching[idx] ? "not-allowed" : "pointer",
                          fontWeight: "bold",
                          transition: "all 0.15s",
                        }}
                      >
                        {orFetching[idx] ? "⏳ جاري الجلب..." : "🔄 جلب الموديلات"}
                      </button>
                      {orModels[idx] && (
                        <span style={{ fontSize: "11px" }}>
                          <span style={{ color: "#4caf50" }}>🆓 {orModels[idx].filter(m => m.isFree).length} مجاني</span>
                          <span style={{ color: "#555" }}> · </span>
                          <span style={{ color: "#60a5fa" }}>💳 {orModels[idx].filter(m => !m.isFree).length} مدفوع</span>
                        </span>
                      )}
                    </div>

                    {/* Dynamic select — shown when models are fetched */}
                    {orModels[idx] && orModels[idx].length > 0 ? (
                      <select
                        value={model.modelId || ""}
                        onChange={(e) => updateModel(idx, "modelId", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{
                          ...inputStyle,
                          fontSize: "12px",
                          padding: "8px 12px",
                          color: (() => {
                            const sel = orModels[idx]?.find(m => m.id === model.modelId);
                            if (!model.modelId) return "white";
                            return sel?.isFree ? "#4caf50" : "#60a5fa";
                          })(),
                          border: (() => {
                            const sel = orModels[idx]?.find(m => m.id === model.modelId);
                            if (!model.modelId) return "1px solid #333";
                            return sel?.isFree ? "1px solid #4caf5060" : "1px solid #60a5fa60";
                          })(),
                          cursor: "pointer",
                        }}
                      >
                        <option value="">— اختر موديل —</option>
                        <optgroup label="🆓 المجانية">
                          {orModels[idx].filter(m => m.isFree).map(m => (
                            <option key={m.id} value={m.id}>
                              🆓 {m.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="💳 المدفوعة">
                          {orModels[idx].filter(m => !m.isFree).map(m => (
                            <option key={m.id} value={m.id} style={{ color: "#60a5fa" }}>
                              💳 {m.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    ) : (
                      /* Static presets fallback */
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                        {OPENROUTER_MODELS.map((m) => (
                          <button
                            key={m.value}
                            onClick={() => updateModel(idx, "modelId", m.value)}
                            style={{
                              background: model.modelId === m.value ? `${accentColor}30` : m.label.startsWith("🆓") ? "#0d1a0d" : "#0d1220",
                              border: model.modelId === m.value ? `1px solid ${accentColor}` : m.label.startsWith("🆓") ? "1px solid #4caf5040" : "1px solid #60a5fa40",
                              borderRadius: "6px",
                              padding: "3px 9px",
                              color: model.modelId === m.value ? accentColor : m.label.startsWith("🆓") ? "#4caf50" : "#60a5fa",
                              fontSize: "11px",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Manual input always shown */}
                    <input
                      type="text"
                      value={model.modelId || ""}
                      onChange={(e) => updateModel(idx, "modelId", e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="meta-llama/llama-3.3-70b-instruct:free"
                      style={{
                        ...inputStyle,
                        fontSize: "12px",
                        padding: "7px 12px",
                        marginTop: orModels[idx] ? "6px" : "0",
                        color: model.modelId?.endsWith(":free") ? "#4caf50" : model.modelId ? "#60a5fa" : "white",
                        border: model.modelId?.endsWith(":free") ? "1px solid #4caf5060" : model.modelId ? "1px solid #60a5fa60" : "1px solid #333",
                      }}
                    />
                  </div>
                )}

                {/* حقل اختيار الموديل — يظهر فقط لـ OpenCode أو v0 */}
                {(model.name === "OpenCode" || model.name === "v0" || model.name === "Devin") && (
                  <div>
                    <label style={{ ...labelStyle, marginBottom: "6px" }}>الموديل</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                      {(model.name === "OpenCode" ? OPENCODE_MODELS : model.name === "Devin" ? DEVIN_MODELS : V0_MODELS).map((m: any) => (
                        <button
                          key={m.value}
                          onClick={() => updateModel(idx, "modelId", m.value)}
                          style={{
                            background: model.modelId === m.value ? "#a855f730" : m.free ? "#0d1a0d" : "#0d1220",
                            border: model.modelId === m.value ? "1px solid #a855f7" : m.free ? "1px solid #4caf5040" : "1px solid #a855f740",
                            borderRadius: "6px",
                            padding: "3px 9px",
                            color: model.modelId === m.value ? "#a855f7" : m.free ? "#4caf50" : "#c084fc",
                            fontSize: "11px",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="او اكتب معرف الموديل يدوي..."
                      value={model.modelId || ""}
                      onChange={(e) => updateModel(idx, "modelId", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* تعليمات خاصة بهذا الموديل */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>📋</span>
                    <span>تعليمات الموديل (System Prompt)</span>
                    {model.systemPrompt?.trim() && (
                      <span style={{
                        background: "#00ff8820",
                        border: "1px solid #00ff8840",
                        borderRadius: "4px",
                        padding: "1px 6px",
                        color: "#00ff88",
                        fontSize: "10px",
                        fontWeight: "bold",
                      }}>✓ مُفعّل</span>
                    )}
                  </label>
                  <textarea
                    value={model.systemPrompt || ""}
                    onChange={(e) => updateModel(idx, "systemPrompt", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder={`أنت ${model.name || "مساعد"} متخصص في...\nأجب دائماً باللغة العربية...\nركز على...`}
                    rows={3}
                    style={{
                      ...inputStyle,
                      fontSize: "12px",
                      padding: "8px 12px",
                      resize: "vertical",
                      lineHeight: "1.5",
                      minHeight: "64px",
                    }}
                  />
                </div>
              </div>
              );
            })}
            <button
              onClick={addModel}
              disabled={models.length >= maxModels}
              style={{
                background: models.length >= maxModels ? "#333" : `${accentColor}15`,
                border: `1px dashed ${models.length >= maxModels ? "#555" : accentColor + "60"}`,
                borderRadius: "10px",
                padding: "12px",
                color: models.length >= maxModels ? "#777" : accentColor,
                fontSize: "14px",
                cursor: models.length >= maxModels ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                direction: "rtl",
              }}
            >
              {models.length >= maxModels ? `الحد الاقصى ${maxModels} موديلات` : "+ اضافة موديل"}
            </button>

            {/* Free models legend */}
            <div style={{
              background: "#0d1a0d",
              border: "1px solid #4caf5030",
              borderRadius: "8px",
              padding: "8px 12px",
              direction: "rtl",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}>
              <span style={{ fontSize: "14px", marginTop: "1px" }}>🟢</span>
              <div>
                <div style={{ color: "#4caf50", fontSize: "12px", fontWeight: "bold", marginBottom: "2px" }}>موديلات مجانية</div>
                <div style={{ color: "#888", fontSize: "11px", lineHeight: "1.5" }}>
                  <strong style={{ color: "#4caf50" }}>Groq</strong> (Llama) · <strong style={{ color: "#4caf50" }}>Gemini</strong> (Flash) · <strong style={{ color: "#4caf50" }}>GLM</strong> (Flash)
                  &nbsp;— تدعم API مجانية. اضغط ⭐ لتعيين الموديل الافتراضي.
                </div>
              </div>
            </div>

            {/* OpenRouter hint */}
            <div style={{
              background: "#0d0d1a",
              border: "1px solid #7c3aed30",
              borderRadius: "8px",
              padding: "8px 12px",
              direction: "rtl",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}>
              <span style={{ fontSize: "14px", marginTop: "1px" }}>🔀</span>
              <div>
                <div style={{ color: "#a78bfa", fontSize: "12px", fontWeight: "bold", marginBottom: "2px" }}>OpenRouter</div>
                <div style={{ color: "#888", fontSize: "11px", lineHeight: "1.5" }}>
                  مفتاح API واحد يوصل لـ Claude · GPT · Gemini · DeepSeek وغيرهم.
                  سجّل على <strong style={{ color: "#a78bfa" }}>openrouter.ai</strong> واحصل على key يبدأ بـ <code style={{ color: "#a78bfa" }}>sk-or-</code>
                </div>
              </div>
            </div>

            {/* OpenCode hint */}
            <div style={{
              background: "#0d0a1a",
              border: "1px solid #a855f730",
              borderRadius: "8px",
              padding: "8px 12px",
              direction: "rtl",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}>
              <span style={{ fontSize: "14px", marginTop: "1px" }}>🧠</span>
              <div>
                <div style={{ color: "#a855f7", fontSize: "12px", fontWeight: "bold", marginBottom: "2px" }}>OpenCode — ZhipuAI GLM</div>
                <div style={{ color: "#888", fontSize: "11px", lineHeight: "1.5" }}>
                  موديلات GLM الصينية من ZhipuAI — <strong style={{ color: "#4caf50" }}>GLM-4.7-Flash</strong> و <strong style={{ color: "#4caf50" }}>GLM-4.5-Flash</strong> مجانية محدودة الوقت.
                  سجّل على <strong style={{ color: "#a855f7" }}>open.bigmodel.cn</strong> واحصل على API key من لوحة التحكم.
                </div>
              </div>
            </div>
          </>
        ) : activeTab === "ai-worker" ? (
          <>
            {/* Info banner */}
            <div style={{
              background: "#0d0d1a",
              border: "1px solid #6366f130",
              borderRadius: "8px",
              padding: "10px 14px",
              direction: "rtl",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}>
              <span style={{ fontSize: "16px" }}>🤖</span>
              <div>
                <div style={{ color: "#818cf8", fontSize: "12px", fontWeight: "bold", marginBottom: "2px" }}>عمال الذكاء الاصطناعي في الصالة</div>
                <div style={{ color: "#888", fontSize: "11px", lineHeight: "1.6" }}>
                  أضف حتى <strong style={{ color: "#818cf8" }}>7 روبوتات</strong> تظهر مباشرة داخل الصالة الخلفية ويمكن التحدث معها.
                  نفس إعدادات الموديل — اسم، API Key، وتعليمات خاصة.
                </div>
              </div>
            </div>

            <div style={{ direction: "rtl", color: "#888", fontSize: "13px", marginBottom: "4px" }}>
              أضف عمال الذكاء الاصطناعي — يظهرون كروبوتات في الصالة الخلفية
            </div>

            {hallWorkers.map((worker, idx) => (
              <div
                key={idx}
                style={{
                  background: "#0f0f1e",
                  borderRadius: "10px",
                  padding: "14px",
                  border: "1px solid #6366f140",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  position: "relative",
                }}
              >
                {/* Index badge */}
                <div style={{
                  position: "absolute",
                  top: "8px",
                  left: "40px",
                  background: "#6366f120",
                  border: "1px solid #6366f140",
                  borderRadius: "6px",
                  padding: "1px 8px",
                  color: "#818cf8",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}>#{idx + 1}</div>

                {/* Delete button */}
                <button
                  onClick={() => removeHallWorker(idx)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    background: "#f4433620",
                    border: "1px solid #f4433640",
                    borderRadius: "6px",
                    color: "#f44336",
                    fontSize: "14px",
                    cursor: "pointer",
                    width: "26px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >✕</button>

                <div style={{ marginTop: "4px" }}>
                  <label style={{ ...labelStyle, marginBottom: "6px" }}>Model Name</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                    {MODEL_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => updateHallWorker(idx, "name", preset)}
                        style={{
                          background: worker.name === preset ? "#6366f130" : "#252540",
                          border: worker.name === preset ? "1px solid #6366f1" : "1px solid #444",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          color: worker.name === preset ? "#818cf8" : FREE_MODELS.includes(preset) ? "#4caf50" : "#ccc",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          position: "relative",
                        }}
                      >
                        {preset}
                        {FREE_MODELS.includes(preset) && (
                          <span style={{
                            position: "absolute", top: "-5px", right: "-5px",
                            background: "#4caf50", borderRadius: "50%",
                            width: "8px", height: "8px", display: "block",
                          }} />
                        )}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={worker.name}
                    onChange={(e) => updateHallWorker(idx, "name", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="GPT, Claude, Grok..."
                    style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>API Key</label>
                  <input
                    type="password"
                    value={worker.apiKey}
                    onChange={(e) => updateHallWorker(idx, "apiKey", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder={worker.name === "OpenRouter" ? "sk-or-xxxxxxxxxxxx" : worker.name === "OpenCode" ? "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "sk-xxxxxxxxxxxx"}
                    style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                  />
                </div>


                <div>
                  <label style={labelStyle}>الاسم الظاهر (Alias)</label>
                  <input
                    type="text"
                    value={worker.alias || ""}
                    onChange={(e) => updateHallWorker(idx, "alias", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="مثال: سمير الذكي 🤖"
                    style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                  />
                </div>

                {/* OpenRouter model picker */}
                {worker.name === "OpenRouter" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", direction: "rtl" }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>الموديل</label>
                      <button
                        onClick={() => fetchHwOrModels(idx, worker.apiKey)}
                        disabled={hwOrFetching[idx]}
                        style={{
                          background: hwOrFetching[idx] ? "#333" : "#1a2a1a",
                          border: "1px solid #4caf5060",
                          borderRadius: "6px",
                          padding: "3px 10px",
                          color: hwOrFetching[idx] ? "#666" : "#4caf50",
                          fontSize: "11px",
                          cursor: hwOrFetching[idx] ? "not-allowed" : "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        {hwOrFetching[idx] ? "⏳ جاري الجلب..." : "🔄 جلب الموديلات"}
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                      {OPENROUTER_MODELS.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => updateHallWorker(idx, "modelId", m.value)}
                          style={{
                            background: worker.modelId === m.value ? "#6366f130" : m.label.startsWith("🆓") ? "#0d1a0d" : "#0d1220",
                            border: worker.modelId === m.value ? "1px solid #6366f1" : m.label.startsWith("🆓") ? "1px solid #4caf5040" : "1px solid #60a5fa40",
                            borderRadius: "6px",
                            padding: "3px 9px",
                            color: worker.modelId === m.value ? "#818cf8" : m.label.startsWith("🆓") ? "#4caf50" : "#60a5fa",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >{m.label}</button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={worker.modelId || ""}
                      onChange={(e) => updateHallWorker(idx, "modelId", e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="meta-llama/llama-3.3-70b-instruct:free"
                      style={{ ...inputStyle, fontSize: "12px", padding: "7px 12px" }}
                    />
                  </div>
                )}

                {/* OpenCode model picker */}
                {(worker.name === "OpenCode" || worker.name === "Devin") && (
                  <div>
                    <label style={{ ...labelStyle, marginBottom: "6px" }}>الموديل</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                      {(worker.name === "Devin" ? DEVIN_MODELS : OPENCODE_MODELS).map((m) => (
                        <button
                          key={m.value}
                          onClick={() => updateHallWorker(idx, "modelId", m.value)}
                          style={{
                            background: worker.modelId === m.value ? "#a855f730" : m.free ? "#0d1a0d" : "#0d1220",
                            border: worker.modelId === m.value ? "1px solid #a855f7" : m.free ? "1px solid #4caf5040" : "1px solid #a855f740",
                            borderRadius: "6px",
                            padding: "3px 9px",
                            color: worker.modelId === m.value ? "#a855f7" : m.free ? "#4caf50" : "#c084fc",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >{m.label}</button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={worker.modelId || ""}
                      onChange={(e) => updateHallWorker(idx, "modelId", e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="glm-4.7-flash"
                      style={{ ...inputStyle, fontSize: "12px", padding: "7px 12px" }}
                    />
                  </div>
                )}

                {/* System prompt */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>📋</span>
                    <span>تعليمات العامل (System Prompt)</span>
                    {worker.systemPrompt?.trim() && (
                      <span style={{
                        background: "#00ff8820", border: "1px solid #00ff8840",
                        borderRadius: "4px", padding: "1px 6px",
                        color: "#00ff88", fontSize: "10px", fontWeight: "bold",
                      }}>✓ مُفعّل</span>
                    )}
                  </label>
                  <textarea
                    value={worker.systemPrompt || ""}
                    onChange={(e) => updateHallWorker(idx, "systemPrompt", e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder={`أنت ${worker.name || "عامل"} متخصص في...\nأجب دائماً باللغة العربية...`}
                    rows={3}
                    style={{ ...inputStyle, fontSize: "12px", padding: "8px 12px", resize: "vertical", lineHeight: "1.5", minHeight: "64px" }}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addHallWorker}
              disabled={hallWorkers.length >= maxHallWorkers}
              style={{
                background: hallWorkers.length >= maxHallWorkers ? "#333" : "#6366f115",
                border: `1px dashed ${hallWorkers.length >= maxHallWorkers ? "#555" : "#6366f160"}`,
                borderRadius: "10px",
                padding: "12px",
                color: hallWorkers.length >= maxHallWorkers ? "#777" : "#818cf8",
                fontSize: "14px",
                cursor: hallWorkers.length >= maxHallWorkers ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                direction: "rtl",
              }}
            >
              {hallWorkers.length >= maxHallWorkers
                ? `الحد الاقصى ${maxHallWorkers} عمال`
                : `+ اضافة عامل (${hallWorkers.length}/${maxHallWorkers})`}
            </button>
          </>
        ) : activeTab === "instructions" ? (
          <>
            {/* Info banner */}
            <div style={{
              background: "#0d1a0d",
              border: "1px solid #00ff8830",
              borderRadius: "8px",
              padding: "10px 14px",
              direction: "rtl",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}>
              <span style={{ fontSize: "16px" }}>💡</span>
              <div>
                <div style={{ color: "#00ff88", fontSize: "12px", fontWeight: "bold", marginBottom: "2px" }}>System Prompt (تعليمات مسبقة)</div>
                <div style={{ color: "#888", fontSize: "11px", lineHeight: "1.6" }}>
                  هذه التعليمات تُرسل للموديل كـ <code style={{ color: "#00ff88" }}>system message</code> قبل كل محادثة.
                  استخدمها لتحديد شخصية المساعد، لغة الرد، أو قواعد خاصة بشركتك.
                </div>
              </div>
            </div>

            {/* File upload button */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", direction: "rtl" }}>
              <span style={{ color: "#aaa", fontSize: "13px" }}>أو ارفع ملف نصي:</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "#1a1a2e",
                  border: "1px dashed #c4a44a80",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: accentColor,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                }}
              >
                📄 رفع ملف .txt / .md
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.text"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const content = ev.target?.result as string;
                    if (content) setSystemPrompt(content);
                  };
                  reader.readAsText(file, "utf-8");
                  e.target.value = "";
                }}
              />
              {systemPrompt && (
                <button
                  onClick={() => setSystemPrompt("")}
                  style={{
                    background: "#f4433620",
                    border: "1px solid #f4433640",
                    borderRadius: "6px",
                    color: "#f44336",
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: "6px 12px",
                  }}
                >
                  مسح
                </button>
              )}
            </div>

            {/* Textarea */}
            <div>
              <label style={{ ...labelStyle, marginBottom: "6px" }}>
                التعليمات
                {systemPrompt && (
                  <span style={{ color: "#666", fontSize: "11px", marginRight: "8px" }}>
                    ({systemPrompt.length} حرف)
                  </span>
                )}
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={`مثال:\nأنت مساعد ذكي لشركة [اسم الشركة]. ردودك باللغة العربية فقط.\nكن محترفاً وموجزاً في إجاباتك.\nتخصصك في إدارة المشاريع والبرمجة.`}
                style={{
                  ...inputStyle,
                  height: "240px",
                  resize: "vertical",
                  fontSize: "13px",
                  padding: "12px 14px",
                  fontFamily: "monospace",
                  lineHeight: "1.6",
                  direction: "rtl",
                  textAlign: "right",
                }}
              />
            </div>

            {/* Quick templates */}
            <div>
              <label style={{ ...labelStyle, marginBottom: "6px" }}>قوالب جاهزة</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  { label: "🤖 مساعد برمجة", text: "أنت مساعد برمجي متخصص. ردودك باللغة العربية ما أمكن. ساعد في الكود والأخطاء والمعمارية. كن دقيقاً وموجزاً." },
                  { label: "📋 مدير مشاريع", text: "أنت مساعد إدارة مشاريع. تساعد في تنظيم المهام وتتبع التقدم وتحديد الأولويات. ردودك منظمة وعملية." },
                  { label: "🌐 ثنائي اللغة", text: "You are a bilingual assistant. Always respond in both Arabic and English. Be professional and concise." },
                ].map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => setSystemPrompt(tpl.text)}
                    style={{
                      background: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      color: "#ccc",
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "right",
                      direction: "rtl",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = accentColor + "80")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
                  >
                    {tpl.label} — <span style={{ color: "#666" }}>{tpl.text.substring(0, 50)}...</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : activeTab === "stats" ? (
          <>
            {/* Header + refresh */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
              <span style={{ color: "#aaa", fontSize: "13px" }}>إجمالي المستخدمين والموديلات</span>
              <button
                onClick={loadStats}
                disabled={statsLoading}
                style={{
                  background: `${accentColor}20`,
                  border: `1px solid ${accentColor}60`,
                  borderRadius: "8px",
                  padding: "6px 14px",
                  color: accentColor,
                  fontSize: "13px",
                  cursor: statsLoading ? "not-allowed" : "pointer",
                  opacity: statsLoading ? 0.6 : 1,
                }}
              >
                {statsLoading ? "جاري التحميل..." : "تحديث"}
              </button>
            </div>

            {!adminStats && !statsLoading && (
              <div style={{ textAlign: "center", color: "#555", fontSize: "13px", padding: "20px", direction: "rtl" }}>
                اضغط "تحديث" لتحميل الإحصائيات
              </div>
            )}

            {adminStats && (
              <>
                {/* Summary cards */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{
                    flex: 1, background: "#0d1a2e", border: "1px solid #4fc3f730",
                    borderRadius: "10px", padding: "12px", textAlign: "center",
                  }}>
                    <div style={{ color: "#4fc3f7", fontSize: "28px", fontWeight: "bold" }}>{adminStats.totalUsers}</div>
                    <div style={{ color: "#888", fontSize: "12px", direction: "rtl" }}>مستخدم مسجّل</div>
                  </div>
                  <div style={{
                    flex: 1, background: "#0d1a0d", border: "1px solid #00ff8830",
                    borderRadius: "10px", padding: "12px", textAlign: "center",
                  }}>
                    <div style={{ color: "#00ff88", fontSize: "28px", fontWeight: "bold" }}>{adminStats.totalModels}</div>
                    <div style={{ color: "#888", fontSize: "12px", direction: "rtl" }}>موديل مجموع</div>
                  </div>
                </div>

                {/* User rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {adminStats.users.map((u) => (
                    <div key={u.id} style={{
                      background: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      direction: "rtl",
                    }}>
                      {/* Row header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div>
                          <span style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>
                            {u.username}
                          </span>
                          {u.companyName && (
                            <span style={{ color: "#888", fontSize: "12px", marginRight: "8px" }}>
                              — {u.companyName}
                            </span>
                          )}
                        </div>
                        <div style={{
                          background: u.modelCount > 0 ? "#00ff8820" : "#ff444420",
                          border: `1px solid ${u.modelCount > 0 ? "#00ff8840" : "#ff444440"}`,
                          borderRadius: "20px",
                          padding: "2px 10px",
                          color: u.modelCount > 0 ? "#00ff88" : "#ff4444",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}>
                          {u.modelCount} موديل
                        </div>
                      </div>

                      {/* Model chips */}
                      {u.models.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                          {u.models.map((m, i) => (
                            <span key={i} style={{
                              background: m.hasKey ? "#1a2e1a" : "#2e1a1a",
                              border: `1px solid ${m.hasKey ? "#00ff8830" : "#ff444430"}`,
                              borderRadius: "6px",
                              padding: "2px 8px",
                              color: m.hasKey ? "#00ff88" : "#ff6666",
                              fontSize: "11px",
                            }}>
                              {m.name}{m.modelId ? ` (${m.modelId.split("/").pop()})` : ""}
                              {m.hasKey ? " ✓" : " ✗"}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Badges row */}
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {u.defaultModel && (
                          <span style={{ fontSize: "10px", color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}30`, borderRadius: "4px", padding: "1px 6px" }}>
                            ⭐ {u.defaultModel}
                          </span>
                        )}
                        {u.hasGitHub && <span style={{ fontSize: "10px", color: "#ccc", background: "#33333330", border: "1px solid #44444440", borderRadius: "4px", padding: "1px 6px" }}>GitHub ✓</span>}
                        {u.hasClickUp && <span style={{ fontSize: "10px", color: "#7c3aed", background: "#7c3aed15", border: "1px solid #7c3aed30", borderRadius: "4px", padding: "1px 6px" }}>ClickUp ✓</span>}
                        {u.hasSystemPrompt && <span style={{ fontSize: "10px", color: "#4fc3f7", background: "#4fc3f715", border: "1px solid #4fc3f730", borderRadius: "4px", padding: "1px 6px" }}>📋 تعليمات</span>}
                        <span style={{ fontSize: "10px", color: "#555", marginRight: "auto" }}>
                          {u.roomId.substring(0, 20)}...
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>

      <div
        style={{
          padding: "14px 18px",
          borderTop: `1px solid ${accentColor}20`,
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
        }}
      >
        {saved && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
            <span style={{ color: "#4caf50", fontSize: "14px", direction: "rtl" }}>✓ تم الحفظ</span>
            {savedHint && (
              <span style={{ color: "#a0cfff", fontSize: "11px", direction: "rtl", fontFamily: "monospace" }}>
                📍 {savedHint}
              </span>
            )}
          </div>
        )}
        {testResult && (
          <div style={{ display: "flex", gap: "8px", alignSelf: "center", direction: "rtl", fontSize: "12px" }}>
            <span style={{ color: testResult.github?.connected ? "#4caf50" : "#f44336" }}>
              GitHub: {testResult.github?.connected ? `متصل (${testResult.github.user})` : "غير متصل"}
            </span>
            <span style={{ color: testResult.clickup?.connected ? "#4caf50" : "#f44336" }}>
              ClickUp: {testResult.clickup?.connected ? `متصل (${testResult.clickup.workspace})` : `غير متصل${testResult.clickup?.error ? ` — ${testResult.clickup.error}` : ""}`}
            </span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            background: "#2a4a6e",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            color: "white",
            fontSize: "13px",
            cursor: testing ? "not-allowed" : "pointer",
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? "..." : "اختبار"}
        </button>
        <button
          onClick={closeVault}
          style={{
            background: "#333",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            color: "white",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          اغلاق
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: accentColor,
            border: "none",
            borderRadius: "8px",
            padding: "10px 24px",
            color: "#1a1a2e",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "..." : "حفظ"}
        </button>
      </div>

      {/* ── RESIZE HANDLE (bottom-right corner) ── */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: "18px",
          height: "18px",
          cursor: "nwse-resize",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          padding: "3px",
          borderBottomRightRadius: "14px",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M9 1L1 9M9 5L5 9M9 9H9" stroke="#c4a44a" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}
