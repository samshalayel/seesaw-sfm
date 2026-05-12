/**
 * MeetingLobby.tsx
 * شاشة ما قبل الانضمام للاجتماع — ديزاين بروفيشونال
 */
import { useState } from "react";
import { useGame } from "@/lib/stores/useGame";

export function MeetingLobby() {
  const open           = useGame((s) => s.meetingLobbyOpen);
  const closeLobby     = useGame((s) => s.closeMeetingLobby);
  const openMeeting    = useGame((s) => s.openAgoraMeeting);
  const setMeetingMode = useGame((s) => s.setMeetingMode);
  const user           = useGame((s) => s.user);
  const companyName    = useGame((s) => s.companyName);
  const humans         = useGame((s) => s.humans);

  const [copiedIdx, setCopiedIdx] = useState<number | "self" | null>(null);
  const [hovering, setHovering]   = useState(false);

  if (!open) return null;

  const roomId   = user?.roomId   || "";
  const userName = user?.username || "مستخدم";
  const origin   = window.location.origin;
  const basePath = window.location.pathname;
  const selfLink = `${origin}${basePath}?agoraMeeting=1`;

  const copy = (text: string, key: number | "self") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(key);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const handleJoin = () => {
    setMeetingMode(true);
    openMeeting();
  };

  // initials avatar
  const initials = userName.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <style>{`
        @keyframes lobbyFadeIn {
          from { opacity:0; transform:translateY(18px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes lobbyPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%      { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
        }
        .lobby-join-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 30px rgba(99,102,241,0.55) !important;
        }
        .lobby-join-btn:active { transform: scale(0.98) !important; }
        .lobby-copy-btn:hover  { filter: brightness(1.25); }
        .lobby-close:hover     { background: rgba(255,255,255,0.15) !important; color:#fff !important; }
        .lobby-link-row:hover  { background: rgba(255,255,255,0.08) !important; }
        .lobby-card::-webkit-scrollbar { width:5px; }
        .lobby-card::-webkit-scrollbar-track  { background:transparent; }
        .lobby-card::-webkit-scrollbar-thumb  { background:#334155; border-radius:4px; }
      `}</style>

      {/* Overlay */}
      <div
        onClick={closeLobby}
        style={{
          position:"fixed", inset:0, zIndex:9000,
          background:"rgba(2,6,23,0.80)", backdropFilter:"blur(8px)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
      >
        {/* Card */}
        <div
          className="lobby-card"
          onClick={e => e.stopPropagation()}
          style={{
            animation: "lobbyFadeIn 0.28s ease both",
            background: "linear-gradient(160deg,#0d1526 0%,#131f35 60%,#0f1a2e 100%)",
            border: "1px solid rgba(99,102,241,0.22)",
            borderRadius: "24px",
            padding: "0",
            width: "min(500px,95vw)",
            maxHeight: "88vh",
            overflowY: "auto",
            boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
            direction: "rtl",
          }}
        >
          {/* ── Hero band ── */}
          <div style={{
            background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e3a5f 100%)",
            borderRadius: "24px 24px 0 0",
            padding: "28px 28px 24px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* decorative circles */}
            <div style={{ position:"absolute", top:-40, left:-40, width:180, height:180,
              borderRadius:"50%", background:"rgba(99,102,241,0.12)", pointerEvents:"none" }} />
            <div style={{ position:"absolute", bottom:-60, right:-20, width:220, height:220,
              borderRadius:"50%", background:"rgba(139,92,246,0.08)", pointerEvents:"none" }} />

            <div style={{ position:"relative", display:"flex", alignItems:"center", gap:14 }}>
              {/* Video icon badge */}
              <div style={{
                width:52, height:52, borderRadius:16,
                background:"linear-gradient(135deg,rgba(99,102,241,0.6),rgba(139,92,246,0.6))",
                border:"1px solid rgba(255,255,255,0.15)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:26, flexShrink:0,
                backdropFilter:"blur(6px)",
              }}>🎥</div>

              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:20, color:"#fff", letterSpacing:"-0.02em" }}>
                  {companyName || "اجتماع مرئي"}
                </div>
                <div style={{
                  fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:3,
                  fontFamily:"monospace", letterSpacing:"0.04em",
                }}>
                  {roomId}
                </div>
              </div>

              {/* Close */}
              <button
                className="lobby-close"
                onClick={closeLobby}
                style={{
                  background:"rgba(255,255,255,0.08)", border:"none",
                  borderRadius:10, color:"rgba(255,255,255,0.5)",
                  width:34, height:34, fontSize:15,
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.15s", flexShrink:0,
                }}
              >✕</button>
            </div>

            {/* Live pill */}
            <div style={{
              position:"absolute", top:16, left:28,
              display:"flex", alignItems:"center", gap:6,
              background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.3)",
              borderRadius:20, padding:"3px 10px",
            }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e",
                display:"inline-block", animation:"lobbyPulse 1.8s ease-in-out infinite" }} />
              <span style={{ fontSize:11, color:"#4ade80", fontWeight:600 }}>جاهز</span>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding:"22px 28px 28px", display:"flex", flexDirection:"column", gap:20 }}>

            {/* User avatar row */}
            <div style={{
              display:"flex", alignItems:"center", gap:14,
              background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:14, padding:"13px 16px",
            }}>
              <div style={{
                width:42, height:42, borderRadius:12,
                background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#fff", fontWeight:800, fontSize:16, flexShrink:0,
                boxShadow:"0 4px 12px rgba(99,102,241,0.35)",
              }}>{initials || "؟"}</div>
              <div>
                <div style={{ fontSize:11, color:"#475569", marginBottom:2 }}>ستنضم باسم</div>
                <div style={{ fontWeight:700, color:"#e2e8f0", fontSize:15 }}>{userName}</div>
              </div>
              <div style={{
                marginRight:"auto", marginLeft:0,
                background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.25)",
                borderRadius:8, padding:"3px 10px",
                fontSize:11, color:"#818cf8", fontWeight:600,
              }}>أنت</div>
            </div>

            {/* Self link */}
            <LinkSection
              title="🔗 رابطك الشخصي"
              subtitle="شاركه مع أي شخص للانضمام باسمك"
            >
              <LinkItem
                label={selfLink}
                copied={copiedIdx === "self"}
                onCopy={() => copy(selfLink, "self")}
              />
            </LinkSection>

            {/* Team links */}
            {humans.length > 0 && (
              <LinkSection
                title="👥 دعوة الفريق"
                subtitle={`${humans.length} عضو — رابط مخصص لكل واحد`}
              >
                {humans.map((h, i) => {
                  const link = `${origin}${basePath}?humanCode=${encodeURIComponent(h.joinCode)}&agoraMeeting=1`;
                  return (
                    <LinkItem
                      key={h.id}
                      name={h.name || `عضو ${i + 1}`}
                      label={link}
                      copied={copiedIdx === i}
                      onCopy={() => copy(link, i)}
                    />
                  );
                })}
              </LinkSection>
            )}

            {/* Join CTA */}
            <button
              className="lobby-join-btn"
              onClick={handleJoin}
              style={{
                width:"100%", padding:"15px",
                background:"linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)",
                border:"none", borderRadius:16,
                color:"#fff", fontSize:16, fontWeight:800,
                cursor:"pointer", letterSpacing:"-0.01em",
                boxShadow:"0 4px 20px rgba(99,102,241,0.45)",
                transition:"transform 0.18s, box-shadow 0.18s",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                marginTop:2,
              }}
            >
              <span style={{ fontSize:20 }}>📹</span>
              انضمام للاجتماع الآن
            </button>

          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LinkSection({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
        <span style={{ fontSize:13, fontWeight:700, color:"#94a3b8" }}>{title}</span>
        <span style={{ fontSize:11, color:"#334155" }}>{subtitle}</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {children}
      </div>
    </div>
  );
}

function LinkItem({ name, label, copied, onCopy }: {
  name?: string; label: string; copied: boolean; onCopy: () => void;
}) {
  return (
    <div
      className="lobby-link-row"
      style={{
        display:"flex", alignItems:"center", gap:10,
        background:"rgba(255,255,255,0.04)",
        border:"1px solid rgba(255,255,255,0.06)",
        borderRadius:12, padding:"10px 14px",
        transition:"background 0.15s",
      }}
    >
      <div style={{ flex:1, minWidth:0 }}>
        {name && (
          <div style={{ fontSize:11, color:"#64748b", marginBottom:3, fontWeight:600 }}>{name}</div>
        )}
        <div style={{
          fontSize:11, color:"#475569",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          direction:"ltr", textAlign:"left", fontFamily:"monospace",
        }}>{label}</div>
      </div>
      <button
        className="lobby-copy-btn"
        onClick={onCopy}
        style={{
          flexShrink:0,
          padding:"5px 14px", borderRadius:9,
          border:"none",
          background: copied
            ? "linear-gradient(135deg,#16a34a,#15803d)"
            : "rgba(99,102,241,0.2)",
          color: copied ? "#fff" : "#818cf8",
          fontSize:12, fontWeight:700,
          cursor:"pointer", transition:"all 0.2s",
          display:"flex", alignItems:"center", gap:5,
        }}
      >
        {copied ? "✓ تم" : "نسخ"}
      </button>
    </div>
  );
}
