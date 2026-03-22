import { useState, useRef, useEffect } from "react";
import { useGame } from "@/lib/stores/useGame";
import { apiFetch } from "@/lib/utils";

export function ManagerKeypadOverlay() {
  const isOpen = useGame((s) => s.managerKeypadOpen);
  const closeKeypad = useGame((s) => s.closeManagerKeypad);
  const unlockDoor = useGame((s) => s.unlockManagerDoor);

  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [checking, setChecking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      containerRef.current?.focus();
      setCode("");
      setError(false);
      setUnlocking(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    if (unlocking || checking) return;
    setError(false);

    const newCode = code + digit;
    if (newCode.length <= 4) {
      setCode(newCode);

      if (newCode.length === 4) {
        setChecking(true);
        try {
          const res = await apiFetch("/api/auth/verify-manager-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: newCode }),
          });
          const data = await res.json();

          if (data.success) {
            setUnlocking(true);
            setTimeout(() => {
              unlockDoor();
              closeKeypad();
              setUnlocking(false);
            }, 500);
          } else {
            setError(true);
            setTimeout(() => {
              setCode("");
              setError(false);
            }, 800);
          }
        } catch {
          setError(true);
          setTimeout(() => {
            setCode("");
            setError(false);
          }, 800);
        } finally {
          setChecking(false);
        }
      }
    }
  };

  const handleClear = () => {
    if (unlocking || checking) return;
    setCode("");
    setError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= "0" && e.key <= "9") {
      handleDigit(e.key);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      handleClear();
    } else if (e.key === "Escape") {
      closeKeypad();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        width: "100vw",
        height: "100vh",
        background: "#1a1520",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, #1e1a2e 0%, #2a2035 25%, #1a1520 50%, #251e30 75%, #1e1a2e 100%)",
        }} />

        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "120px",
          background: "linear-gradient(to bottom, rgba(60,50,80,0.4), transparent)",
        }} />

        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "80px",
          background: "linear-gradient(to top, rgba(20,15,25,0.8), transparent)",
        }} />

        {[...Array(5)].map((_, i) => (
          <div key={`h-${i}`} style={{
            position: "absolute",
            left: 0, right: 0,
            top: `${18 + i * 16}%`,
            height: "1px",
            background: "linear-gradient(to right, transparent 5%, rgba(120,100,150,0.12) 20%, rgba(120,100,150,0.12) 80%, transparent 95%)",
          }} />
        ))}

        {[...Array(3)].map((_, i) => (
          <div key={`v-${i}`} style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: `${25 + i * 25}%`,
            width: "1px",
            background: "linear-gradient(to bottom, transparent 10%, rgba(120,100,150,0.08) 30%, rgba(120,100,150,0.08) 70%, transparent 90%)",
          }} />
        ))}

        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px", height: "500px",
          background: "radial-gradient(ellipse, rgba(196,164,74,0.06) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />

        {[...Array(6)].map((_, i) => (
          <div key={`dot-${i}`} style={{
            position: "absolute",
            top: `${15 + Math.sin(i * 1.2) * 30 + 20}%`,
            left: `${10 + i * 15}%`,
            width: "3px", height: "3px",
            background: "rgba(196,164,74,0.15)",
            borderRadius: "50%",
          }} />
        ))}

        <div style={{
          position: "absolute",
          top: "15px", left: "50%", transform: "translateX(-50%)",
          width: "60%", height: "3px",
          background: "linear-gradient(to right, transparent, rgba(196,164,74,0.15), transparent)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "15px", left: "50%", transform: "translateX(-50%)",
          width: "40%", height: "2px",
          background: "linear-gradient(to right, transparent, rgba(196,164,74,0.1), transparent)",
        }} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}>
          <div style={{
            width: "60px", height: "60px",
            borderRadius: "50%",
            border: "2px solid #c4a44a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(196,164,74,0.08)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4a44a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div style={{
            color: "#c4a44a",
            fontSize: "16px",
            fontWeight: "bold",
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontFamily: "Inter, sans-serif",
            textShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}>
            General Manager
          </div>
          <div style={{
            color: "#776a50",
            fontSize: "10px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            fontFamily: "monospace",
          }}>
            Security Access
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(145deg, rgba(30,26,46,0.95), rgba(22,20,35,0.95))",
            borderRadius: "14px",
            padding: "22px 20px",
            border: "1px solid rgba(196,164,74,0.25)",
            boxShadow: "0 0 40px rgba(0,0,0,0.6), 0 0 80px rgba(196,164,74,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", gap: "8px", marginBottom: "2px" }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: "22px",
                  height: "26px",
                  borderBottom: `2px solid ${error ? "#ef4444" : code.length > i ? "#c4a44a" : "#444"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: error ? "#ef4444" : "#c4a44a",
                  fontSize: "18px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  transition: "all 0.2s",
                }}
              >
                {code[i] ? "\u25CF" : ""}
              </div>
            ))}
          </div>

          {checking && (
            <div style={{ color: "#c4a44a", fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px" }}>
              VERIFYING...
            </div>
          )}

          {error && (
            <div style={{ color: "#ef4444", fontSize: "11px", fontFamily: "monospace" }}>
              ACCESS DENIED
            </div>
          )}

          {unlocking && (
            <div style={{ color: "#4ade80", fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px" }}>
              ACCESS GRANTED
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
            }}
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "C"].map(
              (key) =>
                key === "" ? (
                  <div key="empty" />
                ) : (
                  <button
                    key={key}
                    onClick={() => (key === "C" ? handleClear() : handleDigit(key))}
                    disabled={checking || unlocking}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "10px",
                      border: "1px solid " + (key === "C" ? "rgba(239,68,68,0.3)" : "rgba(196,164,74,0.2)"),
                      background: key === "C" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                      color: key === "C" ? "#ef4444" : "#c4a44a",
                      fontSize: "18px",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      cursor: (checking || unlocking) ? "not-allowed" : "pointer",
                      opacity: (checking || unlocking) ? 0.5 : 1,
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = key === "C" ? "rgba(239,68,68,0.25)" : "rgba(196,164,74,0.15)";
                      e.currentTarget.style.borderColor = key === "C" ? "#ef4444" : "#c4a44a";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = key === "C" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)";
                      e.currentTarget.style.borderColor = key === "C" ? "rgba(239,68,68,0.3)" : "rgba(196,164,74,0.2)";
                    }}
                  >
                    {key}
                  </button>
                )
            )}
          </div>
        </div>
      </div>

      {!unlocking && (
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            left: "50%",
            transform: "translateX(-50%)",
            color: "#776a50",
            fontSize: "13px",
            fontFamily: "Inter, sans-serif",
            direction: "rtl",
            letterSpacing: "1px",
          }}
        >
          {"أدخل رمز الدخول  ·  ESC للرجوع"}
        </div>
      )}
    </div>
  );
}
