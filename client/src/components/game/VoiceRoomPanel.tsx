/**
 * VoiceRoomPanel — غرفة اجتماع صوتية + كاميرا
 */
import React, { useRef, useState, useCallback, useEffect } from "react";

interface RoomInfo    { id: string; name: string; count: number; }
interface Participant { id: string; name: string; }
type Screen = "lobby" | "joined";
type Status = "idle" | "connecting" | "listening" | "speaking" | "error";

interface Props { onClose: () => void; }

export function VoiceRoomPanel({ onClose }: Props) {

  // ── Lobby state ────────────────────────────────────────────────────────────
  const [screen,      setScreen]      = useState<Screen>("lobby");
  const [myName,      setMyName]      = useState("مشارك");
  const [rooms,       setRooms]       = useState<RoomInfo[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating,    setCreating]    = useState(false);
  const [joinCode,    setJoinCode]    = useState("");
  const [anyErr,      setAnyErr]      = useState("");

  // ── Room state ─────────────────────────────────────────────────────────────
  const [roomId,        setRoomId]        = useState("");
  const [roomName,      setRoomName]      = useState("");
  const [participants,  setParticipants]  = useState<Participant[]>([]);
  const [status,        setStatus]        = useState<Status>("idle");
  const [micLevel,      setMicLevel]      = useState(0);
  const [cameraOn,      setCameraOn]      = useState(false);
  const [remoteFrames,  setRemoteFrames]  = useState<Record<string, string>>({});
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef            = useRef<WebSocket | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);   // 16kHz — للميكروفون فقط
  const playbackCtxRef   = useRef<AudioContext | null>(null);   // للتشغيل فقط (سامبل ريت النظام)
  const processorRef     = useRef<ScriptProcessorNode | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const nextPlayTimeRef  = useRef(0);
  const peerPlayTimesRef = useRef<Record<string, number>>({});
  const myParticipantId  = useRef("");
  const micLevelRef      = useRef(0);
  const screenRef        = useRef<Screen>("lobby");

  // ── Camera refs ────────────────────────────────────────────────────────────
  const localVideoRef    = useRef<HTMLVideoElement>(null);
  const videoStreamRef   = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoCanvasRef   = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  // ── جلب الغرف ─────────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    try {
      const res  = await fetch("/api/voice-rooms");
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchRooms();
    const id = setInterval(fetchRooms, 4000);
    return () => clearInterval(id);
  }, [fetchRooms]);

  // ── تشغيل صوت Gemini (PCM 24kHz) ────────────────────────────────────────
  const playAudio = useCallback(async (base64: string) => {
    // استخدم playbackCtx المخصص للتشغيل (سامبل ريت النظام، بدون تعارض مع الميكروفون)
    let ctx = playbackCtxRef.current;
    if (!ctx || ctx.state === "closed") {
      // أعد إنشاء الـ context إذا لم يكن موجوداً
      try {
        ctx = new AudioContext();
        playbackCtxRef.current = ctx;
        nextPlayTimeRef.current = 0;
      } catch (e) {
        console.error("[VoiceRoom] Failed to create playback AudioContext:", e);
        return;
      }
    }

    // انتظر فعلياً حتى يرجع AudioContext للـ running state
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch (e) {
        console.error("[VoiceRoom] Failed to resume playback ctx:", e);
        return;
      }
    }

    try {
      const bytes   = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const pcm16   = new Int16Array(bytes.buffer);
      const float32 = Float32Array.from(pcm16, v => v / 32768);

      // Gemini يرسل PCM 24kHz — نحدد sample rate الصحيح للـ buffer
      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);

      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buf.duration;
      console.log(`[VoiceRoom] Playing audio chunk: ${float32.length} samples, scheduled at ${nextPlayTimeRef.current.toFixed(3)}s`);
      setStatus("speaking");
    } catch (e) {
      console.error("[VoiceRoom] playAudio error:", e);
    }
  }, []);

  // ── تشغيل صوت مشارك آخر (PCM 16kHz) ─────────────────────────────────────
  // مهم: نستخدم playbackCtxRef (مستقل عن Agora) لتجنّب AEC يحذف الصوت
  const playPeerAudio = useCallback((participantId: string, base64: string) => {
    let ctx = playbackCtxRef.current;
    if (!ctx || ctx.state === "closed") {
      try { ctx = new AudioContext(); playbackCtxRef.current = ctx; }
      catch { return; }
    }
    if (ctx.state === "suspended") ctx.resume();
    const bytes   = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const pcm16   = new Int16Array(bytes.buffer);
    const float32 = Float32Array.from(pcm16, v => v / 32768);
    const buf = ctx.createBuffer(1, float32.length, 16000);
    buf.copyToChannel(float32, 0);
    const now = ctx.currentTime;
    if (!peerPlayTimesRef.current[participantId] || peerPlayTimesRef.current[participantId] < now)
      peerPlayTimesRef.current[participantId] = now;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(peerPlayTimesRef.current[participantId]);
    peerPlayTimesRef.current[participantId] += buf.duration;
  }, []);

  // ── إيقاف الكاميرا ────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (videoIntervalRef.current) { clearInterval(videoIntervalRef.current); videoIntervalRef.current = null; }
    videoStreamRef.current?.getTracks().forEach(t => t.stop());
    videoStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    videoCanvasRef.current = null;
    setCameraOn(false);
  }, []);

  // ── مغادرة / تنظيف ────────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    stopCamera();
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
    nextPlayTimeRef.current = 0;
    micLevelRef.current     = 0;
    myParticipantId.current = "";
    setMicLevel(0);
    setRemoteFrames({});
    setSpeakingPeers({});
    setScreen("lobby");
    screenRef.current = "lobby";
    setStatus("idle");
    setParticipants([]);
    setAnyErr("");
    fetchRooms();
  }, [fetchRooms, stopCamera]);

  // ── ربط stream بعنصر الفيديو فور ظهوره في DOM ───────────────────────────
  useEffect(() => {
    if (!cameraOn) return;
    const vid = localVideoRef.current;
    if (!vid || !videoStreamRef.current) return;
    vid.srcObject = videoStreamRef.current;
    vid.play().catch(() => {});
  }, [cameraOn]);

  // ── تشغيل الكاميرا ────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const ws = wsRef.current;
    if (cameraOn) {
      stopCamera();
      ws?.readyState === WebSocket.OPEN &&
        ws.send(JSON.stringify({ type: "camera_off" }));
      return;
    }
    try {
      const vStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      videoStreamRef.current = vStream;

      // canvas لالتقاط الإطارات
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 240;
      videoCanvasRef.current = canvas;

      // نشغّل الإرسال بعد أن يبدأ الفيديو فعلياً
      const startSending = () => {
        videoIntervalRef.current = setInterval(() => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          const vid = localVideoRef.current;
          const ctx2d = canvas.getContext("2d");
          if (!vid || !ctx2d || vid.readyState < 2) return;
          ctx2d.drawImage(vid, 0, 0, 320, 240);
          const jpeg = canvas.toDataURL("image/jpeg", 0.45).split(",")[1];
          ws.send(JSON.stringify({ type: "video", data: jpeg }));
        }, 800); // ~1.25 fps
      };

      // نستمع لـ canplay بعد ظهور العنصر في DOM (useEffect يضبط srcObject)
      const checkReady = () => {
        const vid = localVideoRef.current;
        if (vid) {
          vid.addEventListener("canplay", startSending, { once: true });
        } else {
          // العنصر لم يظهر بعد، انتظر إطار رندر
          requestAnimationFrame(checkReady);
        }
      };

      setCameraOn(true); // يُظهر عنصر <video> في DOM
      requestAnimationFrame(checkReady);

    } catch (e: any) {
      setAnyErr(e.message || "تعذّر تشغيل الكاميرا");
    }
  }, [cameraOn, stopCamera]);

  // ── الانضمام للغرفة ───────────────────────────────────────────────────────
  const joinRoom = useCallback(async (id: string) => {
    setAnyErr("");
    setStatus("connecting");

    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("الميكروفون يتطلب HTTPS أو localhost");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current   = stream;

      // AudioContext للميكروفون فقط (16kHz)
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      // AudioContext منفصل للتشغيل (سامبل ريت النظام — بدون تعارض مع الميك)
      const playbackCtx = new AudioContext();
      playbackCtxRef.current = playbackCtx;
      nextPlayTimeRef.current = 0;
      console.log(`[VoiceRoom] Playback AudioContext created: sampleRate=${playbackCtx.sampleRate}`);

      // keepalive على playbackCtx: oscillator صامت يمنع المتصفح من تعليق الـ context
      const keepAliveOsc = playbackCtx.createOscillator();
      const keepAliveGain = playbackCtx.createGain();
      keepAliveGain.gain.value = 0;
      keepAliveOsc.connect(keepAliveGain);
      keepAliveGain.connect(playbackCtx.destination);
      keepAliveOsc.start();

      const proto = location.protocol === "https:" ? "wss" : "ws";
      const url   = `${proto}://${location.host}/ws/voice-room` +
                    `?room=${id}&name=${encodeURIComponent(myName || "مشارك")}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);

          if (msg.type === "joined") {
            myParticipantId.current = msg.participantId;
            setRoomId(msg.roomId);
            setRoomName(msg.roomName);
            setParticipants(msg.participants || []);
            setScreen("joined");
            screenRef.current = "joined";
          }

          if (msg.type === "ready") {
            const ctx = audioCtxRef.current;
            if (!ctx || ctx.state === "closed") return;
            ctx.resume().catch(() => {});

            let source: MediaStreamAudioSourceNode;
            try { source = ctx.createMediaStreamSource(stream); }
            catch (e: any) { setAnyErr(e.message || "خطأ في الميكروفون"); return; }

            const proc = ctx.createScriptProcessor(2048, 1, 1);
            processorRef.current = proc;

            proc.onaudioprocess = (e) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const f32 = e.inputBuffer.getChannelData(0);
              // VAD
              let sumSq = 0;
              for (let i = 0; i < f32.length; i++) sumSq += f32[i] * f32[i];
              const rms = Math.sqrt(sumSq / f32.length);
              micLevelRef.current = micLevelRef.current * 0.7 + rms * 0.3;
              setMicLevel(Math.min(1, micLevelRef.current * 8));
              // إرسال
              const i16 = new Int16Array(f32.length);
              for (let i = 0; i < f32.length; i++)
                i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
              let bin = "";
              new Uint8Array(i16.buffer).forEach(b => (bin += String.fromCharCode(b)));
              ws.send(JSON.stringify({ type: "audio", data: btoa(bin) }));
            };

            const silentGain = ctx.createGain();
            silentGain.gain.value = 0;
            source.connect(proc);
            proc.connect(silentGain);
            silentGain.connect(ctx.destination);
            setStatus("listening");
          }

          if (msg.type === "audio")          { console.log(`[VoiceRoom] Received audio chunk: ${msg.data?.length ?? 0} chars`); playAudio(msg.data); }
          if (msg.type === "participant_audio") playPeerAudio(msg.participantId, msg.data);
          if (msg.type === "turn_complete")  setStatus("listening");

          if (msg.type === "participant_joined" || msg.type === "participant_left")
            setParticipants(msg.participants || []);

          // ── فيديو من مشارك آخر ──────────────────────────────────────────
          if (msg.type === "video") {
            setRemoteFrames(prev => ({
              ...prev,
              [msg.participantId]: `data:image/jpeg;base64,${msg.data}`,
            }));
          }
          if (msg.type === "camera_off") {
            setRemoteFrames(prev => {
              const next = { ...prev };
              delete next[msg.participantId];
              return next;
            });
          }
          // ── مؤشر كلام المشاركين ─────────────────────────────────────────
          if (msg.type === "speaking") {
            setSpeakingPeers(prev => ({ ...prev, [msg.participantId]: true }));
          }
          if (msg.type === "silent") {
            setSpeakingPeers(prev => { const n = { ...prev }; delete n[msg.participantId]; return n; });
          }

          if (msg.type === "error") {
            setAnyErr(msg.message || "خطأ غير معروف");
            setStatus(prev => (prev === "listening" || prev === "speaking") ? prev : "error");
          }
          if (msg.type === "closed") leaveRoom();

        } catch { /* ignore */ }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        setAnyErr("تعذّر الاتصال بالسيرفر");
        setStatus("error");
        stream.getTracks().forEach(t => t.stop());
        processorRef.current?.disconnect();
        processorRef.current = null;
      };

      ws.onclose = (ev) => {
        if (wsRef.current !== ws) return;
        if (ev.code !== 1000 && ev.code !== 1001 && screenRef.current === "joined")
          leaveRoom();
      };

    } catch (err: any) {
      setAnyErr(err.message || "خطأ في الميكروفون");
      setStatus("error");
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  }, [myName, playAudio, playPeerAudio, leaveRoom]);

  const createRoom = useCallback(async () => {
    const trimmedName = newRoomName.trim() || `غرفة ${myName || "مشارك"}`;
    setCreating(true); setAnyErr("");
    try {
      const res = await fetch("/api/voice-rooms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `خطأ ${res.status}`); }
      const room = await res.json();
      setNewRoomName("");
      await joinRoom(room.id);
    } catch (e: any) { setAnyErr(e.message || "فشل إنشاء الغرفة"); setStatus("idle"); }
    finally { setCreating(false); }
  }, [newRoomName, myName, joinRoom]);

  const joinByCode = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setAnyErr("أدخل كود الغرفة (4+ أحرف)"); return; }
    setAnyErr("");
    await joinRoom(code);
  }, [joinCode, joinRoom]);

  useEffect(() => () => { leaveRoom(); }, []);

  const statusInfo: Record<Status, { label: string; color: string; pulse: boolean }> = {
    idle:       { label: "جاهز",            color: "#94a3b8", pulse: false },
    connecting: { label: "جاري الاتصال...", color: "#f59e0b", pulse: true  },
    listening:  { label: "يسمعك — تكلم",   color: "#3b82f6", pulse: true  },
    speaking:   { label: "Gemini يتكلم...", color: "#a855f7", pulse: true  },
    error:      { label: "تعذّر الاتصال",   color: "#ef4444", pulse: false },
  };
  const si = statusInfo[status];

  // المشاركون الآخرون (بدون أنا)
  const otherParticipants = participants.filter(p => p.id !== myParticipantId.current);

  return (
    <div style={{
      position: "fixed", top: 0, right: 0,
      width: 380, height: "100vh",
      background: "#fff",
      boxShadow: "-6px 0 30px rgba(0,0,0,0.14)",
      display: "flex", flexDirection: "column",
      zIndex: 110, direction: "rtl",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>

      {/* ── رأس اللوحة ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid #ede9e4",
        background: "#faf8f5",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "linear-gradient(135deg,#7c3aed,#3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>🤝</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>
              {screen === "lobby" ? "غرف الاجتماع" : roomName}
            </div>
            <div style={{ fontSize: 11, color: screen === "lobby" ? "#94a3b8" : si.color }}>
              ● {screen === "lobby" ? `${rooms.length} غرفة متاحة` : si.label}
            </div>
          </div>
        </div>
        <button onClick={screen === "joined" ? leaveRoom : onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 22, color: "#999", lineHeight: 1,
        }}>×</button>
      </div>

      {/* ── رسالة خطأ ────────────────────────────────────────────────────────── */}
      {anyErr && (
        <div style={{
          background: "#fef2f2", borderBottom: "1px solid #fca5a5",
          padding: "9px 16px", color: "#ef4444", fontSize: 12.5,
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{anyErr}</span>
          <button onClick={() => setAnyErr("")} style={{
            background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16,
          }}>×</button>
        </div>
      )}

      {/* ══════════════════ شاشة اللوبي ══════════════════ */}
      {screen === "lobby" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>

          <div>
            <label style={labelStyle}>اسمك في الغرفة</label>
            <input value={myName} onChange={e => setMyName(e.target.value)}
              placeholder="ادخل اسمك..." style={inputStyle} />
          </div>

          <div style={{ background: "#f5f3ff", borderRadius: 12, padding: "12px 14px", border: "1px solid #e9d5ff" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 8 }}>➕ إنشاء غرفة جديدة</div>
            <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createRoom()}
              placeholder={`غرفة ${myName || "..."}`} style={inputStyle} />
            <button onClick={createRoom}
              disabled={creating || status === "connecting"}
              style={{
                width: "100%", marginTop: 8, padding: "10px", borderRadius: 8, border: "none",
                background: (creating || status === "connecting") ? "#ccc" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui",
              }}>
              {creating ? "⏳ جاري الإنشاء..." : status === "connecting" ? "⏳ جاري الانضمام..." : "🚀 إنشاء وانضم"}
            </button>
          </div>

          {rooms.length > 0 && (
            <div>
              <label style={labelStyle}>الغرف المتاحة</label>
              {rooms.map(r => (
                <div key={r.id} style={{
                  background: "#fff", border: "1px solid #ede9e4", borderRadius: 10,
                  padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 6,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{r.count} مشارك · #{r.id}</div>
                  </div>
                  <button onClick={() => joinRoom(r.id)} disabled={status === "connecting"}
                    style={{ background: "#1a73e8", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui" }}>
                    {status === "connecting" ? "⏳" : "انضم"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label style={labelStyle}>انضم بكود الغرفة</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && joinByCode()}
                placeholder="مثال: ABCXYZ" maxLength={8}
                style={{ ...inputStyle, flex: 1, direction: "ltr", textAlign: "center", letterSpacing: 3, fontWeight: 700 }} />
              <button onClick={joinByCode} disabled={status === "connecting"}
                style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", fontSize: 13, cursor: "pointer", fontFamily: "system-ui", fontWeight: 600 }}>
                انضم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ شاشة الغرفة ══════════════════ */}
      {screen === "joined" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* ── شبكة الكاميرات ─────────────────────────────────────────────── */}
          {(cameraOn || Object.keys(remoteFrames).length > 0) && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6,
              background: "#0f0f0f", borderRadius: 12, padding: 8,
            }}>
              {/* كاميرتي */}
              {cameraOn && (
                <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", flex: "1 1 160px", maxWidth: "49%" }}>
                  <video ref={localVideoRef} muted autoPlay playsInline
                    style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", transform: "scaleX(-1)", display: "block" }} />
                  <div style={videoLabel}>{myName} · أنت</div>
                </div>
              )}
              {/* كاميرات الآخرين */}
              {Object.entries(remoteFrames).map(([pid, frame]) => {
                const p = participants.find(x => x.id === pid);
                return (
                  <div key={pid} style={{ position: "relative", borderRadius: 8, overflow: "hidden", flex: "1 1 160px", maxWidth: "49%" }}>
                    <img src={frame} alt=""
                      style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                    {speakingPeers[pid] && (
                      <div style={{ position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                    )}
                    <div style={videoLabel}>{p?.name || pid}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── حالة الصوت ─────────────────────────────────────────────────── */}
          <div style={{
            background: `${si.color}12`, border: `1.5px solid ${si.color}40`,
            borderRadius: 12, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
            animation: si.pulse ? "roomPulse 1.5s ease-in-out infinite" : "none",
          }}>
            <span style={{ fontSize: 18 }}>
              {status === "listening" ? "🎤" : status === "speaking" ? "🔊" : status === "connecting" ? "⏳" : "⚠️"}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: si.color }}>{si.label}</span>
            <code style={{ fontSize: 11, color: "#aaa", marginRight: "auto", letterSpacing: 1 }}>#{roomId}</code>
          </div>

          {/* ── المشاركون ──────────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>المشاركون ({otherParticipants.length + 2})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>

              {/* أنا */}
              <div style={rowStyle}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={avatarStyle("#3b82f6")}>👤</div>
                  {status === "listening" && (
                    <div style={{
                      position: "absolute", bottom: -2, right: -2,
                      width: 12, height: 12, borderRadius: "50%",
                      background: micLevel > 0.05 ? "#22c55e" : "#94a3b8",
                      border: "2px solid #fff", transition: "background 0.1s",
                      boxShadow: micLevel > 0.05 ? `0 0 ${4 + micLevel * 8}px #22c55e` : "none",
                    }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{myName}</div>
                  <div style={{ fontSize: 10.5, color: "#3b82f6", display: "flex", alignItems: "center", gap: 4 }}>
                    أنت
                    {status === "listening" && (
                      <>
                        {" · 🎤"}
                        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 12 }}>
                          {[0.15, 0.35, 0.55, 0.75, 1.0].map((t, i) => (
                            <div key={i} style={{
                              width: 3, height: 4 + i * 2, borderRadius: 2,
                              background: micLevel >= t ? "#22c55e" : "#d1d5db",
                              transition: "background 0.1s",
                            }} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Gemini */}
              <div style={rowStyle}>
                <div style={avatarStyle("#a855f7")}>🤖</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Gemini AI</div>
                  <div style={{ fontSize: 10.5, color: "#a855f7" }}>
                    {status === "speaking" ? "🔊 يتكلم..." : status === "connecting" ? "⏳ يتصل..." : "مستمع"}
                  </div>
                </div>
              </div>

              {/* باقي المشاركين */}
              {otherParticipants.map(p => (
                <div key={p.id} style={rowStyle}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={avatarStyle("#0d9488")}>👤</div>
                    {speakingPeers[p.id] && (
                      <div style={{
                        position: "absolute", bottom: -2, right: -2,
                        width: 12, height: 12, borderRadius: "50%",
                        background: "#22c55e", border: "2px solid #fff",
                        boxShadow: "0 0 6px #22c55e",
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: "#0d9488" }}>
                      {speakingPeers[p.id] ? "🎤 يتكلم" : "مستمع"}
                      {remoteFrames[p.id] ? " · 📷" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── أزرار التحكم ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={toggleCamera} style={{
              flex: 1, padding: "11px 8px",
              background: cameraOn ? "#1a1a1a" : "#f0fdf4",
              border: `1.5px solid ${cameraOn ? "#444" : "#86efac"}`,
              borderRadius: 10, color: cameraOn ? "#fff" : "#16a34a",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
              📷 {cameraOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
            </button>
            <button onClick={leaveRoom} style={{
              flex: 1, padding: "11px 8px",
              background: "#fef2f2", border: "1.5px solid #ef4444",
              borderRadius: 10, color: "#ef4444",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui",
            }}>
              🚪 مغادرة
            </button>
          </div>

          {/* ── كود المشاركة ───────────────────────────────────────────────── */}
          <div style={{
            background: "#f8f8f8", borderRadius: 10, padding: "8px 14px",
            border: "1px dashed #ccc", textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>شارك هذا الكود مع الآخرين</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 5, color: "#333" }}>{roomId}</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes roomPulse {
          0%,100% { box-shadow: 0 0 0 0 ${si.color}30; }
          50%      { box-shadow: 0 0 0 7px ${si.color}00; }
        }
      `}</style>
    </div>
  );
}

// ── أنماط مشتركة ──────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11.5, fontWeight: 600,
  color: "#888", marginBottom: 5,
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: "1px solid #ddd8d0", borderRadius: 8,
  padding: "8px 11px", fontSize: 13, outline: "none",
  background: "#faf8f5", direction: "rtl", fontFamily: "system-ui",
};
const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "#faf8f5", borderRadius: 9,
  padding: "8px 10px", border: "1px solid #ede9e4",
};
const videoLabel: React.CSSProperties = {
  position: "absolute", bottom: 5, right: 6,
  fontSize: 10, color: "#fff",
  background: "rgba(0,0,0,0.55)", padding: "2px 6px",
  borderRadius: 4,
};
function avatarStyle(color: string): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: "50%",
    background: color + "18", border: `1.5px solid ${color}44`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, flexShrink: 0,
  };
}
