import { useEffect, useState } from "react";
import { useGame } from "@/lib/stores/useGame";

const DEFAULT_ID = "7NrIvIoqxYg";
const GOLD = "#c4a44a";
const MAX  = 5;

interface VideoItem { id: string; label: string }

function extractId(input: string): string | null {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

async function fetchPlaylist(): Promise<VideoItem[]> {
  try {
    const res = await fetch("/api/playlist", { headers: { "x-room-id": localStorage.getItem("roomId") || "default" } });
    if (!res.ok) return [];
    const data = await res.json() as Array<{ videoId: string; label: string }>;
    return data.map((d) => ({ id: d.videoId, label: d.label }));
  } catch { return []; }
}

async function persistPlaylist(list: VideoItem[]): Promise<void> {
  try {
    await fetch("/api/playlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-room-id": localStorage.getItem("roomId") || "default",
      },
      body: JSON.stringify({ items: list.map((v) => ({ videoId: v.id, label: v.label })) }),
    });
  } catch { /* silent */ }
}

export function ManagerVideoOverlay() {
  const isOpen = useGame((s) => s.videoScreenOpen);
  const close  = useGame((s) => s.closeVideoScreen);

  const [tab,       setTab]       = useState<"watch" | "add">("watch");
  const [playlist,  setPlaylist]  = useState<VideoItem[]>([]);
  const [currentId, setCurrentId] = useState(DEFAULT_ID);
  const [inputs,    setInputs]    = useState<string[]>(["", "", "", "", ""]);
  const [errors,    setErrors]    = useState<string[]>(["", "", "", "", ""]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Load playlist from server when overlay opens
  useEffect(() => {
    if (isOpen) {
      fetchPlaylist().then(setPlaylist);
    }
  }, [isOpen]);

  // sync inputs from playlist when tab opens
  useEffect(() => {
    if (tab === "add") {
      const filled = playlist.map(v => `https://youtu.be/${v.id}`);
      const padded = [...filled, "", "", "", "", ""].slice(0, MAX);
      setInputs(padded);
      setErrors(["", "", "", "", ""]);
    }
  }, [tab]);

  if (!isOpen) return null;

  function handleSave() {
    const newList: VideoItem[] = [];
    const newErrors = ["", "", "", "", ""];
    let hasError = false;
    inputs.forEach((raw, i) => {
      if (!raw.trim()) return;
      const id = extractId(raw.trim());
      if (!id) { newErrors[i] = "رابط غير صحيح"; hasError = true; return; }
      if (newList.some(v => v.id === id)) { newErrors[i] = "مكرر"; hasError = true; return; }
      newList.push({ id, label: `فيديو ${newList.length + 1}` });
    });
    setErrors(newErrors);
    if (hasError) return;
    setPlaylist(newList);
    persistPlaylist(newList);
    setTab("watch");
  }

  const tabBtn = (active: boolean) => ({
    background: active ? `rgba(196,164,74,0.2)` : "transparent",
    border: `1px solid ${active ? GOLD : "rgba(196,164,74,0.25)"}`,
    color: active ? GOLD : "rgba(196,164,74,0.5)",
    padding: "6px 20px", borderRadius: 6,
    fontSize: 12, fontFamily: "monospace",
    letterSpacing: "1.5px", cursor: "pointer",
  } as React.CSSProperties);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.93)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14,
      animation: "video-enter 0.45s cubic-bezier(0.16,1,0.3,1) both",
      fontFamily: "monospace",
    }}>
      <style>{`
        @keyframes video-enter {
          0%   { opacity:0; transform:scale(0.9); filter:brightness(2) blur(6px); }
          50%  { filter:brightness(1.3) blur(0px); }
          100% { opacity:1; transform:scale(1);   filter:brightness(1) blur(0px); }
        }
        @keyframes video-scan {
          0%   { top:-3px; opacity:0.8; }
          100% { top:100%; opacity:0; }
        }
      `}</style>

      {/* خط مسح */}
      <div style={{
        position:"absolute", left:0, right:0, height:2,
        background:`linear-gradient(90deg,transparent,${GOLD},transparent)`,
        animation:"video-scan 0.6s ease-out 0.1s both", pointerEvents:"none",
      }} />

      {/* التابات */}
      <div style={{ display:"flex", gap:8 }}>
        <button style={tabBtn(tab === "watch")} onClick={() => setTab("watch")}>▶ مشاهدة</button>
        <button style={tabBtn(tab === "add")}   onClick={() => setTab("add")}>＋ قائمة التشغيل</button>
      </div>

      {/* ── تاب المشاهدة ── */}
      {tab === "watch" && (
        <div style={{ display:"flex", gap:14, alignItems:"flex-start",
          width:"min(95vw,1320px)" }}>

          {/* قائمة التشغيل — يسار */}
          <div style={{
            width:200, flexShrink:0, display:"flex", flexDirection:"column", gap:8,
          }}>
            <div style={{ fontSize:9, letterSpacing:"2px", color:`${GOLD}88`, marginBottom:2 }}>
              قائمة التشغيل
            </div>

            {/* الفيديو الافتراضي */}
            {[{ id: DEFAULT_ID, label: "الفيديو الرئيسي" }, ...playlist].slice(0, MAX).map((v, i) => (
              <div key={v.id} onClick={() => setCurrentId(v.id)} style={{
                cursor:"pointer", borderRadius:6, overflow:"hidden",
                border: currentId === v.id
                  ? `2px solid ${GOLD}`
                  : "1px solid rgba(196,164,74,0.2)",
                boxShadow: currentId === v.id
                  ? `0 0 12px ${GOLD}55` : "none",
                transition:"box-shadow 0.2s",
              }}>
                <img
                  src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                  alt={v.label}
                  style={{ width:"100%", display:"block", aspectRatio:"16/9", objectFit:"cover" }}
                />
                <div style={{
                  padding:"4px 6px", fontSize:9, color: currentId === v.id ? GOLD : "rgba(196,164,74,0.5)",
                  background:"rgba(0,0,0,0.6)", letterSpacing:"0.5px",
                }}>
                  {i + 1}. {v.label}
                </div>
              </div>
            ))}

            {[{ id: DEFAULT_ID }, ...playlist].length === 1 && (
              <div style={{ fontSize:9, color:"rgba(196,164,74,0.3)", textAlign:"center", padding:"8px 0" }}>
                أضف فيديوهات من تاب القائمة
              </div>
            )}
          </div>

          {/* المشغّل — يمين */}
          <div style={{
            flex:1, borderRadius:8, overflow:"hidden",
            border:`2px solid ${GOLD}`,
            boxShadow:`0 0 40px rgba(196,164,74,0.3)`,
            aspectRatio:"16/9",
          }}>
            <iframe
              key={currentId}
              width="100%" height="100%"
              src={`https://www.youtube.com/embed/${currentId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0`}
              style={{ border:"none", display:"block" }}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* ── تاب الإضافة ── */}
      {tab === "add" && (
        <div style={{
          width:"min(95vw,500px)", display:"flex", flexDirection:"column", gap:10,
        }}>
          <div style={{ fontSize:9, letterSpacing:"2px", color:`${GOLD}88`, marginBottom:4 }}>
            أدخل حتى {MAX} روابط يوتيوب
          </div>

          {inputs.map((val, i) => (
            <div key={i}>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:`${GOLD}55`, fontSize:11, width:16, textAlign:"center" }}>{i+1}</span>
                <input
                  value={val}
                  onChange={e => {
                    const n = [...inputs]; n[i] = e.target.value;
                    setInputs(n);
                    if (errors[i]) { const ne = [...errors]; ne[i] = ""; setErrors(ne); }
                  }}
                  placeholder="https://youtu.be/..."
                  style={{
                    flex:1, background:"rgba(196,164,74,0.06)",
                    border:`1px solid ${errors[i] ? "#ff4444" : "rgba(196,164,74,0.3)"}`,
                    borderRadius:6, padding:"8px 12px",
                    color: "#fff", fontSize:12, fontFamily:"monospace",
                    outline:"none",
                  }}
                />
              </div>
              {errors[i] && (
                <div style={{ fontSize:10, color:"#ff6666", paddingRight:24, marginTop:2 }}>
                  {errors[i]}
                </div>
              )}
            </div>
          ))}

          <button onClick={handleSave} style={{
            marginTop:8,
            background:`rgba(196,164,74,0.15)`,
            border:`1px solid ${GOLD}66`,
            color:GOLD, padding:"10px", borderRadius:8,
            fontSize:13, fontFamily:"monospace",
            letterSpacing:"2px", cursor:"pointer",
          }}>
            حفظ القائمة
          </button>
        </div>
      )}

      {/* زر الإغلاق */}
      <button onClick={close} style={{
        background:"rgba(196,164,74,0.1)",
        border:`1px solid rgba(196,164,74,0.3)`,
        color:GOLD, padding:"8px 28px", borderRadius:8,
        fontSize:12, fontFamily:"monospace",
        letterSpacing:"2px", cursor:"pointer",
      }}>
        ESC — إغلاق
      </button>
    </div>
  );
}
