import { useState, useRef, useEffect } from "react";
import type { UserInfo } from "@/lib/stores/useGame";
import { setAuthToken, setRoomId } from "../../lib/utils";

interface DoorEntryProps {
  onUnlock: (user: UserInfo) => void;
}

export function DoorEntry({ onUnlock }: DoorEntryProps) {
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [isRegister,setIsRegister]= useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { containerRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unlocking || loading) return;
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const res  = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) setAuthToken(data.token);
        setRoomId(data.roomId);
        setUnlocking(true);
        // بعد animation الباب (1.8s) نفتح الغرفة
        setTimeout(() => {
          onUnlock({ id: data.roomId, username: data.user.username, roomId: data.roomId });
        }, 1800);
      } else {
        setError(data.error || "Authentication failed");
        setLoading(false);
      }
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSubmit(e); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        background: "rgba(10, 8, 20, 0.72)",
        backdropFilter: "blur(3px)",
      }}
    >
      {/* خطوط الخلفية */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: 0, right: 0,
            top: `${18 + i * 16}%`, height: "1px",
            background: "linear-gradient(to right, transparent 5%, rgba(196,164,74,0.07) 30%, rgba(196,164,74,0.07) 70%, transparent 95%)",
          }} />
        ))}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "700px", height: "700px",
          background: "radial-gradient(ellipse, rgba(196,164,74,0.05) 0%, transparent 65%)",
          borderRadius: "50%",
        }} />
      </div>

      {/* الحاوية الرئيسية: باب + فورم */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0px",
        position: "relative",
        zIndex: 1,
        height: "70vh",
      }}>

        {/* ── الباب ─────────────────────────────────────────────── */}
        <div style={{
          position: "relative",
          height: "100%",
          transition: unlocking ? "transform 1.4s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          transformOrigin: "left center",
          transform: unlocking
            ? "perspective(1400px) rotateY(75deg)"
            : "perspective(1400px) rotateY(0deg)",
        }}>
          {/* إطار الباب */}
          <div style={{
            position: "absolute",
            top: "-10px", left: "-10px", right: "-10px", bottom: "-10px",
            border: "2px solid rgba(196,164,74,0.3)",
            borderRadius: "4px",
            boxShadow: unlocking
              ? "0 0 40px rgba(196,164,74,0.4), inset 0 0 30px rgba(196,164,74,0.1)"
              : "0 0 20px rgba(196,164,74,0.15)",
            transition: "box-shadow 0.8s",
          }} />

          <img
            src="/images/door.png"
            alt="Door"
            style={{
              height: "100%",
              objectFit: "contain",
              display: "block",
              filter: unlocking ? "brightness(1.5) sepia(0.3)" : "brightness(0.8)",
              transition: "filter 0.8s ease",
            }}
          />

          {/* شعار على الباب */}
          <div style={{
            position: "absolute",
            top: "28%", left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            pointerEvents: "none",
          }}>
            <img
              src="/images/sillar_icon.png"
              alt="Logo"
              style={{ width: "60px", filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.8))" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div style={{
              color: "#c4a44a",
              fontSize: "11px",
              fontWeight: "bold",
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontFamily: "Inter, sans-serif",
              textShadow: "0 0 10px rgba(196,164,74,0.6), 0 2px 6px rgba(0,0,0,0.8)",
            }}>
              Sillar Office
            </div>
          </div>

          {/* ضوء الفتح */}
          {unlocking && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to right, rgba(255,220,120,0.25), transparent)",
              pointerEvents: "none",
              animation: "fadeIn 0.5s ease forwards",
            }} />
          )}
        </div>

        {/* ── فورم الدخول ───────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(145deg, rgba(26,21,40,0.97), rgba(20,16,32,0.97))",
          borderRadius: "0 14px 14px 0",
          padding: "32px 28px",
          border: "1px solid rgba(196,164,74,0.25)",
          borderLeft: "none",
          boxShadow: "6px 0 40px rgba(0,0,0,0.5), 0 0 60px rgba(196,164,74,0.05)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          alignSelf: "center",
          minWidth: "260px",
          backdropFilter: "blur(12px)",
        }}>
          {/* أيقونة + عنوان */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "48px", height: "48px",
              borderRadius: "50%",
              border: "1.5px solid #c4a44a",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(196,164,74,0.08)",
              boxShadow: unlocking ? "0 0 16px rgba(196,164,74,0.5)" : "none",
              transition: "box-shadow 0.5s",
            }}>
              {unlocking ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c4a44a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </div>

            <div style={{
              color: "#c4a44a",
              fontSize: "13px",
              fontWeight: "bold",
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}>
              {isRegister ? "Create Account" : "Identity Check"}
            </div>
          </div>

          {/* حقول الإدخال */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
            {(["USERNAME", "PASSWORD"] as const).map((field) => (
              <input
                key={field}
                type={field === "PASSWORD" ? "password" : "text"}
                placeholder={field}
                value={field === "PASSWORD" ? password : username}
                onChange={(e) => field === "PASSWORD" ? setPassword(e.target.value) : setUsername(e.target.value)}
                disabled={loading || unlocking}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(196,164,74,0.2)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#c4a44a",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  letterSpacing: "2px",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(196,164,74,0.6)";
                  e.target.style.background   = "rgba(196,164,74,0.06)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(196,164,74,0.2)";
                  e.target.style.background   = "rgba(255,255,255,0.03)";
                }}
              />
            ))}
          </div>

          {/* رسائل الحالة */}
          {error && (
            <div style={{ color: "#ef4444", fontSize: "11px", fontFamily: "monospace", textAlign: "center" }}>
              ✕ {error.toUpperCase()}
            </div>
          )}
          {loading && !unlocking && (
            <div style={{ color: "#c4a44a", fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px" }}>
              VERIFYING...
            </div>
          )}
          {unlocking && (
            <div style={{ color: "#4ade80", fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px" }}>
              ✓ ACCESS GRANTED
            </div>
          )}

          {/* زر Enter */}
          <button
            onClick={handleSubmit}
            disabled={loading || unlocking}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: "8px",
              border: `1px solid ${unlocking ? "rgba(74,222,128,0.4)" : "rgba(196,164,74,0.3)"}`,
              background: unlocking ? "rgba(74,222,128,0.12)" : "rgba(196,164,74,0.1)",
              color: unlocking ? "#4ade80" : "#c4a44a",
              fontSize: "12px",
              fontFamily: "monospace",
              fontWeight: "bold",
              letterSpacing: "4px",
              cursor: loading || unlocking ? "not-allowed" : "pointer",
              opacity: loading || unlocking ? 0.75 : 1,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!loading && !unlocking) {
                e.currentTarget.style.background    = "rgba(196,164,74,0.2)";
                e.currentTarget.style.borderColor   = "#c4a44a";
              }
            }}
            onMouseLeave={(e) => {
              if (!unlocking) {
                e.currentTarget.style.background    = "rgba(196,164,74,0.1)";
                e.currentTarget.style.borderColor   = "rgba(196,164,74,0.3)";
              }
            }}
          >
            {unlocking ? "ENTERING..." : loading ? "WAIT..." : isRegister ? "CREATE" : "ENTER"}
          </button>

          {/* رابط التبديل */}
          <div
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            style={{
              color: "#776a50",
              fontSize: "11px",
              fontFamily: "monospace",
              cursor: "pointer",
              letterSpacing: "1px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#c4a44a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#776a50"; }}
          >
            {isRegister ? "HAVE AN ACCOUNT? LOGIN" : "NEW? CREATE ACCOUNT"}
          </div>
        </div>
      </div>

      {/* نص أسفل */}
      {!unlocking && (
        <div style={{
          position: "absolute",
          bottom: "24px", left: "50%",
          transform: "translateX(-50%)",
          color: "#554d3a",
          fontSize: "11px",
          fontFamily: "monospace",
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}>
          سجّل دخول أو أنشئ حساباً
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
