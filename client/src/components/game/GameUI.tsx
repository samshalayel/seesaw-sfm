import { useState, useEffect, useRef } from "react";
import { useChat } from "@/lib/stores/useChat";
import { useGame } from "@/lib/stores/useGame";
import { apiFetch } from "@/lib/utils";


export function GameUI() {
  const isOpen            = useChat((s) => s.isOpen);
  const isBroadcast       = useChat((s) => s.isBroadcast);
  const models            = useGame((s) => s.models);
  const hallWorkers       = useGame((s) => s.hallWorkers);
  const setMeetingMode    = useGame((s) => s.setMeetingMode);
  const meetingMode        = useGame((s) => s.meetingMode);
  const openMeetingMinutes = useGame((s) => s.openMeetingMinutes);
  const openAgoraMeeting   = useGame((s) => s.openAgoraMeeting);
  const totalRobots       = models.length + hallWorkers.length;

  // عند إغلاق البث → أوقف وضع الاجتماع
  useEffect(() => {
    if (!isBroadcast) setMeetingMode(false);
  }, [isBroadcast, setMeetingMode]);

  // F في وضع الاجتماع → افتح صندوق البث (capture يضمن أولوية على F العادي)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyF") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const gs = useGame.getState();
      const cs = useChat.getState();
      if (gs.meetingMode && !cs.isBroadcast) {
        e.stopPropagation();
        useChat.setState({ isBroadcast: true, broadcastResults: {}, robotScreens: {}, inputText: "" });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const [expanded, setExpanded]           = useState(false);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [showAtal, setShowAtal]           = useState(false);
  const [atalQueue, setAtalQueue]         = useState<any[]>([]);
  const atalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // polling كل 3 ثواني لما اللوحة مفتوحة
  useEffect(() => {
    if (!showAtal) {
      if (atalIntervalRef.current) clearInterval(atalIntervalRef.current);
      return;
    }
    const fetchQueue = () =>
      apiFetch("/api/atal/queue").then(r => r.json()).then(setAtalQueue).catch(() => {});
    fetchQueue();
    atalIntervalRef.current = setInterval(fetchQueue, 3000);
    return () => { if (atalIntervalRef.current) clearInterval(atalIntervalRef.current); };
  }, [showAtal]);

  const clearDoneAtal = async () => {
    await apiFetch("/api/atal/queue", { method: "DELETE" }).catch(() => {});
    apiFetch("/api/atal/queue").then(r => r.json()).then(setAtalQueue).catch(() => {});
  };

  const retryErrorsAtal = async () => {
    await apiFetch("/api/atal/retry", { method: "POST" }).catch(() => {});
    apiFetch("/api/atal/queue").then(r => r.json()).then(setAtalQueue).catch(() => {});
  };

  const handleWebexMeeting = async () => {
    setMeetingLoading(true);
    try {
      const res  = await fetch("/api/webex/create-meeting", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: "Sillar Meeting" }),
      });
      const data = await res.json();
      if (data.meetingLink) {
        window.open(data.meetingLink, "_blank");
      } else {
        alert("فشل إنشاء الاجتماع: " + (data.error || "خطأ غير معروف"));
      }
    } catch {
      alert("تعذر الاتصال بالخادم");
    } finally {
      setMeetingLoading(false);
    }
  };

  const handleBroadcast = () => {
    // فعّل وضع الاجتماع فقط — الحوار يُفتح بعد الضغط على F
    setMeetingMode(true);
  };

  /* ─── styles ────────────────────────────────────── */
  const card: React.CSSProperties = {
    position:       "absolute",
    top:            "70px",
    right:          "16px",
    zIndex:         50,
    fontFamily:     "Inter, sans-serif",
    direction:      "rtl",
    background:     "rgba(15, 17, 35, 0.82)",
    backdropFilter: "blur(14px)",
    borderRadius:   "18px",
    border:         "1px solid rgba(255,255,255,0.08)",
    boxShadow:      "0 8px 32px rgba(0,0,0,0.45)",
    overflow:       "hidden",
    transition:     "all 0.25s cubic-bezier(.4,0,.2,1)",
    minWidth:       "56px",
  };

  const header: React.CSSProperties = {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "10px",
    padding:        expanded ? "14px 18px 10px" : "14px 18px",
    cursor:         "pointer",
    userSelect:     "none",
  };

  const badge: React.CSSProperties = {
    background:   "rgba(99,102,241,0.25)",
    border:       "1px solid rgba(99,102,241,0.5)",
    borderRadius: "20px",
    padding:      "2px 9px",
    fontSize:     "11px",
    color:        "#a5b4fc",
    fontWeight:   "700",
  };

  const divider: React.CSSProperties = {
    height:     "1px",
    background: "rgba(255,255,255,0.07)",
    margin:     "0 14px",
  };

  const actions: React.CSSProperties = {
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
    padding:       "10px 14px 14px",
  };

  const btn = (accent: string): React.CSSProperties => ({
    display:        "flex",
    alignItems:     "center",
    gap:            "10px",
    padding:        "10px 14px",
    background:     `rgba(${accent}, 0.12)`,
    border:         `1px solid rgba(${accent}, 0.3)`,
    borderRadius:   "12px",
    color:          "white",
    fontSize:       "13px",
    fontWeight:     "600",
    cursor:         "pointer",
    transition:     "background 0.15s, transform 0.15s",
    textAlign:      "right",
    direction:      "rtl",
    width:          "100%",
  });

  return (
    <>
      {/* ── الكارد الرئيسي ── */}
      <div style={card}>

        {/* Header — قابل للطي */}
        <div style={header} onClick={() => setExpanded((v) => !v)}>
          <span style={{ fontSize: "20px", lineHeight: 1 }}>🏢</span>
          {expanded && (
            <span style={{ color: "white", fontWeight: "700", fontSize: "13px", flex: 1 }}>
              أدوات المكتب
            </span>
          )}
          {expanded && totalRobots > 0 && (
            <span style={badge}>{totalRobots}</span>
          )}
          <span style={{
            color:      "rgba(255,255,255,0.4)",
            fontSize:   "11px",
            transition: "transform 0.2s",
            transform:  expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}>▾</span>
        </div>

        {/* Body — يظهر عند الفتح */}
        {expanded && (
          <>
            <div style={divider} />
            <div style={actions}>

              {/* محادثة جماعية */}
              <button
                style={btn("99, 102, 241")}
                onClick={handleBroadcast}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(99,102,241,0.25)";
                  e.currentTarget.style.transform  = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(99,102,241,0.12)";
                  e.currentTarget.style.transform  = "translateY(0)";
                }}
              >
                <span style={{ fontSize: "16px" }}>💬</span>
                <span style={{ flex: 1 }}>محادثة جماعية</span>
                {totalRobots > 0 && (
                  <span style={{
                    background:   "rgba(99,102,241,0.35)",
                    borderRadius: "10px",
                    padding:      "1px 7px",
                    fontSize:     "11px",
                    fontWeight:   "700",
                  }}>{totalRobots}</span>
                )}
              </button>

              {/* اجتماع مرئي — يظهر فقط في وضع الاجتماع */}
              {meetingMode && (
                <button
                  style={btn("0, 150, 255")}
                  onClick={openAgoraMeeting}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,150,255,0.25)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,150,255,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <span style={{ fontSize: "16px" }}>📹</span>
                  <span style={{ flex: 1 }}>اجتماع مرئي</span>
                </button>
              )}

              {/* محضر الاجتماع — يظهر فقط في وضع الاجتماع */}
              {meetingMode && (
                <button
                  style={btn("0, 210, 140")}
                  onClick={openMeetingMinutes}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,210,140,0.25)";
                    e.currentTarget.style.transform  = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,210,140,0.12)";
                    e.currentTarget.style.transform  = "translateY(0)";
                  }}
                >
                  <span style={{ fontSize: "16px" }}>📋</span>
                  <span style={{ flex: 1 }}>محضر الاجتماع</span>
                  <span style={{ fontSize: "10px", color: "rgba(0,210,140,0.7)", fontWeight: 400 }}>M</span>
                </button>
              )}

              {/* مراقب العتال */}
              <button
                style={{ ...btn("251, 191, 36"), position: "relative" }}
                onClick={() => setShowAtal(v => !v)}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.25)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <span style={{ fontSize: "16px" }}>🏭</span>
                <span style={{ flex: 1 }}>مراقب العتال</span>
                {atalQueue.filter(f => f.status === "pending" || f.status === "uploading").length > 0 && (
                  <span style={{ background: "rgba(251,191,36,0.4)", borderRadius: "10px", padding: "1px 7px", fontSize: "11px", fontWeight: "700" }}>
                    {atalQueue.filter(f => f.status === "pending" || f.status === "uploading").length}
                  </span>
                )}
              </button>

              {/* اجتماع Webex */}
              <button
                style={{
                  ...btn("0, 132, 200"),
                  opacity: meetingLoading ? 0.6 : 1,
                  cursor:  meetingLoading ? "not-allowed" : "pointer",
                }}
                disabled={meetingLoading}
                onClick={handleWebexMeeting}
                onMouseEnter={(e) => {
                  if (!meetingLoading) {
                    e.currentTarget.style.background = "rgba(0,132,200,0.25)";
                    e.currentTarget.style.transform  = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0,132,200,0.12)";
                  e.currentTarget.style.transform  = "translateY(0)";
                }}
              >
                <span style={{ fontSize: "16px" }}>{meetingLoading ? "⏳" : "🎥"}</span>
                <span style={{ flex: 1 }}>
                  {meetingLoading ? "جارٍ الإنشاء..." : "اجتماع Webex"}
                </span>
              </button>

            </div>
          </>
        )}
      </div>

      {/* ── لوحة مراقبة العتال ── */}
      {showAtal && (
        <div style={{
          position: "absolute", top: "60px", left: "60px",
          width: "380px", maxHeight: "480px",
          background: "rgba(10,10,20,0.97)",
          border: "1px solid rgba(251,191,36,0.4)",
          borderRadius: "14px",
          boxShadow: "0 0 30px rgba(251,191,36,0.15)",
          fontFamily: "Inter, sans-serif",
          zIndex: 200,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(251,191,36,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "14px" }}>🏭 مراقب العتال</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: "11px", direction: "ltr" }}>
                {atalQueue.filter(f => f.status === "pending").length} pending ·{" "}
                {atalQueue.filter(f => f.status === "uploading").length} uploading ·{" "}
                {atalQueue.filter(f => f.status === "done").length} done ·{" "}
                {atalQueue.filter(f => f.status === "error").length} error
              </span>
              {atalQueue.some(f => f.status === "error") && (
                <button onClick={retryErrorsAtal} title="أعد المحاولة على الأخطاء" style={{ background: "none", border: "1px solid #ef444460", borderRadius: "6px", color: "#f87171", fontSize: "11px", padding: "2px 8px", cursor: "pointer" }}>🔄 إعادة</button>
              )}
              <button onClick={clearDoneAtal} title="امسح المكتملة" style={{ background: "none", border: "1px solid #334155", borderRadius: "6px", color: "#94a3b8", fontSize: "11px", padding: "2px 8px", cursor: "pointer" }}>🧹 مسح</button>
              <button onClick={() => setShowAtal(false)} style={{ background: "none", border: "none", color: "#666", fontSize: "16px", cursor: "pointer" }}>✕</button>
            </div>
          </div>
          {/* Queue list */}
          <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
            {atalQueue.length === 0 && (
              <div style={{ color: "#475569", textAlign: "center", padding: "24px", fontSize: "13px" }}>الطابور فارغ</div>
            )}
            {atalQueue.map((f: any) => {
              const statusColor = f.status === "done" ? "#22c55e" : f.status === "error" ? "#ef4444" : f.status === "uploading" ? "#fbbf24" : "#94a3b8";
              const statusIcon  = f.status === "done" ? "✅" : f.status === "error" ? "❌" : f.status === "uploading" ? "⬆️" : "⏳";
              return (
                <div key={f.id} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${statusColor}30`,
                  borderRadius: "8px", padding: "8px 12px",
                  marginBottom: "6px", direction: "ltr",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: "600", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {statusIcon} {f.path}
                    </span>
                    <span style={{ color: statusColor, fontSize: "11px", marginLeft: "8px", flexShrink: 0 }}>{f.status}</span>
                  </div>
                  {f.error && <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px" }}>⚠ {f.error}</div>}
                  <div style={{ color: "#475569", fontSize: "10px", marginTop: "3px" }}>
                    {new Date(f.addedAt).toLocaleTimeString("ar-SA")} · {f.isBase64 ? "🖼 binary" : "📄 text"} · {(f.content?.length / 1024).toFixed(1)} KB
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── تعليمات الحركة ── */}
      {!isOpen && (
        <div style={{
          position:       "absolute",
          bottom:         "20px",
          left:           "50%",
          transform:      "translateX(-50%)",
          background:     "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
          color:          "white",
          padding:        "10px 22px",
          borderRadius:   "10px",
          border:         "1px solid rgba(255,255,255,0.08)",
          fontFamily:     "Inter, sans-serif",
          fontSize:       "13px",
          pointerEvents:  "none",
          userSelect:     "none",
          direction:      "rtl",
          textAlign:      "center",
        }}>
          <div>استخدم مفاتيح الأسهم للتحرك</div>
          <div style={{ fontSize: "11px", marginTop: "3px", color: "#aaa" }}>
            اقترب من روبوت واضغط F للتحدث معه
          </div>
        </div>
      )}
    </>
  );
}
