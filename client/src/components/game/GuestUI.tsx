import { useState } from "react";
import { useGame } from "@/lib/stores/useGame";

export function GuestUI() {
  const phase            = useGame((s) => s.phase);
  const isGuest          = useGame((s) => s.isGuest);
  const openMeetingMinutes = useGame((s) => s.openMeetingMinutes);
  const openAgoraMeeting   = useGame((s) => s.openAgoraMeeting);
  const [expanded, setExpanded] = useState(false);

  if (phase !== "playing" || !isGuest) return null;

  const btn = (accent: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "10px",
    padding: "10px 14px",
    background: `rgba(${accent}, 0.12)`,
    border: `1px solid rgba(${accent}, 0.3)`,
    borderRadius: "12px",
    color: "white", fontSize: "13px", fontWeight: "600",
    cursor: "pointer", width: "100%",
    textAlign: "right", direction: "rtl",
    transition: "background 0.15s",
  });

  return (
    <div style={{
      position:       "fixed",
      top:            "16px",
      right:          "16px",
      zIndex:         50,
      fontFamily:     "Inter, sans-serif",
      direction:      "rtl",
      background:     "rgba(15, 17, 35, 0.85)",
      backdropFilter: "blur(14px)",
      borderRadius:   "18px",
      border:         "1px solid rgba(255,255,255,0.08)",
      boxShadow:      "0 8px 32px rgba(0,0,0,0.45)",
      overflow:       "hidden",
      minWidth:       "56px",
      transition:     "all 0.25s",
    }}>

      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "center",
          gap: "10px", padding: expanded ? "14px 18px 10px" : "14px 18px",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{ fontSize: "20px" }}>👁</span>
        {expanded && (
          <span style={{ color: "white", fontWeight: 700, fontSize: "13px", flex: 1 }}>
            وضع المشاهدة
          </span>
        )}
        {expanded && (
          <span style={{
            background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
            borderRadius: "20px", padding: "2px 9px",
            fontSize: "10px", color: "#6ee7b7", fontWeight: 700,
          }}>ضيف</span>
        )}
        <span style={{
          color: "rgba(255,255,255,0.4)", fontSize: "11px",
          transition: "transform 0.2s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        }}>▾</span>
      </div>

      {/* Body */}
      {expanded && (
        <>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "0 14px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 14px 14px" }}>

            {/* محضر الاجتماع */}
            <button
              style={btn("0, 210, 140")}
              onClick={openMeetingMinutes}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,210,140,0.22)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,210,140,0.12)"; }}
            >
              <span style={{ fontSize: "16px" }}>📋</span>
              <span style={{ flex: 1 }}>محضر الاجتماع</span>
              <span style={{ fontSize: "9px", opacity: 0.6 }}>عرض</span>
            </button>

            {/* اجتماع مرئي */}
            <button
              style={btn("0, 150, 255")}
              onClick={openAgoraMeeting}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,150,255,0.22)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,150,255,0.12)"; }}
            >
              <span style={{ fontSize: "16px" }}>📹</span>
              <span style={{ flex: 1 }}>اجتماع مرئي</span>
              <span style={{ fontSize: "9px", opacity: 0.6 }}>عرض</span>
            </button>

          </div>

          {/* تلميح */}
          <div style={{
            padding: "8px 14px 12px",
            fontSize: "11px", color: "rgba(255,255,255,0.3)",
            textAlign: "center", direction: "rtl",
          }}>
            وضع مشاهدة فقط · لا يمكن التفاعل مع الروبوتات
          </div>
        </>
      )}
    </div>
  );
}
