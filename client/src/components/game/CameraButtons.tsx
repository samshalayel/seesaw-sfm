import { useGame } from "@/lib/stores/useGame";

type CamMode = "focus" | "medium" | "top" | "fps";

const MODES: { key: CamMode; letter: string; label: string }[] = [
  { key: "focus",  letter: "T", label: "تركيز" },
  { key: "medium", letter: "Z", label: "متوسط" },
  { key: "top",    letter: "F", label: "جوّي"  },
  { key: "fps",    letter: "👁", label: "أول"   },
];

export function CameraButtons() {
  const cameraMode    = useGame((s) => s.cameraMode);
  const setCameraMode = useGame((s) => s.setCameraMode);
  const phase         = useGame((s) => s.phase);

  if (phase !== "playing") return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "80px",
      right: "16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      zIndex: 100,
      pointerEvents: "auto",
    }}>
      {/* camera icon label */}
      <div style={{
        fontSize: "18px",
        color: "#aac",
        marginBottom: "2px",
        filter: "drop-shadow(0 0 4px #336)",
      }}>📷</div>

      {/* تلميح Ctrl في وضع FPS */}
      {cameraMode === "fps" && (
        <div style={{
          fontSize: "9px",
          color: "#88aacc",
          textAlign: "center",
          lineHeight: 1.4,
          padding: "4px 6px",
          background: "rgba(0,10,30,0.7)",
          borderRadius: "6px",
          border: "1px solid #223",
          backdropFilter: "blur(4px)",
          marginBottom: "2px",
          whiteSpace: "nowrap",
        }}>
          <span style={{ color: "#ffcc44", fontWeight: "bold" }}>Ctrl</span>
          <br />ماوس حر
        </div>
      )}

      {MODES.map(({ key, letter, label }) => {
        const active = cameraMode === key;
        return (
          <button
            key={key}
            onClick={() => setCameraMode(key)}
            title={label}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              border: active ? "2px solid #00aaff" : "1.5px solid #334",
              background: active ? "rgba(0,120,255,0.25)" : "rgba(10,12,20,0.75)",
              color: active ? "#00ccff" : "#8899aa",
              fontSize: "15px",
              fontWeight: "bold",
              fontFamily: "monospace",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              gap: "2px",
              backdropFilter: "blur(6px)",
              boxShadow: active ? "0 0 12px #00aaff55" : "none",
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: "16px", fontWeight: 700 }}>{letter}</span>
            <span style={{ fontSize: "8px", letterSpacing: "0.5px", opacity: 0.8 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
