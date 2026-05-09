import { useState, useEffect, useRef } from "react";

interface FileInfo     { name: string; size: number; mtime: string; }
interface GoogleStatus { calendar: boolean; gmail: boolean; }
interface WallImageInfo{ exists: boolean; url?: string; filename?: string; }

const MODELS = [
  "gpt-4o-mini", "gpt-4o", "gpt-4-turbo",
  "claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7",
];

type Tab = "ai" | "files" | "wall" | "google";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "ai",     label: "المساعد",  icon: "🤖" },
  { id: "files",  label: "الملفات",  icon: "📄" },
  { id: "wall",   label: "الجدار",   icon: "🖼️" },
  { id: "google", label: "Google",   icon: "🔗" },
];

export default function SettingsPage() {
  const [tab,          setTab]          = useState<Tab>("ai");
  const [apiKey,       setApiKey]       = useState("");
  const [model,        setModel]        = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [geminiKey,    setGeminiKey]    = useState("");
  const [files,        setFiles]        = useState<FileInfo[]>([]);
  const [google,       setGoogle]       = useState<GoogleStatus>({ calendar: false, gmail: false });
  const [wallImage,    setWallImage]    = useState<WallImageInfo>({ exists: false });
  const [wallUploading,setWallUploading]= useState(false);
  const [saving,       setSaving]       = useState(false);
  const [savedMsg,     setSavedMsg]     = useState("");
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(s => {
      if (s.apiKey)       setApiKey(s.apiKey);
      if (s.model)        setModel(s.model);
      if (s.systemPrompt) setSystemPrompt(s.systemPrompt);
      if (s.geminiKey)    setGeminiKey(s.geminiKey);
    });
    fetchFiles();
    fetchGoogleStatus();
    fetchWallImage();
    const handler = (e: MessageEvent) => {
      if (typeof e.data === "string" && e.data.startsWith("google_connected_")) fetchGoogleStatus();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  function fetchFiles()       { fetch("/api/files").then(r=>r.json()).then(setFiles); }
  function fetchGoogleStatus(){ fetch("/api/google/status").then(r=>r.json()).then(setGoogle); }
  function fetchWallImage()   { fetch("/api/wall-image").then(r=>r.json()).then(setWallImage); }

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model, systemPrompt, geminiKey }),
    });
    setSaving(false); setSavedMsg("✅ تم الحفظ");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const form = new FormData();
    Array.from(fileList).forEach(f => form.append("files", f));
    await fetch("/api/files", { method: "POST", body: form });
    fetchFiles(); setUploading(false);
  }

  async function deleteFile(name: string) {
    await fetch(`/api/files/${encodeURIComponent(name)}`, { method: "DELETE" });
    fetchFiles();
  }

  async function uploadWallImage(file: File | null) {
    if (!file) return;
    setWallUploading(true);
    const form = new FormData();
    form.append("image", file);
    await fetch("/api/wall-image", { method: "POST", body: form });
    await fetchWallImage(); setWallUploading(false);
    if (wallImageRef.current) wallImageRef.current.value = "";
  }

  async function deleteWallImage() {
    await fetch("/api/wall-image", { method: "DELETE" });
    fetchWallImage();
  }

  function connectGoogle(scope: "calendar" | "gmail") {
    window.open(`/api/google/auth?scope=${scope}`, "google_oauth", "width=520,height=640,top=100,left=200");
  }
  async function disconnectGoogle(scope: "calendar" | "gmail") {
    await fetch("/api/google/disconnect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    fetchGoogleStatus();
  }

  function fmtSize(b: number) {
    if (b < 1024) return b + " B";
    if (b < 1024*1024) return (b/1024).toFixed(1) + " KB";
    return (b/1024/1024).toFixed(1) + " MB";
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f5f2ee", fontFamily:"system-ui,-apple-system,sans-serif", direction:"rtl" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background:"#fff", borderBottom:"1px solid #ede9e4",
        position:"sticky", top:0, zIndex:20,
      }}>
        {/* العنوان */}
        <div style={{ padding:"14px 24px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid #f0ece6" }}>
          <a href="/" style={{ textDecoration:"none", color:"#888", fontSize:13 }}>← المكتب</a>
          <span style={{ color:"#ddd" }}>|</span>
          <span style={{ fontWeight:700, fontSize:15, color:"#1a1a1a" }}>⚙️ الإعدادات</span>
        </div>

        {/* التبويبات */}
        <div style={{ display:"flex", padding:"0 16px" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "11px 4px",
                background: "none",
                border: "none",
                borderBottom: tab === t.id ? "2.5px solid #1a73e8" : "2.5px solid transparent",
                color: tab === t.id ? "#1a73e8" : "#777",
                fontWeight: tab === t.id ? 700 : 400,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "system-ui",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── محتوى التبويبات ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth:620, margin:"0 auto", padding:"24px 16px" }}>

        {/* ── تبويب: المساعد ──────────────────────────────────────────────── */}
        {tab === "ai" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Section label="🔑 API Key (OpenAI أو Anthropic)">
              <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)}
                placeholder="sk-... أو sk-ant-..." style={inp} />
            </Section>

            <Section label="🧠 الموديل">
              <input list="models" value={model} onChange={e=>setModel(e.target.value)} style={inp} />
              <datalist id="models">{MODELS.map(m=><option key={m} value={m}/>)}</datalist>
            </Section>

            <Section label="🎤 Gemini API Key (للمحادثة الصوتية)">
              <input type="password" value={geminiKey} onChange={e=>setGeminiKey(e.target.value)}
                placeholder="AIza..." style={{ ...inp, direction:"ltr" }} />
              <span style={{ fontSize:11, color:"#aaa", marginTop:2 }}>
                احصل عليه من{" "}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color:"#1a73e8" }}>
                  Google AI Studio
                </a>
              </span>
            </Section>

            <Section label="📝 تعليمات الروبوت (System Prompt)">
              <textarea value={systemPrompt} onChange={e=>setSystemPrompt(e.target.value)} rows={7}
                placeholder="مثال: أنت مساعد طبي محترف، تجاوب باللغة العربية الفصحى..."
                style={{ ...inp, resize:"vertical", lineHeight:1.65 }} />
            </Section>

            {/* زر الحفظ */}
            <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:4 }}>
              <button onClick={save} disabled={saving} style={{
                flex:1, background: saving?"#aaa":"#1a73e8", color:"#fff",
                border:"none", borderRadius:12, padding:"13px",
                fontSize:14, fontWeight:700, cursor: saving?"default":"pointer", fontFamily:"system-ui",
              }}>
                {saving ? "⏳ جاري الحفظ..." : "💾 حفظ الإعدادات"}
              </button>
              {savedMsg && <span style={{ color:"#27ae60", fontWeight:600, fontSize:13 }}>{savedMsg}</span>}
            </div>
          </div>
        )}

        {/* ── تبويب: الملفات ──────────────────────────────────────────────── */}
        {tab === "files" && (
          <div>
            <p style={{ color:"#888", fontSize:12.5, margin:"0 0 16px" }}>
              ملفات يقرأها المساعد كمعلومات إضافية · TXT · MD · PDF · JSON · CSV · حد أقصى 3 ملفات
            </p>

            {/* قائمة الملفات */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
              {files.map(f => (
                <div key={f.name} style={{
                  background:"#fff", border:"1px solid #ede9e4", borderRadius:12,
                  padding:"11px 14px", display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>
                      {f.name.endsWith(".pdf")?"📕":f.name.endsWith(".json")?"🗂️":"📄"}
                    </span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#1a1a1a", wordBreak:"break-all" }}>
                        {f.name.replace(/^\d+_/,"")}
                      </div>
                      <div style={{ fontSize:11, color:"#aaa" }}>{fmtSize(f.size)}</div>
                    </div>
                  </div>
                  <button onClick={()=>deleteFile(f.name)}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#e74c3c", fontSize:20 }}
                    title="حذف">🗑</button>
                </div>
              ))}
            </div>

            {files.length < 3 ? (
              <>
                <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.pdf,.json,.csv"
                  style={{ display:"none" }} onChange={e=>uploadFiles(e.target.files)} />
                <button onClick={()=>fileInputRef.current?.click()} disabled={uploading} style={dashedBtn(uploading)}>
                  {uploading ? "⏳ جاري الرفع..." : `📎 اختر ملفاً (${3-files.length} متبقي)`}
                </button>
              </>
            ) : (
              <p style={{ color:"#e74c3c", fontSize:12.5, textAlign:"center", margin:"8px 0 0" }}>
                وصلت للحد الأقصى — احذف ملفاً لرفع آخر
              </p>
            )}
          </div>
        )}

        {/* ── تبويب: الجدار ───────────────────────────────────────────────── */}
        {tab === "wall" && (
          <div>
            <p style={{ color:"#888", fontSize:12.5, margin:"0 0 18px" }}>
              ارفع صورة تظهر كبرواز كبير على الجدار الخلفي في المكتب ثلاثي الأبعاد
            </p>

            {wallImage.exists && wallImage.url ? (
              <div>
                <div style={{
                  borderRadius:14, overflow:"hidden", border:"1px solid #ede9e4",
                  marginBottom:12, background:"#f5f2ee",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  minHeight:160,
                }}>
                  <img src={wallImage.url+"?t="+Date.now()} alt="صورة الجدار"
                    style={{ maxWidth:"100%", maxHeight:280, objectFit:"contain", display:"block" }} />
                </div>
                {/* استبدال / حذف */}
                <div style={{ display:"flex", gap:10 }}>
                  <>
                    <input ref={wallImageRef} type="file" accept="image/*"
                      style={{ display:"none" }} onChange={e=>uploadWallImage(e.target.files?.[0]||null)} />
                    <button onClick={()=>wallImageRef.current?.click()} disabled={wallUploading}
                      style={{ flex:1, ...outlineBtn("#1a73e8") }}>
                      {wallUploading?"⏳ جاري...":"🔄 استبدال الصورة"}
                    </button>
                  </>
                  <button onClick={deleteWallImage} style={{ flex:1, ...outlineBtn("#e74c3c") }}>
                    🗑 حذف
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input ref={wallImageRef} type="file" accept="image/*"
                  style={{ display:"none" }} onChange={e=>uploadWallImage(e.target.files?.[0]||null)} />
                <button onClick={()=>wallImageRef.current?.click()} disabled={wallUploading} style={dashedBtn(wallUploading)}>
                  {wallUploading?"⏳ جاري الرفع...":"🖼️ اختر صورة (JPG · PNG · WEBP)"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── تبويب: Google ───────────────────────────────────────────────── */}
        {tab === "google" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <p style={{ color:"#888", fontSize:12.5, margin:"0 0 4px" }}>
              اربط حسابك لتمكين المساعد من قراءة تقويمك وبريدك والكتابة فيهما
            </p>

            {/* Google Calendar */}
            <div style={googleCard}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:28 }}>📅</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1a1a1a" }}>Google Calendar</div>
                  <div style={{ fontSize:11.5, color: google.calendar?"#27ae60":"#aaa", marginTop:2 }}>
                    {google.calendar ? "● مرتبط — قراءة وكتابة" : "○ غير مرتبط"}
                  </div>
                </div>
              </div>
              <button
                onClick={()=>google.calendar?disconnectGoogle("calendar"):connectGoogle("calendar")}
                style={google.calendar ? btnRed : btnGreen}>
                {google.calendar?"فصل":"ربط"}
              </button>
            </div>

            {/* Gmail */}
            <div style={googleCard}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:28 }}>📧</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1a1a1a" }}>Gmail</div>
                  <div style={{ fontSize:11.5, color: google.gmail?"#27ae60":"#aaa", marginTop:2 }}>
                    {google.gmail ? "● مرتبط — قراءة وإرسال" : "○ غير مرتبط"}
                  </div>
                </div>
              </div>
              <button
                onClick={()=>google.gmail?disconnectGoogle("gmail"):connectGoogle("gmail")}
                style={google.gmail ? btnRed : btnGreen}>
                {google.gmail?"فصل":"ربط"}
              </button>
            </div>

            {/* ملاحظة */}
            {(google.calendar || google.gmail) && (
              <div style={{
                background:"#e8f5e9", border:"1px solid #a5d6a7", borderRadius:10,
                padding:"10px 14px", fontSize:12, color:"#2e7d32", marginTop:4,
              }}>
                ✅ المساعد الصوتي يقرأ بياناتك تلقائياً عند كل محادثة جديدة
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── مكونات مساعدة ─────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, padding:"16px 18px", boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize:12.5, fontWeight:600, color:"#555", marginBottom:10 }}>{label}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>{children}</div>
    </div>
  );
}

const inp: React.CSSProperties = {
  border:"1px solid #ddd8d0", borderRadius:8, padding:"9px 12px",
  fontSize:13.5, outline:"none", background:"#faf8f5",
  width:"100%", boxSizing:"border-box",
};

function dashedBtn(disabled: boolean): React.CSSProperties {
  return {
    width:"100%", padding:"18px", border:"2px dashed #d0ccc6",
    borderRadius:14, background: disabled?"#f5f2ee":"#fff",
    cursor: disabled?"default":"pointer", color:"#888", fontSize:13,
    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
    fontFamily:"system-ui",
  };
}

function outlineBtn(color: string): React.CSSProperties {
  return {
    padding:"9px 14px", background:"#fff", border:`1px solid ${color}`,
    borderRadius:10, color, fontSize:13, cursor:"pointer", fontFamily:"system-ui",
    fontWeight:600,
  };
}

const googleCard: React.CSSProperties = {
  background:"#fff", border:"1px solid #ede9e4", borderRadius:14,
  padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between",
};

const btnGreen: React.CSSProperties = {
  background:"#27ae60", color:"#fff", border:"none", borderRadius:8,
  padding:"8px 20px", fontSize:13, cursor:"pointer", fontFamily:"system-ui", fontWeight:600,
};

const btnRed: React.CSSProperties = {
  background:"#e74c3c", color:"#fff", border:"none", borderRadius:8,
  padding:"8px 20px", fontSize:13, cursor:"pointer", fontFamily:"system-ui", fontWeight:600,
};
