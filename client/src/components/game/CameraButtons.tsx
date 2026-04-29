import { useState } from "react";
import { useGame, getModelRobotPosition, getRoomSlot } from "@/lib/stores/useGame";

type CamMode = "focus" | "medium" | "top" | "fps" | "city" | "overview";

const MODES: { key: CamMode; letter: string; label: string }[] = [
  { key: "focus",  letter: "T", label: "تركيز" },
  { key: "medium", letter: "Z", label: "متوسط" },
  { key: "top",    letter: "F", label: "جوّي"  },
  { key: "fps",    letter: "👁", label: "أول"   },
  { key: "city",   letter: "🏙", label: "مدينة" },
];

const ROOM_LABELS: Record<string, string> = {
  main:    "الصالة الرئيسية",
  manager: "غرفة المدير",
  stage0:  "S1",
  stage1:  "S2",
  brA:     "BR-A",
  brB:     "BR-B",
  brC:     "BR-C",
  hall:    "القاعة",
};

export function CameraButtons() {
  const cameraMode        = useGame((s) => s.cameraMode);
  const setCameraMode     = useGame((s) => s.setCameraMode);
  const resetCamera       = useGame((s) => s.resetCamera);
  const phase             = useGame((s) => s.phase);
  const models            = useGame((s) => s.models);
  const setTeleportTarget = useGame((s) => s.setTeleportTarget);
  const [showModes,  setShowModes]  = useState(false);
  const [showRobots, setShowRobots] = useState(false);

  if (phase !== "playing") return null;

  const isOverview = cameraMode === "overview";
  const modeActive = MODES.some(m => m.key === cameraMode);

  // ── حساب موضع الوقوف + نقطة النظر لكل روبوت ────────────────────────────────
  const roomCounter: Record<string, number> = {};
  const allRobots: Array<{
    id: string; label: string; room: string;
    standX: number; standZ: number;
    lookAtX: number; lookAtZ: number;
  }> = [];

  for (const m of models) {
    const room    = m.roomAssignment || "main";
    const slotIdx = roomCounter[room] ?? 0;
    roomCounter[room] = slotIdx + 1;

    let standX: number, standZ: number, lookAtX: number, lookAtZ: number;

    if (room === "main") {
      // روبوت الصالة: يواجه +X (HALF_PI)
      // الروبوت عند x=-6.8، المكتب عند x=-5.5
      // نقف على x=-4.2 (1.3 وحدة أمام المكتب في نفس الاتجاه)، نتطلع للروبوت
      const [rx,, rz] = getModelRobotPosition(m.index);
      standX  = rx + 2.6;   // 1.3 أمام المكتب (desk.x=-5.5 → stand=-4.2، أو -6.8+2.6=-4.2)
      standZ  = rz;
      lookAtX = rx;          // نتطلع للروبوت
      lookAtZ = rz;
    } else {
      // الغرف الأخرى — نحسب من بيانات الـ slot الحقيقية
      const slot = getRoomSlot(room, slotIdx);
      const [rx,, rz] = slot.robot;
      const [dx,, dz] = slot.desk;

      // اتجاه من الروبوت إلى المكتب
      const ddx = dx - rx;
      const ddz = dz - rz;
      const len = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
      const nx = ddx / len;
      const nz = ddz / len;

      // نقف 1.8 وحدة خلف المكتب (في نفس اتجاه desk-robot) ونتطلع للروبوت
      standX  = dx + nx * 1.8;
      standZ  = dz + nz * 1.8;
      lookAtX = rx;
      lookAtZ = rz;
    }

    allRobots.push({ id: m.id, label: m.alias || m.name, room, standX, standZ, lookAtX, lookAtZ });
  }

  const smallBtn = (active: boolean): React.CSSProperties => ({
    width: "42px", height: "42px", borderRadius: "10px",
    border: active ? "2px solid #00aaff" : "1.5px solid #334",
    background: active ? "rgba(0,120,255,0.22)" : "rgba(10,12,20,0.75)",
    color: active ? "#00ccff" : "#8899aa",
    cursor: "pointer", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    lineHeight: 1, gap: "2px", backdropFilter: "blur(6px)",
    boxShadow: active ? "0 0 10px #00aaff44" : "none",
    transition: "all 0.15s",
  });

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      right: "16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      zIndex: 100,
    }}>

      {/* ── لوحة الروبوتات ── */}
      {showRobots && (
        <div style={{
          position: "absolute",
          right: "52px",
          bottom: "0",
          background: "rgba(4,8,20,0.96)",
          border: "1.5px solid #00334d",
          borderRadius: "12px",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          minWidth: "175px",
          maxHeight: "340px",
          overflowY: "auto",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 28px #00000099",
        }}>
          <div style={{
            fontSize: "11px", color: "#4488aa", marginBottom: "2px",
            textAlign: "right", direction: "rtl", fontWeight: 600,
            borderBottom: "1px solid #00334d", paddingBottom: "6px",
          }}>
            🤖 قائمة الروبوتات
          </div>

          {allRobots.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#334455", textAlign: "center", padding: "8px 0" }}>
              لا يوجد روبوتات مضافة
            </div>
          ) : (
            allRobots.map(r => (
              <button
                key={r.id}
                onClick={() => { setCameraMode("focus"); setTeleportTarget({ x: r.standX, z: r.standZ, lookAtX: r.lookAtX, lookAtZ: r.lookAtZ }); setShowRobots(false); }}
                style={{
                  background: "rgba(0,40,80,0.55)",
                  border: "1px solid #003355",
                  borderRadius: "8px",
                  color: "#77bbdd",
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "right",
                  direction: "rtl",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1px",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(0,80,160,0.55)";
                  el.style.color = "#aaeeff";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(0,40,80,0.55)";
                  el.style.color = "#77bbdd";
                }}
              >
                <span>🤖 {r.label}</span>
                {r.room !== "main" && (
                  <span style={{ fontSize: "10px", color: "#446677", marginTop: "1px" }}>
                    {ROOM_LABELS[r.room] ?? r.room}
                  </span>
                )}
              </button>
            ))
          )}

          {/* زر نظرة عامة */}
          <button
            onClick={() => { setCameraMode("overview"); setShowRobots(false); }}
            style={{
              marginTop: "4px",
              background: "rgba(30,18,0,0.55)",
              border: "1px solid #554400",
              borderRadius: "8px",
              color: "#ffcc44",
              padding: "7px 10px",
              cursor: "pointer",
              fontSize: "12px",
              textAlign: "right",
              direction: "rtl",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(80,50,0,0.55)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(30,18,0,0.55)"; }}
          >
            🏢 نظرة عامة على الصالة
          </button>
        </div>
      )}

      {/* ── أزرار أوضاع الكاميرا ── */}
      {showModes && MODES.map(({ key, letter, label }) => {
        const active = cameraMode === key;
        return (
          <button key={key} onClick={() => setCameraMode(key)} title={label} style={smallBtn(active)}>
            <span style={{ fontSize: "15px", fontWeight: 700 }}>{letter}</span>
            <span style={{ fontSize: "8px", opacity: 0.8 }}>{label}</span>
          </button>
        );
      })}

      {/* ── زر مسقط رأسي ── */}
      <button
        onClick={() => setCameraMode(isOverview ? "focus" : "overview")}
        title="مسقط رأسي"
        style={{
          width: "42px", height: "42px", borderRadius: "10px",
          border: isOverview ? "2px solid #ffcc00" : "1.5px solid #554400",
          background: isOverview ? "rgba(255,200,0,0.22)" : "rgba(20,14,0,0.78)",
          color: isOverview ? "#ffdd33" : "#aa8800",
          cursor: "pointer", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          lineHeight: 1, gap: "2px", backdropFilter: "blur(6px)",
          boxShadow: isOverview ? "0 0 12px #ffcc0055" : "none",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: "18px" }}>🏢</span>
        <span style={{ fontSize: "8px", opacity: 0.85 }}>مسقط</span>
      </button>

      {/* ── زر الروبوتات / مركز ── */}
      <button
        onClick={() => { resetCamera(); setShowRobots(v => !v); setShowModes(false); }}
        title="قائمة الروبوتات"
        style={{
          width: "42px", height: "42px", borderRadius: "10px",
          border: showRobots ? "2px solid #00aaff" : "1.5px solid #003355",
          background: showRobots ? "rgba(0,80,180,0.28)" : "rgba(0,18,45,0.78)",
          color: showRobots ? "#44ccff" : "#44aaff",
          cursor: "pointer", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          lineHeight: 1, gap: "2px", backdropFilter: "blur(6px)",
          boxShadow: showRobots ? "0 0 10px #0088ff44" : "none",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: "18px" }}>🎯</span>
        <span style={{ fontSize: "8px", opacity: 0.85 }}>مركز</span>
      </button>

      {/* ── زر فتح/إغلاق أوضاع الكاميرا ── */}
      <button
        onClick={() => { setShowModes(v => !v); setShowRobots(false); }}
        title="أوضاع الكاميرا"
        style={{
          width: "42px", height: "42px", borderRadius: "10px",
          border: (showModes || modeActive) ? "1.5px solid #336677" : "1.5px solid #223",
          background: showModes ? "rgba(0,80,100,0.35)" : "rgba(8,10,18,0.72)",
          color: showModes ? "#66ccdd" : "#556677",
          cursor: "pointer", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          lineHeight: 1, gap: "2px", backdropFilter: "blur(6px)",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: "18px" }}>📷</span>
        <span style={{ fontSize: "8px", opacity: 0.8 }}>{showModes ? "إغلاق" : "عدسة"}</span>
      </button>

    </div>
  );
}
