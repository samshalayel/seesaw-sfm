import { useEffect, useState } from "react";
import { useGame } from "@/lib/stores/useGame";

const BASE_URL = "https://seesaw.sillar.us";

export function HumanOverlay() {
  const isOpen = useGame((s) => s.humanOverlayOpen);
  const close  = useGame((s) => s.closeHumanOverlay);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  // عند الفتح — اجلب الـ API key واستخدمه للدخول التلقائي
  useEffect(() => {
    if (!isOpen) { setIframeUrl(null); return; }
    const roomId = localStorage.getItem("roomId") || "default";
    fetch("/api/sfm-key", { headers: { "x-room-id": roomId } })
      .then((r) => r.json())
      .then((data) => {
        if (data.apiKey && data.apiKey !== "••••••••") {
          setIframeUrl(`${BASE_URL}/auth/api-login?key=${encodeURIComponent(data.apiKey)}`);
        } else {
          setIframeUrl(""); // لا يوجد مفتاح
        }
      })
      .catch(() => setIframeUrl(""));
  }, [isOpen]);

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
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.85)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#060f20", borderBottom: "2px solid #22d3ee", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "#22d3ee" }}>🌐</span>
          <span style={{ color: "#a0b8d0", fontSize: 13, fontFamily: "monospace" }}>{BASE_URL}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            onClick={() => window.open(iframeUrl, "_blank")}
            title="فتح في نافذة جديدة"
            style={{ color: "#64748b", fontSize: 13, cursor: "pointer" }}
          >↗</span>
          <button
            onClick={close}
            style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "4px 14px", cursor: "pointer", fontSize: 13, fontFamily: "monospace" }}
          >
            ✕ إغلاق (F / Esc)
          </button>
        </div>
      </div>

      {/* iframe أو رسالة الإعداد */}
      {iframeUrl === null ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 }}>
          جاري التحميل...
        </div>
      ) : iframeUrl === "" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <span style={{ fontSize: 40 }}>🔑</span>
          <p style={{ color: "#94a3b8", fontSize: 15, textAlign: "center", margin: 0 }}>
            لم يتم ربط حساب Sillar SFM بعد
          </p>
          <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", margin: 0 }}>
            افتح اعدادات الخزنة ← تاب 🌐 Sillar ← أدخل الـ API key واحفظ
          </p>
          <button
            onClick={() => window.open(`${BASE_URL}/settings/api`, "_blank")}
            style={{ background: "#0f172a", border: "1px solid #22d3ee", color: "#22d3ee", borderRadius: 6, padding: "8px 20px", cursor: "pointer", fontSize: 13 }}
          >
            الحصول على API Key ↗
          </button>
        </div>
      ) : (
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          style={{ flex: 1, border: "none", width: "100%", background: "#000" }}
          allow="fullscreen"
          title="Seesaw Platform"
        />
      )}
    </div>
  );
}
