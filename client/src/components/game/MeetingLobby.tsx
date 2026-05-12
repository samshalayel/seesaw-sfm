/**
 * MeetingLobby.tsx — شاشة ما قبل الاجتماع
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
  const [teamOpen, setTeamOpen]   = useState(false);

  if (!open) return null;

  const userName = user?.username || "مستخدم";
  const origin   = window.location.origin;
  const basePath = window.location.pathname;
  const selfLink = `${origin}${basePath}?agoraMeeting=1`;

  const copy = (text: string, key: number | "self") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(key);
      setTimeout(() => setCopiedIdx(null), 2200);
    });
  };

  const initials = userName.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <style>{`
        @keyframes lbIn  { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes lbDot { 0%,100%{opacity:1} 50%{opacity:.3} }
        .lb-btn-join:hover  { filter:brightness(1.12); transform:translateY(-1px) !important; }
        .lb-btn-join:active { transform:scale(.98) !important; }
        .lb-copy:hover      { filter:brightness(1.2); }
        .lb-card::-webkit-scrollbar       { width:4px; }
        .lb-card::-webkit-scrollbar-thumb { background:#2d3a50; border-radius:4px; }
        .lb-member:hover { background:rgba(255,255,255,0.06) !important; }
      `}</style>

      {/* Overlay */}
      <div
        onClick={closeLobby}
        style={{
          position:"fixed", inset:0, zIndex:9000,
          background:"rgba(0,4,15,0.82)", backdropFilter:"blur(10px)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
      >
        {/* ── Card ── */}
        <div
          className="lb-card"
          onClick={e => e.stopPropagation()}
          style={{
            animation:"lbIn .25s cubic-bezier(.34,1.56,.64,1) both",
            width:"min(520px,96vw)",
            maxHeight:"90vh",
            overflowY:"auto",
            background:"#0e1628",
            border:"1px solid rgba(99,102,241,.28)",
            borderRadius:22,
            boxShadow:"0 40px 100px rgba(0,0,0,.75)",
            direction:"rtl",
            fontFamily:"'Almarai',sans-serif",
          }}
        >

          {/* ══ رأس ══ */}
          <div style={{
            background:"linear-gradient(135deg,#1a1660 0%,#27206e 45%,#162344 100%)",
            borderRadius:"22px 22px 0 0",
            padding:"24px 24px 20px",
            position:"relative",
            overflow:"hidden",
          }}>
            {/* دوائر زخرفية */}
            <div style={{position:"absolute",top:-50,left:-50,width:200,height:200,borderRadius:"50%",background:"rgba(99,102,241,.1)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",bottom:-70,right:-30,width:260,height:260,borderRadius:"50%",background:"rgba(139,92,246,.06)",pointerEvents:"none"}}/>

            <div style={{position:"relative",display:"flex",alignItems:"center",gap:14}}>
              {/* أيقونة الفيديو */}
              <div style={{
                width:50,height:50,borderRadius:15,flexShrink:0,
                background:"linear-gradient(135deg,rgba(99,102,241,.55),rgba(139,92,246,.55))",
                border:"1px solid rgba(255,255,255,.14)",
                backdropFilter:"blur(8px)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
              }}>🎥</div>

              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:18,color:"#fff",letterSpacing:"-.02em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {companyName || "اجتماع مرئي"}
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.38)",marginTop:2}}>
                  اجتماع بالفيديو والصوت
                </div>
              </div>

              {/* بادج جاهز */}
              <div style={{
                display:"flex",alignItems:"center",gap:5,flexShrink:0,
                background:"rgba(34,197,94,.12)",border:"1px solid rgba(34,197,94,.28)",
                borderRadius:20,padding:"4px 12px",
              }}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",display:"inline-block",animation:"lbDot 2s ease-in-out infinite"}}/>
                <span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>جاهز</span>
              </div>

              {/* زر الإغلاق */}
              <button
                onClick={closeLobby}
                style={{
                  flexShrink:0,background:"rgba(255,255,255,.07)",border:"none",
                  borderRadius:9,color:"rgba(255,255,255,.45)",width:32,height:32,
                  fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",
                  justifyContent:"center",transition:"all .15s",
                }}
              >✕</button>
            </div>
          </div>

          {/* ══ جسم الكارد ══ */}
          <div style={{padding:"24px",display:"flex",flexDirection:"column",gap:18}}>

            {/* ─ المستخدم ─ */}
            <div style={{
              display:"flex",alignItems:"center",gap:14,
              background:"rgba(255,255,255,.035)",
              border:"1px solid rgba(255,255,255,.07)",
              borderRadius:14,padding:"14px 18px",
            }}>
              <div style={{
                width:44,height:44,borderRadius:13,flexShrink:0,
                background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontWeight:800,fontSize:17,
                boxShadow:"0 4px 14px rgba(99,102,241,.35)",
              }}>{initials||"؟"}</div>

              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"#4b5563",marginBottom:3}}>ستنضم للاجتماع باسم</div>
                <div style={{fontWeight:800,color:"#e2e8f0",fontSize:16}}>{userName}</div>
              </div>

              <span style={{
                background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.3)",
                borderRadius:8,padding:"3px 11px",fontSize:11,color:"#818cf8",fontWeight:700,
              }}>أنت</span>
            </div>

            {/* ─ رابطك الشخصي ─ */}
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#64748b",marginBottom:10}}>
                🔗 رابط الانضمام الخاص بك
              </div>
              <div style={{
                display:"flex",alignItems:"center",gap:10,
                background:"rgba(255,255,255,.035)",
                border:"1px solid rgba(255,255,255,.07)",
                borderRadius:13,padding:"12px 16px",
              }}>
                <span style={{fontSize:16}}>🙋</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#c7d2fe",marginBottom:2}}>{userName}</div>
                  <div style={{fontSize:11,color:"#374151",direction:"ltr",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {selfLink}
                  </div>
                </div>
                <button
                  className="lb-copy"
                  onClick={() => copy(selfLink, "self")}
                  style={{
                    flexShrink:0,padding:"7px 16px",borderRadius:10,border:"none",
                    background: copiedIdx === "self" ? "linear-gradient(135deg,#16a34a,#15803d)" : "rgba(99,102,241,.22)",
                    color: copiedIdx === "self" ? "#fff" : "#818cf8",
                    fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .2s",
                    minWidth:70,
                  }}
                >
                  {copiedIdx === "self" ? "✓ تم" : "نسخ"}
                </button>
              </div>
            </div>

            {/* ─ روابط الفريق (قابلة للطي) ─ */}
            {humans.length > 0 && (
              <div>
                <button
                  onClick={() => setTeamOpen(v => !v)}
                  style={{
                    width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                    background:"rgba(255,255,255,.025)",
                    border:"1px solid rgba(255,255,255,.07)",
                    borderRadius: teamOpen ? "13px 13px 0 0" : 13,
                    padding:"12px 16px",cursor:"pointer",
                    transition:"border-radius .2s",
                  }}
                >
                  <span style={{fontSize:13,fontWeight:700,color:"#64748b"}}>
                    👥 روابط دعوة الفريق
                  </span>
                  <span style={{
                    background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.25)",
                    borderRadius:7,padding:"2px 9px",fontSize:11,color:"#818cf8",fontWeight:700,
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    {humans.length} عضو
                    <span style={{fontSize:10,opacity:.7,transition:"transform .2s",display:"inline-block",transform:teamOpen?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
                  </span>
                </button>

                {teamOpen && (
                  <div style={{
                    border:"1px solid rgba(255,255,255,.07)",borderTop:"none",
                    borderRadius:"0 0 13px 13px",overflow:"hidden",
                  }}>
                    {humans.map((h, i) => {
                      const link = `${origin}${basePath}?humanCode=${encodeURIComponent(h.joinCode)}&agoraMeeting=1`;
                      const memberInitials = (h.name || "؟").trim().split(/\s+/).map((w:string) => w[0]).slice(0,2).join("").toUpperCase();
                      return (
                        <div
                          key={h.id}
                          className="lb-member"
                          style={{
                            display:"flex",alignItems:"center",gap:12,
                            background: i % 2 === 0 ? "rgba(255,255,255,.02)" : "transparent",
                            padding:"10px 16px",transition:"background .15s",
                          }}
                        >
                          <div style={{
                            width:34,height:34,borderRadius:9,flexShrink:0,
                            background:"linear-gradient(135deg,#374151,#1f2937)",
                            border:"1px solid rgba(255,255,255,.08)",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            color:"#9ca3af",fontWeight:700,fontSize:12,
                          }}>{memberInitials}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:"#d1d5db"}}>{h.name || `عضو ${i+1}`}</div>
                            <div style={{fontSize:10,color:"#374151",direction:"ltr",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {link}
                            </div>
                          </div>
                          <button
                            className="lb-copy"
                            onClick={() => copy(link, i)}
                            style={{
                              flexShrink:0,padding:"5px 13px",borderRadius:8,border:"none",
                              background: copiedIdx === i ? "linear-gradient(135deg,#16a34a,#15803d)" : "rgba(99,102,241,.18)",
                              color: copiedIdx === i ? "#fff" : "#818cf8",
                              fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s",
                              minWidth:60,
                            }}
                          >
                            {copiedIdx === i ? "✓" : "نسخ"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─ فاصل ─ */}
            <div style={{height:1,background:"rgba(255,255,255,.05)"}}/>

            {/* ─ زر الانضمام ─ */}
            <button
              className="lb-btn-join"
              onClick={() => { setMeetingMode(true); openMeeting(); }}
              style={{
                width:"100%",padding:"16px",
                background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
                border:"none",borderRadius:15,
                color:"#fff",fontSize:16,fontWeight:800,
                cursor:"pointer",letterSpacing:"-.01em",
                boxShadow:"0 6px 24px rgba(99,102,241,.45)",
                transition:"filter .18s, transform .18s, box-shadow .18s",
                display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              }}
            >
              <span style={{fontSize:20}}>📹</span>
              انضمام للاجتماع الآن
            </button>

          </div>
        </div>
      </div>
    </>
  );
}
