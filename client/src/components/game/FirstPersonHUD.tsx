import { useEffect, useState } from "react";

/**
 * HUD overlay for first-person mode.
 * Detects pointer-lock state to show/hide the crosshair and hint.
 */
export function FirstPersonHUD() {
  const [isFPS, setIsFPS] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFPS(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  return (
    <>
      {/* ── Crosshair (visible only in FPS mode) ── */}
      {isFPS && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <div style={{ position: "relative", width: 24, height: 24 }}>
            {/* Horizontal bar */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 2,
                marginTop: -1,
                background: "rgba(255,255,255,0.9)",
                borderRadius: 1,
                boxShadow: "0 0 4px rgba(0,0,0,0.8)",
              }}
            />
            {/* Vertical bar */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: 2,
                marginLeft: -1,
                background: "rgba(255,255,255,0.9)",
                borderRadius: 1,
                boxShadow: "0 0 4px rgba(0,0,0,0.8)",
              }}
            />
            {/* Center dot */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 4,
                height: 4,
                marginTop: -2,
                marginLeft: -2,
                background: "rgba(255,255,255,1)",
                borderRadius: "50%",
                boxShadow: "0 0 4px rgba(0,0,0,0.8)",
              }}
            />
          </div>
        </div>
      )}

      {/* ── FPS mode badge (top-center) ── */}
      {isFPS && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
            padding: "4px 14px",
            borderRadius: 20,
            pointerEvents: "none",
            zIndex: 50,
            letterSpacing: "0.05em",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          🎮 منظور أول · اضغط <kbd style={{ background: "rgba(255,255,255,0.15)", padding: "1px 5px", borderRadius: 4 }}>V</kbd> أو <kbd style={{ background: "rgba(255,255,255,0.15)", padding: "1px 5px", borderRadius: 4 }}>Esc</kbd> للخروج
        </div>
      )}

      {/* ── Hint (bottom-right, only in third-person) ── */}
      {!isFPS && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
            padding: "5px 12px",
            borderRadius: 12,
            pointerEvents: "none",
            zIndex: 50,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          اضغط <kbd style={{ background: "rgba(255,255,255,0.12)", padding: "1px 5px", borderRadius: 4 }}>V</kbd> للمنظور الأول
        </div>
      )}
    </>
  );
}
