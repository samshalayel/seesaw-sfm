/**
 * TopRightPanel.tsx
 * شريط أيقونات موحد في الزاوية العلوية اليمنى
 * يستبدل: VaultButton + GameUI card + AutoTriggerPanel
 */
import { useState, useEffect } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useChat } from "@/lib/stores/useChat";
import { apiFetch } from "@/lib/utils";

/* ─── Types ────────────────────────────────────────────────────── */
interface TriggerConfig {
  enabled: boolean; watchUserId: number | null;
  watchStatuses: string[]; intervalMinutes: number;
  robotId: string; doneStatus: string;
}
interface TriggerLog {
  id: string; taskId: string; taskName: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string; toolsUsed: string[]; startedAt: number;
  completedAt: number | null; error: string | null;
}
interface Member { id: number; username: string; email: string; }

/* ─── Icon button (matches CameraButtons style exactly) ─────────── */
function IBtn({
  icon, label, active, onClick, badge, glowColor,
}: {
  icon: string; label: string; active: boolean;
  onClick: () => void; badge?: number; glowColor?: string;
}) {
  return (
    <button onClick={onClick} title={label} style={{
      width: "42px", height: "42px", borderRadius: "10px",
      border: active ? "2px solid #00aaff" : "1.5px solid #334",
      background: active ? "rgba(0,120,255,0.22)" : "rgba(10,12,20,0.75)",
      color: active ? "#00ccff" : "#8899aa",
      cursor: "pointer", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      lineHeight: 1, gap: "2px", backdropFilter: "blur(6px)",
      boxShadow: glowColor ? `0 0 10px ${glowColor}` : active ? "0 0 10px #00aaff44" : "none",
      transition: "all 0.15s", position: "relative",
    }}>
      <span style={{ fontSize: "16px" }}>{icon}</span>
      <span style={{ fontSize: "7px", opacity: 0.75 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          position: "absolute", top: -5, right: -5,
          background: "#ff4444", color: "white", borderRadius: "8px",
          padding: "1px 5px", fontSize: "9px", fontWeight: 700, lineHeight: "14px",
        }}>{badge}</span>
      )}
    </button>
  );
}

/* ─── Vault icon button (gold accent) ───────────────────────────── */
function VaultBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title="الخزنة (V)" style={{
      width: "42px", height: "42px", borderRadius: "10px",
      border: active ? "2px solid #c4a44a" : "1.5px solid #554400",
      background: active ? "rgba(196,164,74,0.22)" : "rgba(20,14,0,0.78)",
      color: active ? "#ffdd55" : "#aa8800",
      cursor: "pointer", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      lineHeight: 1, gap: "2px", backdropFilter: "blur(6px)",
      boxShadow: active ? "0 0 12px #c4a44a55" : "none",
      transition: "all 0.15s",
    }}>
      <span style={{ fontSize: "16px" }}>⚙️</span>
      <span style={{ fontSize: "7px", opacity: 0.75 }}>خزنة</span>
    </button>
  );
}

/* ─── Popout panel (opens to the left of the toolbar) ───────────── */
function PopPanel({ width = 260, children }: { width?: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", right: "50px", top: 0,
      width: `${width}px`, maxHeight: "72vh", overflowY: "auto",
      background: "rgba(4,8,20,0.97)", border: "1.5px solid #00334d",
      borderRadius: "12px", padding: "12px 14px",
      backdropFilter: "blur(12px)", boxShadow: "0 4px 32px #00000099",
      direction: "rtl",
    }}>
      {children}
    </div>
  );
}

/* ─── Button inside a popout panel ──────────────────────────────── */
function PBtn({
  icon, label, onClick, color = "80,80,80", tag, disabled,
}: {
  icon: string; label: string; onClick: () => void;
  color?: string; tag?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(${color},0.28)`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(${color},0.12)`; }}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        width: "100%", padding: "9px 11px", marginBottom: "4px",
        background: `rgba(${color},0.12)`,
        border: `1px solid rgba(${color},0.3)`,
        borderRadius: "10px", color: "white",
        fontSize: "12px", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "right", direction: "rtl",
        opacity: disabled ? 0.5 : 1, transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: "15px" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {tag && <span style={{ fontSize: "9px", opacity: 0.6 }}>{tag}</span>}
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export function TopRightPanel() {
  const phase              = useGame(s => s.phase);
  const isGuest            = useGame(s => s.isGuest);
  const openVault          = useGame(s => s.openVault);
  const closeVault         = useGame(s => s.closeVault);
  const vaultOpen          = useGame(s => s.vaultOpen);
  const setMeetingMode     = useGame(s => s.setMeetingMode);
  const meetingMode        = useGame(s => s.meetingMode);
  const openMeetingMinutes = useGame(s => s.openMeetingMinutes);
  const openAgoraMeeting   = useGame(s => s.openAgoraMeeting);
  const models             = useGame(s => s.models);
  const hallWorkers        = useGame(s => s.hallWorkers);
  const isBroadcast        = useChat(s => s.isBroadcast);
  const totalRobots        = models.length + hallWorkers.length;

  const [panel, setPanel] = useState<"office" | "atal" | "auto" | null>(null);
  const toggle = (p: "office" | "atal" | "auto") =>
    setPanel(v => (v === p ? null : p));

  /* ── Meeting / broadcast ──────────────────────────────────────── */
  const [meetingLoading, setMeetingLoading] = useState(false);

  useEffect(() => {
    if (!isBroadcast) setMeetingMode(false);
  }, [isBroadcast, setMeetingMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyF") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const gs = useGame.getState(); const cs = useChat.getState();
      if (gs.meetingMode && !cs.isBroadcast) {
        e.stopPropagation();
        useChat.setState({ isBroadcast: true, broadcastResults: {}, robotScreens: {}, inputText: "" });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /* ── Vault keyboard shortcut (V) ─────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyV" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        vaultOpen ? closeVault() : openVault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vaultOpen, openVault, closeVault]);

  /* ── Atal ─────────────────────────────────────────────────────── */
  const [atalQueue, setAtalQueue] = useState<any[]>([]);

  useEffect(() => {
    if (panel !== "atal") return;
    const doFetch = () =>
      apiFetch("/api/atal/queue").then(r => r.json()).then(setAtalQueue).catch(() => {});
    doFetch();
    const t = setInterval(doFetch, 3000);
    return () => clearInterval(t);
  }, [panel]);

  const clearDoneAtal = async () => {
    await apiFetch("/api/atal/queue", { method: "DELETE" }).catch(() => {});
    apiFetch("/api/atal/queue").then(r => r.json()).then(setAtalQueue).catch(() => {});
  };
  const retryErrorsAtal = async () => {
    await apiFetch("/api/atal/retry", { method: "POST" }).catch(() => {});
    apiFetch("/api/atal/queue").then(r => r.json()).then(setAtalQueue).catch(() => {});
  };

  /* ── Auto-trigger ─────────────────────────────────────────────── */
  const [config, setConfig]   = useState<TriggerConfig | null>(null);
  const [logs, setLogs]       = useState<TriggerLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selUser, setSelUser] = useState<number | null>(null);
  const [trigInterval, setTrigInterval] = useState(5);
  const [selRobot, setSelRobot] = useState("robot-1");
  const [expLog, setExpLog]       = useState<string | null>(null);
  const [fullLog, setFullLog]     = useState<TriggerLog | null>(null);
  const [copied, setCopied]       = useState(false);
  const [trigLoading, setTrigLoading] = useState(false);
  const [scanFeedback,  setScanFeedback]  = useState<"idle"|"loading"|"done">("idle");
  const [clearFeedback, setClearFeedback] = useState<"idle"|"loading"|"done">("idle");
  const fetchTriggerData = (isInit = false) => {
    apiFetch("/api/auto-trigger/config").then(r => r.json()).then(d => {
      setConfig(d);
      // نحدّث قيم الفورم فقط عند التحميل الأول — الـ polling لا يمس ما كتبه المستخدم
      if (isInit) {
        if (d.watchUserId)     setSelUser(d.watchUserId);
        if (d.intervalMinutes) setTrigInterval(d.intervalMinutes);
        if (d.robotId)         setSelRobot(d.robotId);
      }
    }).catch(() => {});
    apiFetch("/api/auto-trigger/logs").then(r => r.json()).then(setLogs).catch(() => {});
  };

  useEffect(() => {
    fetchTriggerData(true); // isInit=true → يحدّث الـ dropdown
    apiFetch("/api/clickup/members").then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : d.members ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (panel !== "auto") return;
    fetchTriggerData(true); // أول مرة يفتح الـ panel → حدّث
    const t = setInterval(() => fetchTriggerData(false), 5000); // polling → لا تعدّل الـ dropdown
    return () => clearInterval(t);
  }, [panel]);

  const handleStart = async () => {
    if (!selUser) return;
    setTrigLoading(true);
    try {
      await apiFetch("/api/auto-trigger/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selUser, intervalMinutes: trigInterval, robotId: selRobot }),
      });
      fetchTriggerData(false); // لا تمسح الاختيار بعد الإطلاق
    } catch (_e) {} finally { setTrigLoading(false); }
  };
  const handleStop = async () => {
    setTrigLoading(true);
    try { await apiFetch("/api/auto-trigger/stop", { method: "POST" }); fetchTriggerData(true); }
    catch (_e) {} finally { setTrigLoading(false); }
  };
  const handleScanNow = async () => {
    if (scanFeedback === "loading") return;
    setScanFeedback("loading");
    try {
      await apiFetch("/api/auto-trigger/scan", { method: "POST" });
      setScanFeedback("done");
      setTimeout(() => { setScanFeedback("idle"); fetchTriggerData(false); }, 1800);
    } catch (_e) {
      setScanFeedback("idle");
    }
  };
  const handleClearCache = async () => {
    if (clearFeedback === "loading") return;
    setClearFeedback("loading");
    try {
      await apiFetch("/api/auto-trigger/clear-cache", { method: "POST" });
      setClearFeedback("done");
      setTimeout(() => { setClearFeedback("idle"); fetchTriggerData(false); }, 1800);
    } catch (_e) {
      setClearFeedback("idle");
    }
  };

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

  const buildLogText = (log: TriggerLog) =>
    `المهمة: ${log.taskName}\nالحالة: ${log.status}\nالوقت: ${new Date(log.startedAt).toLocaleString("ar-SA")}\nالأدوات: ${log.toolsUsed.join(", ") || "—"}\n\n${log.result || ""}${log.error ? `\n\nخطأ: ${log.error}` : ""}`;

  const handleExportTxt = (log: TriggerLog) => {
    const blob = new Blob([buildLogText(log)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `task-${log.id}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLog = (log: TriggerLog) => {
    navigator.clipboard.writeText(buildLogText(log)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  };

  const sInfo = (s: string) => ({
    running:   { label: "قيد التنفيذ", color: "#42a5f5", icon: "⚙️" },
    completed: { label: "تم",           color: "#66bb6a", icon: "✅" },
    failed:    { label: "فشل",          color: "#ef5350", icon: "❌" },
  }[s] ?? { label: s, color: "#999", icon: "⏳" });

  const handleWebex = async () => {
    setMeetingLoading(true);
    try {
      const res  = await fetch("/api/webex/create-meeting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sillar Meeting" }),
      });
      const data = await res.json();
      if (data.meetingLink) window.open(data.meetingLink, "_blank");
      else alert("فشل إنشاء الاجتماع: " + (data.error || "خطأ"));
    } catch { alert("تعذر الاتصال"); } finally { setMeetingLoading(false); }
  };

  if (phase !== "playing") return null;

  const isRunning  = config?.enabled || false;
  const atalActive = atalQueue.filter(f => f.status === "pending" || f.status === "uploading").length;
  const atalDone   = atalQueue.filter(f => f.status === "done").length;
  const atalErr    = atalQueue.filter(f => f.status === "error").length;

  return (
    <>
    {/* ── Fullscreen log review modal ──────────────────────────────── */}
    {fullLog && (() => {
      const si = sInfo(fullLog.status);
      return (
        <div
          onClick={() => setFullLog(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(820px, 92vw)", maxHeight: "85vh",
              background: "#0a0e1a", border: "1.5px solid #1e3a5f",
              borderRadius: "16px", display: "flex", flexDirection: "column",
              boxShadow: "0 8px 60px #000a",
            }}
          >
            {/* header */}
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid #1e3a5f",
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "white", fontSize: "15px", fontWeight: 700, marginBottom: 4 }}>
                  {si.icon} {fullLog.taskName}
                </div>
                <div style={{ color: "#555", fontSize: "12px" }}>
                  {new Date(fullLog.startedAt).toLocaleString("ar-SA")}
                  {fullLog.toolsUsed.length > 0 && ` · أدوات: ${fullLog.toolsUsed.join(", ")}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleCopyLog(fullLog)} style={{
                  padding: "6px 12px", borderRadius: "8px", border: "1px solid #334",
                  background: copied ? "#66bb6a20" : "#1a2030", color: copied ? "#66bb6a" : "#aaa",
                  fontSize: "12px", cursor: "pointer",
                }}>
                  {copied ? "✅ تم النسخ" : "📋 نسخ"}
                </button>
                <button onClick={() => handleExportTxt(fullLog)} style={{
                  padding: "6px 12px", borderRadius: "8px", border: "1px solid #334",
                  background: "#1a2030", color: "#4fc3f7", fontSize: "12px", cursor: "pointer",
                }}>
                  💾 TXT
                </button>
                <button onClick={() => setFullLog(null)} style={{
                  padding: "6px 12px", borderRadius: "8px", border: "1px solid #334",
                  background: "#1a2030", color: "#ef5350", fontSize: "12px", cursor: "pointer",
                }}>
                  ✕
                </button>
              </div>
            </div>
            {/* body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {fullLog.error && (
                <div style={{
                  background: "#ef535015", border: "1px solid #ef535040",
                  borderRadius: "8px", padding: "10px 14px", marginBottom: "12px",
                  color: "#ef5350", fontSize: "13px",
                }}>
                  ⚠ {fullLog.error}
                </div>
              )}
              <pre style={{
                color: "#c9d1d9", fontSize: "13px", lineHeight: 1.7,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                margin: 0,
              }}>
                {fullLog.result || "(لا يوجد نتيجة)"}
              </pre>
            </div>
          </div>
        </div>
      );
    })()}

    <div style={{
      position: "fixed", top: 14, right: 16, zIndex: 500,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>

      {/* ── ⚙️ خزنة ─────────────────────────────────────────────── */}
      {!isGuest && (
        <VaultBtn
          active={vaultOpen}
          onClick={() => vaultOpen ? closeVault() : openVault()}
        />
      )}

      {/* ── 🏢 مكتب ─────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        {panel === "office" && (
          <PopPanel width={220}>
            <div style={{
              fontSize: "11px", color: "#4488aa", fontWeight: 700,
              borderBottom: "1px solid #00334d", paddingBottom: "8px", marginBottom: "8px",
            }}>
              🏢 أدوات المكتب{totalRobots > 0 ? ` · ${totalRobots} روبوت` : ""}
            </div>
            <PBtn icon="💬" label="محادثة جماعية" color="99,102,241"
              onClick={() => { setMeetingMode(true); setPanel(null); }} />
            {meetingMode && (
              <PBtn icon="📹" label="اجتماع مرئي" color="0,150,255"
                onClick={() => { openAgoraMeeting(); setPanel(null); }} />
            )}
            {meetingMode && (
              <PBtn icon="📋" label="محضر الاجتماع" color="0,210,140" tag="M"
                onClick={() => { openMeetingMinutes(); setPanel(null); }} />
            )}
            <PBtn
              icon={meetingLoading ? "⏳" : "🎥"}
              label={meetingLoading ? "جارٍ الإنشاء..." : "اجتماع Webex"}
              color="0,132,200"
              onClick={handleWebex}
              disabled={meetingLoading}
            />
          </PopPanel>
        )}
        <IBtn
          icon="🏢" label="مكتب"
          active={panel === "office"}
          onClick={() => toggle("office")}
        />
      </div>

      {/* ── 🏭 عتال ─────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        {panel === "atal" && (
          <PopPanel width={340}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderBottom: "1px solid rgba(251,191,36,0.2)", paddingBottom: "8px", marginBottom: "8px",
            }}>
              <span style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "13px" }}>🏭 مراقب العتال</span>
              <div style={{ display: "flex", gap: 5 }}>
                {atalErr > 0 && (
                  <button onClick={retryErrorsAtal} style={{
                    background: "none", border: "1px solid #ef444460", borderRadius: "6px",
                    color: "#f87171", fontSize: "10px", padding: "2px 6px", cursor: "pointer",
                  }}>🔄 إعادة</button>
                )}
                <button onClick={clearDoneAtal} style={{
                  background: "none", border: "1px solid #334155", borderRadius: "6px",
                  color: "#94a3b8", fontSize: "10px", padding: "2px 6px", cursor: "pointer",
                }}>🧹 مسح</button>
              </div>
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", direction: "ltr", marginBottom: "8px" }}>
              {atalActive} pending · {atalDone} done · {atalErr} error
            </div>
            {atalQueue.length === 0 ? (
              <div style={{ color: "#475569", textAlign: "center", padding: "16px 0", fontSize: "12px" }}>
                الطابور فارغ
              </div>
            ) : atalQueue.map((f: any) => {
              const sc = f.status === "done" ? "#22c55e" : f.status === "error" ? "#ef4444" : f.status === "uploading" ? "#fbbf24" : "#94a3b8";
              const si = f.status === "done" ? "✅" : f.status === "error" ? "❌" : f.status === "uploading" ? "⬆️" : "⏳";
              return (
                <div key={f.id} style={{
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${sc}30`,
                  borderRadius: "7px", padding: "6px 10px", marginBottom: "5px", direction: "ltr",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#e2e8f0", fontSize: "11px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {si} {f.path}
                    </span>
                    <span style={{ color: sc, fontSize: "10px", marginLeft: 6 }}>{f.status}</span>
                  </div>
                  {f.error && <div style={{ color: "#ef4444", fontSize: "10px", marginTop: 2 }}>⚠ {f.error}</div>}
                </div>
              );
            })}
          </PopPanel>
        )}
        <IBtn
          icon="🏭" label="عتال"
          active={panel === "atal"}
          onClick={() => toggle("atal")}
          badge={atalActive}
        />
      </div>

      {/* ── ⚡ مراقب تلقائي ──────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        {panel === "auto" && (
          <PopPanel width={360}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderBottom: `1px solid ${isRunning ? "#66bb6a40" : "#ff980040"}`,
              paddingBottom: "8px", marginBottom: "10px",
            }}>
              <span style={{ color: "white", fontSize: "13px", fontWeight: "bold" }}>
                ⚡ المراقب التلقائي
              </span>
              {isRunning && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#66bb6a22", border: "1px solid #66bb6a44",
                  borderRadius: 8, padding: "2px 8px", fontSize: "10px", color: "#66bb6a",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#66bb6a", display: "inline-block" }} />
                  شغال
                </span>
              )}
            </div>

            {!isRunning ? (
              <div>
                <div style={{ color: "#888", fontSize: "11px", marginBottom: "10px" }}>
                  يفحص ClickUp ويُنفذ المهام تلقائياً
                </div>
                <label style={{ color: "#ccc", fontSize: "12px", display: "block", marginBottom: 4 }}>راقب مهام:</label>
                <select
                  value={selUser || ""}
                  onChange={e => setSelUser(Number(e.target.value) || null)}
                  style={{ width: "100%", background: "#0d1117", border: "1px solid #333", borderRadius: "7px", padding: "7px 10px", color: "white", fontSize: "12px", marginBottom: "8px", direction: "rtl" }}
                >
                  <option value="">اختر عضو الفريق</option>
                  {(Array.isArray(members) ? members : []).map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                </select>
                <label style={{ color: "#ccc", fontSize: "12px", display: "block", marginBottom: 4 }}>فحص كل (دقائق):</label>
                <input
                  type="number" min={1} max={60} value={trigInterval}
                  onChange={e => setTrigInterval(Number(e.target.value))}
                  style={{ width: "70px", background: "#0d1117", border: "1px solid #333", borderRadius: "7px", padding: "6px 10px", color: "white", fontSize: "12px", marginBottom: "8px" }}
                />
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {([
                    { id: "robot-1", label: "GPT-4o",       color: "#4fc3f7" },
                    { id: "robot-2", label: "Claude API",   color: "#66bb6a" },
                    { id: "robot-3", label: "Claude CLI 🆓", color: "#c084fc" },
                    { id: "robot-4", label: "Gemini ⚡",    color: "#facc15" },
                  ] as const).map(r => (
                    <button key={r.id} onClick={() => setSelRobot(r.id)} style={{
                      flex: 1, padding: "6px", borderRadius: "7px", cursor: "pointer",
                      border: selRobot === r.id ? `2px solid ${r.color}` : "1px solid #333",
                      background: selRobot === r.id ? `${r.color}20` : "#0d1117",
                      color: selRobot === r.id ? r.color : "#aaa", fontSize: "10px",
                    }}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <button onClick={handleStart} disabled={!selUser || trigLoading} style={{
                  width: "100%", padding: "10px", borderRadius: "8px", border: "none",
                  background: !selUser || trigLoading ? "#333" : "#66bb6a",
                  color: "white", fontSize: "13px", fontWeight: "bold",
                  cursor: !selUser || trigLoading ? "not-allowed" : "pointer",
                }}>
                  {trigLoading ? "..." : "شغّل المراقب"}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ background: "rgba(30,60,30,0.5)", borderRadius: "8px", padding: "10px", marginBottom: "10px", border: "1px solid #66bb6a30" }}>
                  <div style={{ color: "#aaa", fontSize: "11px" }}>
                    يراقب: {(Array.isArray(members) ? members : []).find(m => m.id === config?.watchUserId)?.username || config?.watchUserId}
                  </div>
                  <div style={{ color: "#aaa", fontSize: "11px" }}>
                    كل {config?.intervalMinutes} دقائق · {
                      config?.robotId === "robot-1" ? "GPT-4o" :
                      config?.robotId === "robot-3" ? "Claude CLI 🆓" :
                      config?.robotId === "robot-4" ? "Gemini ⚡" : "Claude API"
                    }
                  </div>
                </div>
                <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                  {/* زر فحص الآن */}
                  <button
                    onClick={handleScanNow}
                    disabled={scanFeedback === "loading"}
                    style={{
                      flex: 1, padding: "6px", borderRadius: "7px", fontSize: "11px", cursor: "pointer",
                      border: scanFeedback === "done"
                        ? "1px solid #66bb6a"
                        : "1px solid #42a5f5",
                      background: scanFeedback === "done"
                        ? "#66bb6a25"
                        : scanFeedback === "loading"
                          ? "#42a5f510"
                          : "#42a5f520",
                      color: scanFeedback === "done" ? "#66bb6a" : "#42a5f5",
                      transition: "all 0.25s",
                      opacity: scanFeedback === "loading" ? 0.7 : 1,
                    }}
                  >
                    {scanFeedback === "loading" ? "⏳ جاري..." : scanFeedback === "done" ? "✅ تم الفحص" : "فحص الآن"}
                  </button>

                  {/* زر إعادة فحص */}
                  <button
                    onClick={handleClearCache}
                    disabled={clearFeedback === "loading"}
                    style={{
                      flex: 1, padding: "6px", borderRadius: "7px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                      border: clearFeedback === "done"
                        ? "2px solid #66bb6a"
                        : clearFeedback === "loading"
                          ? "1px solid #f59e0b"
                          : "1px solid #f59e0b",
                      background: clearFeedback === "done"
                        ? "#66bb6a25"
                        : clearFeedback === "loading"
                          ? "#f59e0b08"
                          : "#f59e0b15",
                      color: clearFeedback === "done" ? "#66bb6a" : "#f59e0b",
                      boxShadow: clearFeedback === "loading" ? "0 0 10px #f59e0b55" : clearFeedback === "done" ? "0 0 10px #66bb6a55" : "none",
                      transition: "all 0.25s",
                      opacity: clearFeedback === "loading" ? 0.7 : 1,
                    }}
                  >
                    {clearFeedback === "loading" ? "⏳ جاري..." : clearFeedback === "done" ? "✅ تم المسح" : "🔄 إعادة فحص"}
                  </button>

                  <button onClick={handleStop} disabled={trigLoading} style={{ flex: 1, padding: "6px", borderRadius: "7px", border: "1px solid #ef5350", background: "#ef535020", color: "#ef5350", fontSize: "11px", cursor: "pointer" }}>أوقف</button>
                </div>
                <div style={{ color: "#bbb", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>سجل التنفيذ:</div>
                {logs.length === 0 && (
                  <div style={{ color: "#555", textAlign: "center", padding: "12px 0", fontSize: "11px" }}>
                    ما في مهام بعد · يفحص كل {config?.intervalMinutes} دقائق
                  </div>
                )}
                {logs.map(log => {
                  const si = sInfo(log.status);
                  const exp = expLog === log.id;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setExpLog(exp ? null : log.id)}
                      onDoubleClick={(e) => { e.stopPropagation(); setFullLog(log); }}
                      title="دبل كليك للعرض الكامل"
                      style={{
                        background: "#0d1117", borderRadius: "8px", padding: "8px",
                        marginBottom: "5px", cursor: "pointer", border: `1px solid ${si.color}30`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          color: "white", fontSize: "11px", flex: 1,
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: exp ? "normal" : "nowrap",
                        }}>
                          {log.taskName}
                        </span>
                        <span style={{ color: si.color, fontSize: "10px", marginRight: 4, flexShrink: 0 }}>
                          {si.icon} {si.label}
                        </span>
                      </div>
                      <div style={{ color: "#555", fontSize: "10px", marginTop: 2 }}>{fmtTime(log.startedAt)}</div>
                      {exp && log.error && (
                        <div style={{ color: "#ef5350", fontSize: "10px", marginTop: 4, whiteSpace: "pre-wrap" }}>
                          ⚠ {log.error}
                        </div>
                      )}
                      {exp && log.result && (
                        <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: 4, whiteSpace: "pre-wrap" }}>
                          {log.result.slice(0, 400)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </PopPanel>
        )}
        <IBtn
          icon={isRunning ? "🤖" : "⚡"} label="مراقب"
          active={panel === "auto" || isRunning}
          glowColor={isRunning ? "#66bb6a55" : undefined}
          onClick={() => toggle("auto")}
        />
      </div>

    </div>
    </>
  );
}
