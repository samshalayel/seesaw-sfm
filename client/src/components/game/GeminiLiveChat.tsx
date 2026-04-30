/**
 * GeminiLiveChat.tsx
 * زر 🎤 يفتح محادثة صوتية real-time مع Gemini Live API
 * يُستخدم داخل نافذة الشات مع الروبوت
 */

import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  roomId?: string;
  systemPrompt?: string;
  robotName?: string;
}

type Status = "idle" | "connecting" | "ready" | "listening" | "speaking" | "error";

export function GeminiLiveChat({ roomId, systemPrompt, robotName = "الروبوت" }: Props) {
  const [status, setStatus]     = useState<Status>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  const wsRef          = useRef<WebSocket | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const processorRef   = useRef<ScriptProcessorNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const audioQueueRef  = useRef<AudioBuffer[]>([]);
  const isPlayingRef   = useRef(false);
  const nextPlayTimeRef = useRef(0);

  // ── تشغيل صوت Gemini ─────────────────────────────────────────────────────
  const playAudioChunk = useCallback((base64: string, mimeType: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // PCM16 → Float32
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    const sampleRate = mimeType.includes("24000") ? 24000 : 24000;
    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);

    const now = ctx.currentTime;
    if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;

    setStatus("speaking");
  }, []);

  // ── إيقاف كل شيء ─────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
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
  const startSession = useCallback(async () => {
    try {
      setStatus("connecting");
      setErrorMsg("");

      // AudioContext
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });

      // WebSocket → server proxy
      const proto  = location.protocol === "https:" ? "wss" : "ws";
      const host   = location.host;
      const params = new URLSearchParams();
      if (roomId) params.set("roomId", roomId);
      if (systemPrompt) params.set("system", systemPrompt);

      const ws = new WebSocket(`${proto}://${host}/ws/gemini-live?${params}`);
      wsRef.current = ws;

      ws.onmessage = async (ev) => {
        const msg = JSON.parse(ev.data);

        if (msg.type === "ready") {
          // ابدأ المايكروفون
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;

          const ctx    = audioCtxRef.current!;
          const source = ctx.createMediaStreamSource(stream);
          const proc   = ctx.createScriptProcessor(4096, 1, 1);
          processorRef.current = proc;

          proc.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const float32 = e.inputBuffer.getChannelData(0);
            // Float32 → PCM16 → Base64
            const pcm16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
            }
            const bytes = new Uint8Array(pcm16.buffer);
            let binary = "";
            for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
            const b64 = btoa(binary);
            ws.send(JSON.stringify({ type: "audio", data: b64 }));
          };

          source.connect(proc);
          proc.connect(ctx.destination);
          setStatus("listening");
        }

        if (msg.type === "audio") {
          playAudioChunk(msg.data, msg.mimeType || "audio/pcm;rate=24000");
        }

        if (msg.type === "text" && msg.text) {
          setTranscript(t => t + msg.text);
        }

        if (msg.type === "turn_complete") {
          setStatus("listening");
          setTranscript("");
        }

        if (msg.type === "setup_complete") {
          setStatus("listening");
        }

        if (msg.type === "error") {
          setErrorMsg(msg.message);
          setStatus("error");
          stopAll();
        }

        if (msg.type === "closed") {
          stopAll();
        }
      };

      ws.onerror = () => {
        setErrorMsg("فشل الاتصال بالسيرفر");
        setStatus("error");
      };

      ws.onclose = () => {
        if (status !== "idle") setStatus("idle");
      };

    } catch (err: any) {
      setErrorMsg(err.message || "خطأ غير معروف");
      setStatus("error");
    }
  }, [roomId, systemPrompt, playAudioChunk, stopAll, status]);

  useEffect(() => () => stopAll(), []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const statusInfo: Record<Status, { label: string; color: string; pulse: boolean }> = {
    idle:       { label: "ابدأ محادثة صوتية",     color: "#facc15", pulse: false },
    connecting: { label: "جارٍ الاتصال...",         color: "#94a3b8", pulse: true  },
    ready:      { label: "جاهز...",                color: "#66bb6a", pulse: true  },
    listening:  { label: `🎤 ${robotName} يسمعك`, color: "#42a5f5", pulse: true  },
    speaking:   { label: `🔊 ${robotName} يتكلم`, color: "#c084fc", pulse: true  },
    error:      { label: "خطأ — أعد المحاولة",    color: "#ef5350", pulse: false },
  };
  const si = statusInfo[status];

  return (
    <div style={{ direction: "rtl" }}>
      {/* زر رئيسي */}
      <button
        onClick={status === "idle" || status === "error" ? startSession : stopAll}
        style={{
          width: "100%", padding: "10px 14px",
          borderRadius: "10px", border: `1.5px solid ${si.color}`,
          background: `${si.color}18`,
          color: si.color, fontSize: "13px", fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8,
          transition: "all 0.2s",
          animation: si.pulse ? "livePulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        <span style={{ fontSize: "18px" }}>
          {status === "idle" || status === "error" ? "🎤" :
           status === "speaking" ? "🔊" :
           status === "connecting" ? "⏳" : "🎤"}
        </span>
        {si.label}
        {(status !== "idle" && status !== "error") && (
          <span style={{
            marginRight: "auto", fontSize: "11px", opacity: 0.7,
            color: "#ef5350",
          }}>
            ✕ إيقاف
          </span>
        )}
      </button>

      {/* transcript */}
      {transcript && (
        <div style={{
          marginTop: 8, padding: "8px 12px",
          background: "#c084fc15", border: "1px solid #c084fc30",
          borderRadius: 8, color: "#e2e8f0", fontSize: "12px",
          lineHeight: 1.6, direction: "rtl",
        }}>
          {transcript}
        </div>
      )}

      {/* error */}
      {errorMsg && (
        <div style={{
          marginTop: 6, padding: "6px 10px",
          background: "#ef535015", border: "1px solid #ef535040",
          borderRadius: 7, color: "#ef5350", fontSize: "11px",
        }}>
          ⚠ {errorMsg}
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 0 ${si.color}44; }
          50%       { box-shadow: 0 0 0 8px ${si.color}00; }
        }
      `}</style>
    </div>
  );
}
