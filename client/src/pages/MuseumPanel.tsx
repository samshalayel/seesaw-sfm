/**
 * MuseumPanel.tsx
 * لوحة تحكم بسيطة لتخصيص صور جدران المتحف
 * متاحة على /museum-panel
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "museum:wall-photos";
const MAX_SLOTS = 8;

const defaultSlots: string[] = Array(MAX_SLOTS).fill("");

function loadSlots(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...defaultSlots];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...defaultSlots];
    // ensure length
    const padded = [...arr];
    while (padded.length < MAX_SLOTS) padded.push("");
    return padded.slice(0, MAX_SLOTS);
  } catch {
    return [...defaultSlots];
  }
}

function saveSlots(slots: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

function encodeToHash(slots: string[]): string {
  try {
    return "#" + btoa(unescape(encodeURIComponent(JSON.stringify(slots))));
  } catch {
    return "";
  }
}

function decodeFromHash(hash: string): string[] | null {
  try {
    if (!hash || hash.length < 2) return null;
    const raw = decodeURIComponent(escape(atob(hash.slice(1))));
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const padded = [...arr];
    while (padded.length < MAX_SLOTS) padded.push("");
    return padded.slice(0, MAX_SLOTS);
  } catch {
    return null;
  }
}

const SLOT_LABELS = ["جدار الشمال — صورة 1","جدار الشمال — صورة 2","جدار الشرق — صورة 1","جدار الشرق — صورة 2","جدار الشرق — صورة 3","جدار الشرق — صورة 4","جدار الغرب — صورة 1","جدار الغرب — صورة 2"];

export default function MuseumPanel() {
  const [slots, setSlots] = useState<string[]>(loadSlots);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState("");

  // load from URL hash on mount (shared link)
  useEffect(() => {
    const fromHash = decodeFromHash(window.location.hash);
    if (fromHash) {
      setSlots(fromHash);
      saveSlots(fromHash);
    }
  }, []);

  const update = (i: number, val: string) => {
    setSlots(prev => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    saveSlots(slots);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSlots([...defaultSlots]);
    saveSlots([...defaultSlots]);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleCopyLink = () => {
    const url = window.location.origin + "/museum-panel" + encodeToHash(slots);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filledCount = slots.filter(s => s.trim()).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d14",
      color: "#e0e8ff",
      fontFamily: "Inter, system-ui, sans-serif",
      direction: "rtl",
    }}>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "18px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🏛️</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>MUSEUM PANEL</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>لوحة تحكم صور الجدران</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/" style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.5)", padding: "6px 14px", borderRadius: 8,
            cursor: "pointer", fontSize: 12, textDecoration: "none", letterSpacing: 1,
          }}>← المكتب</a>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>

        {/* Status bar */}
        <div style={{
          background: "rgba(79,195,247,0.07)",
          border: "1px solid rgba(79,195,247,0.2)",
          borderRadius: 12, padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 28,
        }}>
          <div style={{ fontSize: 13, color: "#4fc3f7" }}>
            {filledCount === 0
              ? "⚡ الجدران تعرض صور ويكيبيديا (الوضع الافتراضي)"
              : `🖼️ ${filledCount} صورة مخصصة محددة`}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            مخزنة محلياً · تُطبَّق فوراً عند فتح المتحف
          </div>
        </div>

        {/* Slots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
          {slots.map((url, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${url.trim() ? "rgba(79,195,247,0.3)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 10, padding: "14px 16px",
              display: "flex", gap: 14, alignItems: "center",
            }}>
              {/* thumbnail */}
              <div style={{
                width: 56, height: 56, borderRadius: 8, flexShrink: 0,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {url.trim() ? (
                  <img
                    src={url.trim()}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                  />
                ) : (
                  <span style={{ fontSize: 20, opacity: 0.3 }}>🖼️</span>
                )}
              </div>

              {/* input */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 1 }}>
                  {SLOT_LABELS[i]}
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={e => update(i, e.target.value)}
                  placeholder="https://... رابط الصورة"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6, padding: "8px 12px",
                    color: "#e0e8ff", fontSize: 12,
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(79,195,247,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              {/* clear */}
              {url.trim() && (
                <button
                  onClick={() => update(i, "")}
                  style={{
                    background: "none", border: "none", color: "rgba(255,255,255,0.3)",
                    cursor: "pointer", fontSize: 18, padding: "4px", flexShrink: 0,
                  }}
                  title="مسح"
                >×</button>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1, minWidth: 140,
              background: saved ? "rgba(0,255,136,0.15)" : "rgba(79,195,247,0.15)",
              border: `1px solid ${saved ? "rgba(0,255,136,0.4)" : "rgba(79,195,247,0.4)"}`,
              color: saved ? "#00ff88" : "#4fc3f7",
              padding: "12px 20px", borderRadius: 10,
              cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: 1,
              transition: "all 0.2s",
            }}
          >
            {saved ? "✅ تم الحفظ" : "💾 حفظ التغييرات"}
          </button>

          <button
            onClick={handleCopyLink}
            style={{
              flex: 1, minWidth: 140,
              background: copied ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${copied ? "rgba(0,255,136,0.4)" : "rgba(255,255,255,0.15)"}`,
              color: copied ? "#00ff88" : "rgba(255,255,255,0.6)",
              padding: "12px 20px", borderRadius: 10,
              cursor: "pointer", fontSize: 14, letterSpacing: 1,
              transition: "all 0.2s",
            }}
          >
            {copied ? "✅ تم النسخ" : "🔗 نسخ الرابط للمشاركة"}
          </button>

          <button
            onClick={handleReset}
            style={{
              background: "rgba(255,80,80,0.08)",
              border: "1px solid rgba(255,80,80,0.2)",
              color: "rgba(255,120,120,0.7)",
              padding: "12px 20px", borderRadius: 10,
              cursor: "pointer", fontSize: 13, letterSpacing: 1,
              transition: "all 0.2s",
            }}
          >
            🔄 إعادة تعيين
          </button>
        </div>

        <div style={{
          marginTop: 32, padding: "16px 20px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, fontSize: 12,
          color: "rgba(255,255,255,0.3)", lineHeight: 1.8,
        }}>
          <strong style={{ color: "rgba(255,255,255,0.5)" }}>كيف يعمل:</strong><br />
          ① أضف روابط الصور في الحقول أعلاه → ② اضغط "حفظ" → ③ افتح المتحف — الصور ستظهر على الجدران بدل صور ويكيبيديا.<br />
          اتركها فارغة لتعود للصور التلقائية من ويكيبيديا. · رابط المشاركة يحمل إعداداتك مشفرة.
        </div>
      </div>
    </div>
  );
}
