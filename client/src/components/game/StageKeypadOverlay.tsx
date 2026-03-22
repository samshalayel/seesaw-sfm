import { useState, useRef, useEffect } from "react";
import { useGame } from "@/lib/stores/useGame";
import { apiFetch } from "@/lib/utils";

/**
 * StageKeypadOverlay — keypad for all locked doors.
 * Default code: 0000 (verified server-side via /api/auth/verify-stage-code)
 */
export function StageKeypadOverlay() {
  const stage0Open   = useGame((s) => s.stage0KeypadOpen);
  const stage1Open   = useGame((s) => s.stage1KeypadOpen);
  const hallOpen     = useGame((s) => s.hallDoorKeypadOpen);
  const hall2Open    = useGame((s) => s.hall2DoorKeypadOpen);
  const brAOpen      = useGame((s) => s.brAKeypadOpen);
  const brBOpen      = useGame((s) => s.brBKeypadOpen);
  const brCOpen      = useGame((s) => s.brCKeypadOpen);

  const closeStage0  = useGame((s) => s.closeStage0Keypad);
  const closeStage1  = useGame((s) => s.closeStage1Keypad);
  const closeHall    = useGame((s) => s.closeHallKeypad);
  const closeHall2   = useGame((s) => s.closeHall2Keypad);
  const closeBrA     = useGame((s) => s.closeBrAKeypad);
  const closeBrB     = useGame((s) => s.closeBrBKeypad);
  const closeBrC     = useGame((s) => s.closeBrCKeypad);

  const unlockStage0 = useGame((s) => s.unlockStage0Door);
  const unlockStage1 = useGame((s) => s.unlockStage1Door);
  const unlockHall   = useGame((s) => s.unlockHallDoor);
  const unlockHall2  = useGame((s) => s.unlockHall2Door);
  const unlockBrA    = useGame((s) => s.unlockBrADoor);
  const unlockBrB    = useGame((s) => s.unlockBrBDoor);
  const unlockBrC    = useGame((s) => s.unlockBrCDoor);

  const isOpen = stage0Open || stage1Open || hallOpen || hall2Open || brAOpen || brBOpen || brCOpen;

  const doorId = stage0Open ? "stage0"
    : stage1Open ? "stage1"
    : hallOpen   ? "hall"
    : hall2Open  ? "hall2"
    : brAOpen    ? "brA"
    : brBOpen    ? "brB"
    : "brC";

  const accentColor = stage0Open ? "#4fc3f7"
    : stage1Open ? "#a855f7"
    : hallOpen   ? "#00c8d4"
    : hall2Open  ? "#c4a44a"
    : brAOpen    ? "#f59e0b"
    : brBOpen    ? "#a855f7"
    : "#10b981";

  const doorLabel = stage0Open ? "Stage 1 — Product Shaping"
    : stage1Open ? "Stage 2 — Architecture"
    : hallOpen   ? "Production Hall"
    : hall2Open  ? "Production Hall — Manager Side"
    : brAOpen    ? "Stage 4 — Observability"
    : brBOpen    ? "Stage 5 — Reproducibility"
    : "Stage 6 — Production Ready";

  const close = stage0Open ? closeStage0
    : stage1Open ? closeStage1
    : hallOpen   ? closeHall
    : hall2Open  ? closeHall2
    : brAOpen    ? closeBrA
    : brBOpen    ? closeBrB
    : closeBrC;

  const unlock = stage0Open ? unlockStage0
    : stage1Open ? unlockStage1
    : hallOpen   ? unlockHall
    : hall2Open  ? unlockHall2
    : brAOpen    ? unlockBrA
    : brBOpen    ? unlockBrB
    : unlockBrC;

  const bgGradient = stage0Open
    ? "linear-gradient(135deg, #061018 0%, #0a1e2e 50%, #061018 100%)"
    : (stage1Open || brBOpen)
    ? "linear-gradient(135deg, #0d0618 0%, #180a28 50%, #0d0618 100%)"
    : (hallOpen || hall2Open)
    ? "linear-gradient(135deg, #001a1b 0%, #002628 50%, #001a1b 100%)"
    : brAOpen
    ? "linear-gradient(135deg, #1a0d00 0%, #281500 50%, #1a0d00 100%)"
    : "linear-gradient(135deg, #001a0e 0%, #002614 50%, #001a0e 100%)";

  const [code, setCode]         = useState("");
  const [error, setError]       = useState(false);
  const [checking, setChecking] = useState(false);
  const [success, setSuccess]   = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      containerRef.current?.focus();
      setCode("");
      setError(false);
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    if (checking || success) return;
    setError(false);
    const newCode = code + digit;
    if (newCode.length > 4) return;
    setCode(newCode);

    if (newCode.length === 4) {
      setChecking(true);
      try {
        const res  = await apiFetch("/api/auth/verify-stage-code", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ doorId, code: newCode }),
        });
        const data = await res.json();
        if (data.success) {
          unlock();
          setSuccess(true);
          setTimeout(() => {
            close();
            setSuccess(false);
          }, 500);
        } else {
          setError(true);
          setTimeout(() => { setCode(""); setError(false); }, 800);
        }
      } catch {
        setError(true);
        setTimeout(() => { setCode(""); setError(false); }, 800);
      } finally {
        setChecking(false);
      }
    }
  };

  const handleClear = () => {
    if (checking || success) return;
    setCode("");
    setError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
    else if (e.key === "Backspace" || e.key === "Delete") handleClear();
    else if (e.key === "Escape") close();
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#0d1117",
        display: "flex", alignItems: "center", justifyContent: "center",
        outline: "none",
      }}
    >
      {/* bg gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: bgGradient,
      }} />

      {/* center glow */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "400px", height: "400px",
        background: `radial-gradient(ellipse, ${accentColor}0f 0%, transparent 70%)`,
        borderRadius: "50%",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", gap: "22px",
      }}>
        {/* icon + label */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            border: `2px solid ${accentColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${accentColor}14`,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div style={{ color: accentColor, fontSize: "15px", fontWeight: "bold", letterSpacing: "3px", fontFamily: "Inter, sans-serif" }}>
            {doorLabel}
          </div>
          <div style={{ color: "#556", fontSize: "10px", letterSpacing: "2px", fontFamily: "monospace" }}>
            SECURE ACCESS
          </div>
        </div>

        {/* keypad card */}
        <div style={{
          background: "rgba(10,14,22,0.95)",
          borderRadius: "14px",
          padding: "22px 20px",
          border: `1px solid ${accentColor}33`,
          boxShadow: `0 0 40px #0006, 0 0 60px ${accentColor}08`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
          backdropFilter: "blur(10px)",
        }}>
          {/* dots */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "2px" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: "22px", height: "26px",
                borderBottom: `2px solid ${error ? "#ef4444" : code.length > i ? accentColor : "#333"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: error ? "#ef4444" : accentColor,
                fontSize: "18px", fontFamily: "monospace", fontWeight: "bold",
                transition: "all 0.2s",
              }}>
                {code[i] ? "\u25CF" : ""}
              </div>
            ))}
          </div>

          {checking && <div style={{ color: accentColor, fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px" }}>VERIFYING...</div>}
          {error     && <div style={{ color: "#ef4444",   fontSize: "11px", fontFamily: "monospace" }}>ACCESS DENIED</div>}
          {success   && <div style={{ color: "#4ade80",   fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px" }}>ACCESS GRANTED</div>}

          {/* numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {["1","2","3","4","5","6","7","8","9","","0","C"].map((key) =>
              key === "" ? <div key="empty" /> : (
                <button
                  key={key}
                  onClick={() => key === "C" ? handleClear() : handleDigit(key)}
                  disabled={checking || success}
                  style={{
                    width: "48px", height: "48px",
                    borderRadius: "10px",
                    border: `1px solid ${key === "C" ? "rgba(239,68,68,0.3)" : `${accentColor}33`}`,
                    background: key === "C" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    color: key === "C" ? "#ef4444" : accentColor,
                    fontSize: "18px", fontFamily: "monospace", fontWeight: "bold",
                    cursor: (checking || success) ? "not-allowed" : "pointer",
                    opacity: (checking || success) ? 0.5 : 1,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = key === "C" ? "rgba(239,68,68,0.25)" : `${accentColor}22`;
                    e.currentTarget.style.borderColor = key === "C" ? "#ef4444" : accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = key === "C" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = key === "C" ? "rgba(239,68,68,0.3)" : `${accentColor}33`;
                  }}
                >
                  {key}
                </button>
              )
            )}
          </div>
        </div>

        {!success && (
          <div style={{ color: "#445", fontSize: "12px", fontFamily: "Inter, sans-serif", direction: "rtl" }}>
            أدخل رمز الدخول · ESC للرجوع
          </div>
        )}
      </div>
    </div>
  );
}
