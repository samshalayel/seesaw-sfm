import { useEffect, useState } from "react";

const CP_URL = "https://cp.sillar.us";

export function CpOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // تجاهل لو المستخدم يكتب في input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // if (e.code === "KeyC") {
      //   setOpen((prev) => !prev);
      // }
      if (open && (e.key === "Escape")) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.85)" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: "#060f20",
        borderBottom: "2px solid #a78bfa", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🖥️</span>
          <span style={{ color: "#a0b8d0", fontSize: 13, fontFamily: "monospace" }}>{CP_URL}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            onClick={() => window.open(CP_URL, "_blank")}
            title="فتح في نافذة جديدة"
            style={{ color: "#64748b", fontSize: 13, cursor: "pointer" }}
          >↗</span>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "transparent", border: "1px solid #334155",
              color: "#94a3b8", borderRadius: 6, padding: "4px 14px",
              cursor: "pointer", fontSize: 13, fontFamily: "monospace",
            }}
          >
            ✕ إغلاق (C / Esc)
          </button>
        </div>
      </div>

      {/* iframe */}
      <iframe
        src={CP_URL}
        style={{ flex: 1, border: "none", width: "100%", background: "#000" }}
        allow="fullscreen"
        title="Control Panel"
      />
    </div>
  );
}
