import { useEffect } from "react";
import { useGame } from "@/lib/stores/useGame";

const SITE_URL = "https://seesaw.sillar.us";

export function HumanOverlay() {
  const isOpen = useGame((s) => s.humanOverlayOpen);
  const close  = useGame((s) => s.closeHumanOverlay);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "f" || e.key === "F") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.85)",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "#060f20",
          borderBottom: "2px solid #22d3ee",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "#22d3ee" }}>🌐</span>
          <span style={{ color: "#a0b8d0", fontSize: 13, fontFamily: "monospace" }}>
            {SITE_URL}
          </span>
        </div>
        <button
          onClick={close}
          style={{
            background: "transparent",
            border: "1px solid #334155",
            color: "#94a3b8",
            borderRadius: 6,
            padding: "4px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "monospace",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444";
            (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#334155";
            (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
          }}
        >
          ✕ إغلاق (F / Esc)
        </button>
      </div>

      {/* iframe */}
      <iframe
        src={SITE_URL}
        style={{
          flex: 1,
          border: "none",
          width: "100%",
          background: "#000",
        }}
        allow="fullscreen"
        title="Seesaw Platform"
      />
    </div>
  );
}
