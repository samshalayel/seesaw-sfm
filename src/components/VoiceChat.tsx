import { useRef, useState, useCallback, useEffect } from "react";

type Status = "idle" | "connecting" | "listening" | "speaking" | "error";

interface Props {
  systemPrompt?: string;
  messages?: { role: string; content: string }[];
  geminiKey?: string;   // اختياري — يُرسل مع init، وإلا يُقرأ من settings.json
}

export function VoiceChat({ systemPrompt, messages = [], geminiKey }: Props) {
  const [status,     setStatus]     = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMsg,   setErrorMsg]   = useState("");

  const wsRef           = useRef<WebSocket | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const processorRef    = useRef<ScriptProcessorNode | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);

  // ── تشغيل صوت Gemini ──────────────────────────────────────────────────────
  const playAudio = useCallback((base64: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pcm16   = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const now = ctx.currentTime;
    if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;
    setStatus("speaking");
  }, []);

  // ── إيقاف الجلسة ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    nextPlayTimeRef.current = 0;
    setStatus("idle");
    setTranscript("");
  }, []);

  // ── بدء الجلسة ────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    try {
      setStatus("connecting");
      setErrorMsg("");

      // تحقق من توفر mediaDevices (يتطلب HTTPS أو localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "الميكروفون يتطلب اتصالاً آمناً.\n" +
          "افتح التطبيق عبر: https أو localhost"
        );
      }

      // 1) اطلب الميكروفون مبكراً
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });

      // 2) افتح WebSocket
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws    = new WebSocket(`${proto}://${location.host}/ws/gemini-live`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "init",
          systemPrompt: systemPrompt || "",
          messages,
          ...(geminiKey ? { apiKey: geminiKey } : {}),
        }));
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);

        if (msg.type === "ready") {
          // ابدأ بث الصوت
          const ctx    = audioCtxRef.current!;
          const source = ctx.createMediaStreamSource(stream);
          const proc   = ctx.createScriptProcessor(4096, 1, 1);
          processorRef.current = proc;

          proc.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const float32 = e.inputBuffer.getChannelData(0);
            const pcm16   = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++)
              pcm16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
            const bytes  = new Uint8Array(pcm16.buffer);
            let bin = "";
            for (let j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
            ws.send(JSON.stringify({ type: "audio", data: btoa(bin) }));
          };

          // نوصل عبر GainNode صامت (gain=0) لتفعيل المعالجة بدون صدى
          const silentGain = ctx.createGain();
          silentGain.gain.value = 0;
          source.connect(proc);
          proc.connect(silentGain);
          silentGain.connect(ctx.destination);
          setStatus("listening");
        }

        if (msg.type === "audio")        playAudio(msg.data);
        if (msg.type === "text" && msg.text) setTranscript(t => t + msg.text);
        if (msg.type === "turn_complete") { setStatus("listening"); setTranscript(""); }
        if (msg.type === "closed")        stop();
        if (msg.type === "error") {
          setErrorMsg(msg.message);
          setStatus("error");
          stream.getTracks().forEach(t => t.stop());
        }
      };

      ws.onerror = () => {
        setErrorMsg("فشل الاتصال بالسيرفر");
        setStatus("error");
      };

    } catch (err: any) {
      setErrorMsg(err.message || "خطأ في الميكروفون");
      setStatus("error");
    }
  }, [systemPrompt, messages, geminiKey, playAudio, stop]);

  useEffect(() => () => stop(), []);

  // ── UI ────────────────────────────────────────────────────────────────────
  const info: Record<Status, { label: string; color: string; icon: string; pulse: boolean }> = {
    idle:       { label: "محادثة صوتية",       color: "#f59e0b", icon: "🎤", pulse: false },
    connecting: { label: "جارٍ الاتصال...",     color: "#94a3b8", icon: "⏳", pulse: true  },
    listening:  { label: "يسمعك — تكلم",       color: "#3b82f6", icon: "🎤", pulse: true  },
    speaking:   { label: "يتكلم...",           color: "#a855f7", icon: "🔊", pulse: true  },
    error:      { label: "خطأ — أعد المحاولة", color: "#ef4444", icon: "⚠️", pulse: false },
  };
  const si = info[status];

  return (
    <div style={{ direction: "rtl" }}>
      <button
        onClick={status === "idle" || status === "error" ? start : stop}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 10,
          border: `1.5px solid ${si.color}`,
          background: `${si.color}18`,
          color: si.color,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily: "system-ui",
          animation: si.pulse ? "voicePulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        <span style={{ fontSize: 17 }}>{si.icon}</span>
        {si.label}
        {status !== "idle" && status !== "error" && (
          <span style={{ marginRight: "auto", fontSize: 11, opacity: 0.6, color: "#ef4444" }}>
            ✕ إيقاف
          </span>
        )}
      </button>

      {transcript && (
        <div style={{
          marginTop: 8, padding: "8px 12px",
          background: "#a855f715",
          border: "1px solid #a855f730",
          borderRadius: 8,
          color: "#555", fontSize: 12.5, lineHeight: 1.6,
        }}>
          {transcript}
        </div>
      )}

      {errorMsg && (
        <div style={{
          marginTop: 6, padding: "6px 10px",
          background: "#ef444415",
          border: "1px solid #ef444440",
          borderRadius: 7,
          color: "#ef4444", fontSize: 11.5,
        }}>
          ⚠ {errorMsg}
        </div>
      )}

      <style>{`
        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 0 0 ${si.color}44; }
          50%       { box-shadow: 0 0 0 8px ${si.color}00; }
        }
      `}</style>
    </div>
  );
}
