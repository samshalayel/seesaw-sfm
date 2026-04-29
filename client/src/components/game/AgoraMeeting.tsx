import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { useGame } from "@/lib/stores/useGame";

AgoraRTC.setLogLevel(4); // errors only

// ── types ─────────────────────────────────────────────────────────────────────
interface RemoteUser {
  uid: string | number;
  videoTrack?: IAgoraRTCRemoteUser["videoTrack"];
  audioTrack?: IAgoraRTCRemoteUser["audioTrack"];
  hasVideo: boolean;
  hasAudio: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function getChannelName(roomId: string) {
  return `seesaw-${roomId}`;
}

function LocalVideoTile({
  track,
  muted,
  name,
}: {
  track: ICameraVideoTrack | null;
  muted: boolean;
  name: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!track || !ref.current) return;
    track.play(ref.current);
    return () => track.stop();
  }, [track]);

  return (
    <div style={tileStyle(true)}>
      <div ref={ref} style={{ width: "100%", height: "100%", borderRadius: "10px", overflow: "hidden", background: "#000" }} />
      {muted && (
        <div style={noVideoStyle}>
          <span style={{ fontSize: "32px" }}>👤</span>
        </div>
      )}
      <div style={nameBadge}>{name} (أنت)</div>
    </div>
  );
}

function RemoteVideoTile({ user, name }: { user: RemoteUser; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!user.videoTrack || !ref.current) return;
    user.videoTrack.play(ref.current);
    return () => user.videoTrack?.stop();
  }, [user.videoTrack]);

  return (
    <div style={tileStyle(false)}>
      {user.hasVideo && user.videoTrack ? (
        <div ref={ref} style={{ width: "100%", height: "100%", borderRadius: "10px", overflow: "hidden", background: "#000" }} />
      ) : (
        <div style={noVideoStyle}>
          <span style={{ fontSize: "32px" }}>👤</span>
        </div>
      )}
      <div style={nameBadge}>{name}</div>
      {!user.hasAudio && <div style={mutedIcon}>🔇</div>}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const tileStyle = (isLocal: boolean): React.CSSProperties => ({
  position: "relative",
  width: "200px",
  height: "150px",
  borderRadius: "12px",
  border: isLocal ? "2px solid #00aaff" : "1.5px solid rgba(0,170,255,0.3)",
  background: "#050d1a",
  flexShrink: 0,
  overflow: "hidden",
});

const noVideoStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,10,30,0.9)",
};

const nameBadge: React.CSSProperties = {
  position: "absolute",
  bottom: "6px",
  right: "8px",
  fontSize: "10px",
  color: "#aaccff",
  background: "rgba(0,0,0,0.6)",
  padding: "2px 7px",
  borderRadius: "6px",
  backdropFilter: "blur(4px)",
  direction: "rtl",
};

const mutedIcon: React.CSSProperties = {
  position: "absolute",
  top: "6px",
  left: "8px",
  fontSize: "12px",
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function AgoraMeeting() {
  const open             = useGame((s) => s.agoraMeetingOpen);
  const close            = useGame((s) => s.closeAgoraMeeting);
  const meetingMode      = useGame((s) => s.meetingMode);
  const user             = useGame((s) => s.user);
  const companyName      = useGame((s) => s.companyName);
  const humans           = useGame((s) => s.humans);

  const [joined,      setJoined]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [audioMuted,  setAudioMuted]  = useState(false);
  const [videoMuted,  setVideoMuted]  = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);

  const clientRef    = useRef<IAgoraRTCClient | null>(null);
  const audioTrack   = useRef<IMicrophoneAudioTrack | null>(null);
  const videoTrack   = useRef<ICameraVideoTrack | null>(null);

  const roomId = user?.roomId || "default";
  const myName = user?.username || "أنت";

  // ── cleanup ──────────────────────────────────────────────────────────────────
  const leaveChannel = useCallback(async () => {
    audioTrack.current?.stop(); audioTrack.current?.close();
    videoTrack.current?.stop(); videoTrack.current?.close();
    audioTrack.current = null;
    videoTrack.current = null;
    if (clientRef.current) {
      await clientRef.current.leave().catch(() => {});
      clientRef.current = null;
    }
    setJoined(false);
    setRemoteUsers([]);
  }, []);

  // ESC / close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // cleanup when overlay closes
  useEffect(() => {
    if (!open) { leaveChannel(); }
  }, [open, leaveChannel]);

  // cleanup on unmount
  useEffect(() => () => { leaveChannel(); }, [leaveChannel]);

  // ── join ─────────────────────────────────────────────────────────────────────
  const joinMeeting = async () => {
    setLoading(true);
    setError("");

    // الكاميرا/الميكروفون تحتاج HTTPS على الموبايل
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      setError("الكاميرا والميكروفون يحتاجان اتصالاً آمناً (HTTPS). يرجى فتح التطبيق عبر HTTPS للانضمام بالفيديو.");
      setLoading(false);
      return;
    }
    try {
      // 1. اطلب token من السيرفر
      const uid = Math.floor(Math.random() * 100000);
      const channelName = getChannelName(roomId);
      const res  = await fetch("/api/agora/token", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ channelName, uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحصول على token");

      // 2. أنشئ الـ client
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // 3. استمع للمستخدمين البُعداء
      client.on("user-published", async (remoteUser, mediaType) => {
        // تجاهل إذا تركنا الـ channel قبل اكتمال الـ event
        if (clientRef.current !== client) return;
        try {
          await client.subscribe(remoteUser, mediaType);
        } catch {
          return;
        }
        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.uid === remoteUser.uid);
          const updated: RemoteUser = exists
            ? { ...exists, hasVideo: mediaType === "video" ? true : exists.hasVideo, hasAudio: mediaType === "audio" ? true : exists.hasAudio, videoTrack: mediaType === "video" ? remoteUser.videoTrack : exists.videoTrack, audioTrack: mediaType === "audio" ? remoteUser.audioTrack : exists.audioTrack }
            : { uid: remoteUser.uid, hasVideo: mediaType === "video", hasAudio: mediaType === "audio", videoTrack: mediaType === "video" ? remoteUser.videoTrack : undefined, audioTrack: mediaType === "audio" ? remoteUser.audioTrack : undefined };
          if (mediaType === "audio") remoteUser.audioTrack?.play();
          return exists ? prev.map((u) => u.uid === remoteUser.uid ? updated : u) : [...prev, updated];
        });
      });

      client.on("user-unpublished", (remoteUser, mediaType) => {
        setRemoteUsers((prev) => prev.map((u) =>
          u.uid === remoteUser.uid
            ? { ...u, hasVideo: mediaType === "video" ? false : u.hasVideo, hasAudio: mediaType === "audio" ? false : u.hasAudio, videoTrack: mediaType === "video" ? undefined : u.videoTrack, audioTrack: mediaType === "audio" ? undefined : u.audioTrack }
            : u
        ));
      });

      client.on("user-left", (remoteUser) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUser.uid));
      });

      // 4. الدخول للـ channel
      await client.join(data.appId, channelName, data.token, uid);

      // 5. أنشئ tracks وانشر — مع fallback لـ audio-only إذا فشلت الكاميرا
      let mic: IMicrophoneAudioTrack;
      let cam: ICameraVideoTrack | null = null;
      try {
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        mic = tracks[0];
        cam = tracks[1];
      } catch {
        // الكاميرا غير متاحة — جرب صوت فقط
        mic = await AgoraRTC.createMicrophoneAudioTrack();
        setVideoMuted(true);
      }
      audioTrack.current = mic;
      videoTrack.current = cam;
      const tracksToPublish = cam ? [mic, cam] : [mic];
      await client.publish(tracksToPublish);

      setJoined(true);
    } catch (e: any) {
      setError(e.message || "خطأ في الاتصال");
      await leaveChannel();
    } finally {
      setLoading(false);
    }
  };

  // ── controls ─────────────────────────────────────────────────────────────────
  const toggleAudio = async () => {
    if (!audioTrack.current) return;
    await audioTrack.current.setEnabled(audioMuted);
    setAudioMuted(!audioMuted);
  };

  const toggleVideo = async () => {
    if (!videoTrack.current) return;
    await videoTrack.current.setEnabled(videoMuted);
    setVideoMuted(!videoMuted);
  };

  if (!open || !meetingMode) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,5,20,0.80)",
        backdropFilter: "blur(8px)",
        direction: "rtl",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) { leaveChannel(); close(); } }}
    >
      <div style={{
        width: "min(900px, 96vw)",
        maxHeight: "90vh",
        overflowY: "auto",
        background: "linear-gradient(160deg, rgba(3,10,30,0.98) 0%, rgba(0,8,25,0.98) 100%)",
        border: "1px solid rgba(0,170,255,0.3)",
        borderRadius: "18px",
        boxShadow: "0 0 80px rgba(0,100,255,0.15)",
        padding: "24px 28px",
        fontFamily: "Inter, sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "#0088cc", letterSpacing: "2px", fontWeight: 700 }}>📹 LIVE MEETING</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginTop: "2px" }}>
              {companyName || "الشركة"} — غرفة {roomId}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {joined && (
              <span style={{
                padding: "3px 10px", borderRadius: "12px",
                background: "rgba(0,200,80,0.15)", border: "1px solid rgba(0,200,80,0.4)",
                color: "#00dd66", fontSize: "11px", fontWeight: 700,
              }}>
                🟢 متصل — {remoteUsers.length + 1} مشارك
              </span>
            )}
            <button onClick={() => { leaveChannel(); close(); }} style={{
              padding: "6px 14px", borderRadius: "8px",
              border: "1px solid rgba(255,80,80,0.4)", background: "rgba(180,30,30,0.2)",
              color: "#ff7777", fontSize: "13px", cursor: "pointer",
            }}>✕</button>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,#00aaff44,transparent)", marginBottom: "20px" }} />

        {/* ── Pre-join screen ── */}
        {!joined && (
          <div style={{ textAlign: "center", padding: "24px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📹</div>
            <div style={{ color: "#aaccff", fontSize: "15px", marginBottom: "4px" }}>
              اجتماع: <span style={{ color: "#00ccff", fontWeight: 700 }}>seesaw-{roomId}</span>
            </div>
            {error && (
              <div style={{ color: "#ff6666", fontSize: "12px", margin: "12px 0", padding: "8px 16px", background: "rgba(255,0,0,0.1)", borderRadius: "8px", border: "1px solid rgba(255,0,0,0.2)" }}>
                ⚠️ {error}
              </div>
            )}
            <button
              onClick={joinMeeting}
              disabled={loading}
              style={{
                padding: "12px 32px", borderRadius: "12px", marginTop: "12px",
                border: "none", background: loading ? "rgba(0,100,200,0.3)" : "linear-gradient(135deg,#0066ff,#0099ff)",
                color: "#fff", fontSize: "15px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 20px rgba(0,120,255,0.4)",
              }}
            >
              {loading ? "⏳ جارٍ الاتصال..." : "📹 ادخل الاجتماع"}
            </button>

            {/* ── دعوة الفريق ── */}
            {humans.length > 0 && (
              <div style={{ marginTop: "24px", textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "#0088cc", letterSpacing: "1.5px", fontWeight: 700, marginBottom: "10px" }}>
                  🔗 روابط دعوة الفريق
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {humans.map((h) => {
                    const link = `${window.location.origin}${window.location.pathname}?humanCode=${encodeURIComponent(h.joinCode)}&agoraMeeting=1`;
                    const copied = copiedId === h.id;
                    return (
                      <div key={h.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 12px", borderRadius: "8px",
                        background: "rgba(0,30,70,0.6)", border: "1px solid rgba(0,100,200,0.3)",
                        gap: "10px",
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                          <span style={{ color: "#aaccff", fontSize: "12px", fontWeight: 600 }}>{h.name}</span>
                          <span style={{ color: "#446", fontSize: "10px" }}>{h.role}</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(link).then(() => {
                              setCopiedId(h.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            });
                          }}
                          style={{
                            padding: "4px 12px", borderRadius: "6px", flexShrink: 0,
                            border: `1px solid ${copied ? "rgba(0,200,80,0.5)" : "rgba(0,150,255,0.4)"}`,
                            background: copied ? "rgba(0,200,80,0.15)" : "rgba(0,60,120,0.5)",
                            color: copied ? "#00dd66" : "#66aaff",
                            fontSize: "11px", cursor: "pointer", transition: "all 0.2s",
                          }}
                        >
                          {copied ? "✓ تم النسخ" : "نسخ الرابط"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Video grid ── */}
        {joined && (
          <>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "12px",
              justifyContent: "center", minHeight: "160px", marginBottom: "20px",
            }}>
              <LocalVideoTile
                track={videoTrack.current}
                muted={videoMuted}
                name={myName}
              />
              {remoteUsers.map((u) => (
                <RemoteVideoTile
                  key={u.uid}
                  user={u}
                  name={`مشارك ${u.uid}`}
                />
              ))}
              {remoteUsers.length === 0 && (
                <div style={{ color: "#334", fontSize: "12px", alignSelf: "center", textAlign: "center" }}>
                  في انتظار انضمام الآخرين…<br />
                  <span style={{ color: "#0077aa", fontSize: "11px" }}>شارك كود الغرفة: <b>seesaw-{roomId}</b></span>
                </div>
              )}
            </div>

            {/* ── Controls ── */}
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button onClick={toggleAudio} style={ctrlBtn(audioMuted, "#ff4444")}>
                {audioMuted ? "🔇" : "🎤"}
                <span style={{ fontSize: "10px", display: "block" }}>{audioMuted ? "كتم" : "صوت"}</span>
              </button>
              <button onClick={toggleVideo} style={ctrlBtn(videoMuted, "#ff4444")}>
                {videoMuted ? "📵" : "📹"}
                <span style={{ fontSize: "10px", display: "block" }}>{videoMuted ? "كاميرا" : "مرئي"}</span>
              </button>
              <button onClick={() => { leaveChannel(); close(); }} style={ctrlBtn(false, "#cc2222")}>
                📞
                <span style={{ fontSize: "10px", display: "block", color: "#ff6666" }}>إنهاء</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ctrlBtn(active: boolean, activeColor: string): React.CSSProperties {
  return {
    width: "60px", height: "60px", borderRadius: "50%",
    border: `1.5px solid ${active ? activeColor : "rgba(0,150,255,0.4)"}`,
    background: active ? `${activeColor}22` : "rgba(0,30,70,0.6)",
    color: active ? activeColor : "#88aacc",
    fontSize: "20px", cursor: "pointer",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  };
}
