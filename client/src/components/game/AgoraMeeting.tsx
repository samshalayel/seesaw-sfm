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

  // ── AI (Gemini Live) in meeting ───────────────────────────────────────────
  const [aiActive,     setAiActive]     = useState(false);
  const [aiStatus,     setAiStatus]     = useState<"idle"|"connecting"|"listening"|"speaking"|"error">("idle");
  const [aiTranscript, setAiTranscript] = useState("");
  const [aiError,      setAiError]      = useState("");

  const clientRef    = useRef<IAgoraRTCClient | null>(null);
  const audioTrack   = useRef<IMicrophoneAudioTrack | null>(null);
  const videoTrack   = useRef<ICameraVideoTrack | null>(null);

  // AI bridge refs
  const geminiWsRef       = useRef<WebSocket | null>(null);
  const aiAudioCtxRef     = useRef<AudioContext | null>(null);
  const aiProcessorRef    = useRef<ScriptProcessorNode | null>(null);
  const aiPlaybackCtxRef  = useRef<AudioContext | null>(null);
  const aiDestinationRef  = useRef<MediaStreamAudioDestinationNode | null>(null);
  const aiCustomTrackRef  = useRef<ReturnType<typeof AgoraRTC.createCustomAudioTrack> | null>(null);
  const aiNextPlayTimeRef = useRef(0);
  const aiMixerRef        = useRef<GainNode | null>(null);
  const aiSourcesRef      = useRef<Map<string | number, MediaStreamAudioSourceNode>>(new Map());

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

  // ── AI deactivation ─────────────────────────────────────────────────────────
  const deactivateAI = useCallback(async () => {
    geminiWsRef.current?.close();
    geminiWsRef.current = null;

    aiProcessorRef.current?.disconnect();
    aiProcessorRef.current = null;
    aiMixerRef.current?.disconnect();
    aiMixerRef.current = null;

    aiSourcesRef.current.forEach((s) => { try { s.disconnect(); } catch {} });
    aiSourcesRef.current.clear();

    aiAudioCtxRef.current?.close().catch(() => {});
    aiAudioCtxRef.current = null;

    if (aiCustomTrackRef.current && clientRef.current) {
      try { await clientRef.current.unpublish(aiCustomTrackRef.current); } catch {}
      aiCustomTrackRef.current.stop();
      aiCustomTrackRef.current.close();
    }
    aiCustomTrackRef.current = null;

    aiDestinationRef.current = null;
    aiPlaybackCtxRef.current?.close().catch(() => {});
    aiPlaybackCtxRef.current = null;

    aiNextPlayTimeRef.current = 0;
    setAiActive(false);
    setAiStatus("idle");
    setAiTranscript("");
    setAiError("");
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

  // deactivate AI when leaving meeting
  useEffect(() => {
    if (!joined) deactivateAI();
  }, [joined, deactivateAI]);

  // sync remote audio sources into the AI mixer
  useEffect(() => {
    if (!aiActive || !aiAudioCtxRef.current || !aiMixerRef.current) return;
    const ctx = aiAudioCtxRef.current;
    const mixer = aiMixerRef.current;

    remoteUsers.forEach((u) => {
      if (u.audioTrack && !aiSourcesRef.current.has(u.uid)) {
        try {
          const mst = (u.audioTrack as any).getMediaStreamTrack() as MediaStreamTrack;
          const src = ctx.createMediaStreamSource(new MediaStream([mst]));
          src.connect(mixer);
          aiSourcesRef.current.set(u.uid, src);
        } catch {}
      }
    });

    const uids = new Set(remoteUsers.map((u) => u.uid));
    aiSourcesRef.current.forEach((src, uid) => {
      if (uid !== "local" && !uids.has(uid)) {
        try { src.disconnect(); } catch {}
        aiSourcesRef.current.delete(uid);
      }
    });
  }, [aiActive, remoteUsers]);

  // ── join ─────────────────────────────────────────────────────────────────────
  const joinMeeting = async () => {
    setLoading(true);
    setError("");

    // تحذير HTTPS (لكن لا نمنع الدخول)
    const isSecure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
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

      // 5. أنشئ tracks وانشر — مع fallback تدريجي
      let mic: IMicrophoneAudioTrack | null = null;
      let cam: ICameraVideoTrack | null = null;
      if (isSecure) {
        try {
          const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
          mic = tracks[0];
          cam = tracks[1];
        } catch {
          // الكاميرا غير متاحة — جرب صوت فقط
          try {
            mic = await AgoraRTC.createMicrophoneAudioTrack();
          } catch {
            // الميكروفون أيضاً مرفوض — وضع المراقب
          }
          setVideoMuted(true);
        }
      } else {
        // HTTP — وضع المراقب (بدون كاميرا/ميكروفون)
        setVideoMuted(true);
        setAudioMuted(true);
      }
      audioTrack.current = mic;
      videoTrack.current = cam;
      const tracksToPublish = [mic, cam].filter(Boolean) as any[];
      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
      }

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

  // ── activate AI in meeting ────────────────────────────────────────────────
  const activateAI = async () => {
    if (!clientRef.current || !joined) return;
    setAiActive(true);
    setAiStatus("connecting");
    setAiError("");

    try {
      // capture AudioContext at 16 kHz (Gemini input)
      const capCtx = new AudioContext({ sampleRate: 16000 });
      aiAudioCtxRef.current = capCtx;

      const mixer = capCtx.createGain();
      mixer.gain.value = 1.0;
      aiMixerRef.current = mixer;

      // connect local mic
      if (audioTrack.current) {
        try {
          const mst = audioTrack.current.getMediaStreamTrack();
          const src = capCtx.createMediaStreamSource(new MediaStream([mst]));
          src.connect(mixer);
          aiSourcesRef.current.set("local", src);
        } catch {}
      }

      // connect current remote users
      remoteUsers.forEach((u) => {
        if (u.audioTrack) {
          try {
            const mst = (u.audioTrack as any).getMediaStreamTrack() as MediaStreamTrack;
            const src = capCtx.createMediaStreamSource(new MediaStream([mst]));
            src.connect(mixer);
            aiSourcesRef.current.set(u.uid, src);
          } catch {}
        }
      });

      // playback AudioContext at 24 kHz (Gemini output)
      const playCtx = new AudioContext({ sampleRate: 24000 });
      aiPlaybackCtxRef.current = playCtx;
      await playCtx.resume();
      const dest = playCtx.createMediaStreamDestination();
      aiDestinationRef.current = dest;

      // publish Gemini voice as a custom Agora track
      const geminiTrack = AgoraRTC.createCustomAudioTrack({
        mediaStreamTrack: dest.stream.getAudioTracks()[0],
      });
      aiCustomTrackRef.current = geminiTrack;
      await clientRef.current!.publish(geminiTrack);

      // open WebSocket to Gemini Live proxy
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const qs = new URLSearchParams();
      if (roomId) qs.set("roomId", roomId);
      const ws = new WebSocket(`${proto}://${location.host}/ws/gemini-live?${qs}`);
      geminiWsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "init",
          systemPrompt: [
            "أنت مساعد ذكي في اجتماع عمل جماعي على منصة Seesaw.",
            `عدد المشاركين: ${remoteUsers.length + 1}.`,
            "استمع لجميع المشاركين وأجب باختصار ووضوح.",
            "يمكنك تنفيذ المهام عبر الأدوات المتاحة (GitHub, ClickUp, VPS).",
          ].join(" "),
          messages: [],
        }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);

          if (msg.type === "ready") {
            const proc = capCtx.createScriptProcessor(4096, 1, 1);
            aiProcessorRef.current = proc;

            proc.onaudioprocess = (e: AudioProcessingEvent) => {
              if (!geminiWsRef.current || geminiWsRef.current.readyState !== WebSocket.OPEN) return;
              const f32 = e.inputBuffer.getChannelData(0);
              const pcm = new Int16Array(f32.length);
              for (let i = 0; i < f32.length; i++)
                pcm[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
              const bytes = new Uint8Array(pcm.buffer);
              let bin = "";
              for (let j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
              geminiWsRef.current!.send(JSON.stringify({ type: "audio", data: btoa(bin) }));
            };

            mixer.connect(proc);
            // silent output — prevent double-playing through speakers
            const silence = capCtx.createGain();
            silence.gain.value = 0;
            proc.connect(silence);
            silence.connect(capCtx.destination);
            setAiStatus("listening");
          }

          if (msg.type === "audio") {
            const pCtx = aiPlaybackCtxRef.current;
            const pDest = aiDestinationRef.current;
            if (!pCtx || !pDest) return;
            if (pCtx.state === "suspended") pCtx.resume().catch(() => {});

            const raw = atob(msg.data);
            const u8 = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
            const pcm16 = new Int16Array(u8.buffer);
            const f32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;

            const buf = pCtx.createBuffer(1, f32.length, 24000);
            buf.copyToChannel(f32, 0);

            const now = pCtx.currentTime;
            if (aiNextPlayTimeRef.current < now) aiNextPlayTimeRef.current = now;

            const src = pCtx.createBufferSource();
            src.buffer = buf;
            src.connect(pDest);
            src.start(aiNextPlayTimeRef.current);
            aiNextPlayTimeRef.current += buf.duration;

            setAiStatus("speaking");
          }

          if (msg.type === "text" && msg.text) setAiTranscript((t) => t + msg.text);
          if (msg.type === "turn_complete") { setAiStatus("listening"); setAiTranscript(""); }
          if (msg.type === "tool_call") setAiTranscript(`🔧 ${msg.name}...`);
          if (msg.type === "error") { setAiError(msg.message); setAiStatus("error"); }
        } catch {}
      };

      ws.onerror = () => { setAiError("فشل الاتصال بـ Gemini"); setAiStatus("error"); };
      ws.onclose = () => { setAiActive(false); setAiStatus("idle"); };
    } catch (err: any) {
      setAiError(err.message || "خطأ في تفعيل AI");
      setAiStatus("error");
      deactivateAI();
    }
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
              <button
                onClick={aiActive ? deactivateAI : activateAI}
                disabled={aiStatus === "connecting"}
                style={ctrlBtn(aiActive, "#a855f7")}
              >
                🤖
                <span style={{ fontSize: "10px", display: "block" }}>
                  {aiStatus === "connecting" ? "⏳" : aiActive ? "إيقاف" : "AI"}
                </span>
              </button>
              <button onClick={() => { leaveChannel(); close(); }} style={ctrlBtn(false, "#cc2222")}>
                📞
                <span style={{ fontSize: "10px", display: "block", color: "#ff6666" }}>إنهاء</span>
              </button>
            </div>

            {/* ── Observer mode notice ── */}
            {!audioTrack.current && !videoTrack.current && (
              <div style={{
                marginTop: "8px", textAlign: "center",
                fontSize: "11px", color: "#ffaa44",
                padding: "4px 12px", borderRadius: "8px",
                background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.2)",
              }}>
                👁️ وضع المراقب — الكاميرا والميكروفون غير متاحين. يمكنك مشاهدة وسماع المشاركين وتفعيل AI.
              </div>
            )}

            {/* ── AI status ── */}
            {aiActive && (
              <div style={{
                marginTop: "12px", textAlign: "center",
                padding: "8px 16px", borderRadius: "10px",
                background: aiStatus === "speaking" ? "rgba(168,85,247,0.15)" : "rgba(66,165,245,0.15)",
                border: `1px solid ${aiStatus === "speaking" ? "rgba(168,85,247,0.4)" : "rgba(66,165,245,0.4)"}`,
                transition: "all 0.3s",
              }}>
                <span style={{
                  fontSize: "12px", fontWeight: 600,
                  color: aiStatus === "speaking" ? "#c084fc" : "#42a5f5",
                }}>
                  {aiStatus === "connecting" ? "⏳ جارٍ الاتصال بالذكاء الاصطناعي..." :
                   aiStatus === "listening"  ? "🎤 AI يسمع الاجتماع" :
                   aiStatus === "speaking"   ? "🔊 AI يتحدث" :
                   aiStatus === "error"      ? `⚠️ ${aiError}` : ""}
                </span>
                {aiTranscript && (
                  <div style={{
                    marginTop: "6px", fontSize: "11px",
                    color: "#e2e8f0", lineHeight: 1.5,
                    maxHeight: "60px", overflowY: "auto",
                  }}>
                    {aiTranscript}
                  </div>
                )}
              </div>
            )}
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
