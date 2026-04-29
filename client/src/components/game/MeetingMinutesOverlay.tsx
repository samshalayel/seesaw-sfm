import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/stores/useGame";

// ── helpers ──────────────────────────────────────────────────────────────────
function formatDate() {
  return new Date().toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}
function formatTime() {
  return new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MeetingMinutesOverlay() {
  const open               = useGame((s) => s.meetingMinutesOpen);
  const close              = useGame((s) => s.closeMeetingMinutes);
  const models             = useGame((s) => s.models);
  const hallWorkers        = useGame((s) => s.hallWorkers);
  const humans             = useGame((s) => s.humans);
  const companyName        = useGame((s) => s.companyName);

  // محتوى المحضر
  const [title,    setTitle]    = useState("اجتماع الفريق");
  const [agenda,   setAgenda]   = useState("1. مراجعة المهام الأسبوعية\n2. مناقشة التحديات\n3. خطة الأسبوع القادم");
  const [notes,    setNotes]    = useState("");
  const [decisions, setDecisions] = useState("");
  const [startTime] = useState(formatTime());
  const [dateStr]   = useState(formatDate());

  const overlayRef = useRef<HTMLDivElement>(null);

  // M key — فتح / إغلاق
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyM") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const gs = useGame.getState();
      if (!gs.meetingMode) return;
      e.stopPropagation();
      if (gs.meetingMinutesOpen) gs.closeMeetingMinutes();
      else gs.openMeetingMinutes();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // ESC — إغلاق
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  // قائمة الحاضرين
  const attendees = [
    ...models.map((m) => ({ name: m.name || m.id, role: "AI Assistant", type: "robot" as const })),
    ...hallWorkers.map((w) => ({ name: w.name || w.id, role: "Hall Worker", type: "robot" as const })),
    ...humans.map((h) => ({ name: h.name, role: h.role, type: "human" as const })),
  ];

  // نسخ المحضر كاملاً
  const copyMinutes = () => {
    const text = [
      `════════════════════════════════`,
      `محضر اجتماع — ${companyName || "الشركة"}`,
      `════════════════════════════════`,
      `التاريخ: ${dateStr}`,
      `وقت البدء: ${startTime}`,
      ``,
      `الحاضرون:`,
      attendees.map((a) => `  • ${a.name} (${a.role})`).join("\n"),
      ``,
      `جدول الأعمال:`,
      agenda.split("\n").map((l) => `  ${l}`).join("\n"),
      ``,
      `ملاحظات الاجتماع:`,
      notes || "  —",
      ``,
      `القرارات:`,
      decisions || "  —",
    ].join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // تحميل كـ .txt
  const downloadMinutes = () => {
    const text = [
      `محضر اجتماع — ${companyName || "الشركة"}`,
      `التاريخ: ${dateStr}   وقت البدء: ${startTime}`,
      ``,
      `الحاضرون: ${attendees.map((a) => a.name).join("، ")}`,
      ``,
      `جدول الأعمال:\n${agenda}`,
      ``,
      `ملاحظات:\n${notes || "—"}`,
      ``,
      `القرارات:\n${decisions || "—"}`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meeting-minutes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(0,20,50,0.55)",
    border: "1px solid rgba(0,180,255,0.25)",
    borderRadius: "8px",
    color: "#e8f4ff",
    fontFamily: "Inter, sans-serif",
    fontSize: "13px",
    padding: "8px 12px",
    resize: "vertical",
    outline: "none",
    direction: "rtl",
    width: "100%",
    boxSizing: "border-box",
    lineHeight: 1.6,
  };

  const labelStyle: React.CSSProperties = {
    color: "#00ccff",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "5px",
    display: "block",
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: "16px",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,5,20,0.72)",
        backdropFilter: "blur(6px)",
        direction: "rtl",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={overlayRef}
        style={{
          width: "min(820px, 96vw)",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "linear-gradient(160deg, rgba(5,15,40,0.97) 0%, rgba(0,10,30,0.97) 100%)",
          border: "1px solid rgba(0,170,255,0.35)",
          borderRadius: "18px",
          boxShadow: "0 0 60px rgba(0,120,255,0.18), inset 0 0 40px rgba(0,50,120,0.08)",
          padding: "28px 32px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#0099cc", letterSpacing: "2px", fontWeight: 700, marginBottom: "4px" }}>
              📋 MEETING MINUTES
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                ...inputStyle,
                fontSize: "20px",
                fontWeight: 700,
                color: "#ffffff",
                background: "transparent",
                border: "none",
                padding: "0",
                width: "360px",
              }}
            />
          </div>
          <div style={{ textAlign: "left", color: "#5588aa", fontSize: "12px", lineHeight: 1.8 }}>
            <div style={{ color: "#00aaff" }}>{dateStr}</div>
            <div>بدأ في: {startTime}</div>
            <div>{companyName || "الشركة"}</div>
          </div>
        </div>

        {/* ── divider ── */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #00aaff55, transparent)", marginBottom: "20px" }} />

        {/* ── Attendees ── */}
        <div style={sectionStyle}>
          <span style={labelStyle}>👥 الحاضرون ({attendees.length})</span>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}>
            {attendees.length === 0 ? (
              <span style={{ color: "#446", fontSize: "12px" }}>لا يوجد حاضرون مسجّلون</span>
            ) : attendees.map((a, i) => (
              <span key={i} style={{
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                background: a.type === "human" ? "rgba(0,200,100,0.15)" : "rgba(0,120,255,0.15)",
                border: `1px solid ${a.type === "human" ? "rgba(0,200,100,0.4)" : "rgba(0,120,255,0.4)"}`,
                color: a.type === "human" ? "#00cc88" : "#44aaff",
              }}>
                {a.type === "human" ? "👤" : "🤖"} {a.name}
                <span style={{ opacity: 0.6, fontWeight: 400, marginRight: "4px" }}> · {a.role}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Agenda ── */}
        <div style={sectionStyle}>
          <label style={labelStyle}>📌 جدول الأعمال</label>
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={4}
            style={inputStyle}
            placeholder="أدخل بنود جدول الأعمال..."
          />
        </div>

        {/* ── Notes ── */}
        <div style={sectionStyle}>
          <label style={labelStyle}>📝 ملاحظات الاجتماع</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            style={inputStyle}
            placeholder="اكتب ملاحظات الاجتماع هنا..."
          />
        </div>

        {/* ── Decisions ── */}
        <div style={sectionStyle}>
          <label style={labelStyle}>✅ القرارات المتخذة</label>
          <textarea
            value={decisions}
            onChange={(e) => setDecisions(e.target.value)}
            rows={4}
            style={inputStyle}
            placeholder="سجّل القرارات والمهام المتفق عليها..."
          />
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-start", marginTop: "8px" }}>
          <button
            onClick={copyMinutes}
            style={{
              padding: "9px 20px",
              borderRadius: "9px",
              border: "1px solid rgba(0,200,255,0.4)",
              background: "rgba(0,140,255,0.18)",
              color: "#44ccff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            📋 نسخ المحضر
          </button>
          <button
            onClick={downloadMinutes}
            style={{
              padding: "9px 20px",
              borderRadius: "9px",
              border: "1px solid rgba(0,200,100,0.4)",
              background: "rgba(0,150,80,0.18)",
              color: "#44dd88",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            ⬇️ تحميل .txt
          </button>
          <button
            onClick={close}
            style={{
              padding: "9px 20px",
              borderRadius: "9px",
              border: "1px solid rgba(255,80,80,0.3)",
              background: "rgba(180,30,30,0.15)",
              color: "#ff7777",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              marginRight: "auto",
            }}
          >
            ✕ إغلاق
          </button>
        </div>

        {/* ── Hint ── */}
        <div style={{ textAlign: "center", color: "#334", fontSize: "10px", marginTop: "14px", letterSpacing: "0.5px" }}>
          اضغط <span style={{ color: "#0088cc", fontWeight: 700 }}>M</span> لفتح/إغلاق المحضر أثناء الاجتماع &nbsp;·&nbsp; <span style={{ color: "#556" }}>ESC</span> للإغلاق
        </div>
      </div>
    </div>
  );
}
