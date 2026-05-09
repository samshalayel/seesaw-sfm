/**
 * voiceRooms.ts — office-lite
 * غرف صوتية جماعية: عدة مشاركين + Gemini Live session واحدة مشتركة
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server as HttpServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Express } from "express";

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR      = path.join(__dirname, "../data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const GEMINI_LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

// ─── أنواع ─────────────────────────────────────────────────────────────────

interface Participant {
  ws:   WebSocket;
  name: string;
  id:   string;
}

interface VoiceRoom {
  id:           string;
  name:         string;
  createdAt:    Date;
  geminiWs:     WebSocket | null;
  geminiReady:  boolean;
  participants: Map<string, Participant>;
  pendingAudio: string[];          // JSON strings منتظرة حتى يجهز Gemini
  audioQueues:  Map<string, Buffer[]>;  // قائمة انتظار صوت لكل مشارك
  mixPending:   boolean;           // هل هناك مؤقت مزج نشط
}

// ─── خلط PCM int16 من عدة مشاركين ─────────────────────────────────────────
function mixPCMBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  const maxLen = Math.max(...buffers.map(b => b.length));
  // نضمن أن الطول زوجي (كل عينة 2 بايت)
  const len = maxLen % 2 === 0 ? maxLen : maxLen - 1;
  const result = Buffer.alloc(len, 0);

  for (const buf of buffers) {
    const count = Math.floor(Math.min(buf.length, len) / 2);
    for (let i = 0; i < count; i++) {
      const offset  = i * 2;
      const existing = result.readInt16LE(offset);
      const sample   = buf.readInt16LE(offset);
      // جمع مع تقليص لتجنّب overflow
      const mixed = Math.max(-32768, Math.min(32767, existing + sample));
      result.writeInt16LE(mixed, offset);
    }
  }
  return result;
}

// ─── مخزن الغرف (في الذاكرة) ──────────────────────────────────────────────
const rooms = new Map<string, VoiceRoom>();

// ─── مساعدات ───────────────────────────────────────────────────────────────

function loadSettings(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")); }
  catch { return {}; }
}

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function toList(room: VoiceRoom) {
  return Array.from(room.participants.values()).map(p => ({ id: p.id, name: p.name }));
}

function sendAll(room: VoiceRoom, msg: object, exclude?: WebSocket) {
  const raw = JSON.stringify(msg);
  for (const p of room.participants.values()) {
    if (p.ws !== exclude && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(raw);
    }
  }
}

// ─── اتصال Gemini للغرفة ──────────────────────────────────────────────────

function connectGemini(room: VoiceRoom, apiKey: string, systemPrompt: string) {
  const maskedKey = apiKey.slice(0, 8) + "..." + apiKey.slice(-4);
  console.log(`[VoiceRoom] Connecting Gemini for room ${room.id} (key: ${maskedKey})...`);
  const geminiWs = new WebSocket(`${GEMINI_LIVE_URL}?key=${apiKey}`);
  room.geminiWs = geminiWs;

  const timeout = setTimeout(() => {
    if (geminiWs.readyState !== WebSocket.OPEN) {
      sendAll(room, { type: "error", message: "انتهت مهلة الاتصال بـ Gemini" });
      geminiWs.terminate();
    }
  }, 14000);

  geminiWs.on("open", () => {
    clearTimeout(timeout);
    console.log(`[VoiceRoom] Gemini WS opened for room ${room.id} — sending setup with model: gemini-2.0-flash-exp`);
    const fullPrompt =
      systemPrompt +
      "\n\n[ملاحظة: أنت في غرفة صوتية جماعية. عدة أشخاص قد يتحدثون معك. " +
      "حدد من يتكلم إذا عُرِّفوا لك. أجب بشكل طبيعي وودي على الجميع.]";

    geminiWs.send(JSON.stringify({
      setup: {
        model: "models/gemini-3.1-flash-live-preview",
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } },
          },
        },
        system_instruction: { parts: [{ text: fullPrompt }] },
      },
    }));
  });

  geminiWs.on("message", (data: Buffer) => {
    try {
      const raw = data.toString();
      const msg = JSON.parse(raw);

      // log first non-audio message for debugging
      if (!msg.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData)) {
        console.log(`[VoiceRoom] Gemini msg:`, raw.slice(0, 200));
      }

      // ── Setup كامل ──────────────────────────────────────────────────────
      if (msg.setupComplete !== undefined) {
        room.geminiReady = true;
        sendAll(room, { type: "ready" });
        // flush pending audio
        for (const raw of room.pendingAudio) {
          if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(raw);
        }
        room.pendingAudio = [];
        console.log(`[VoiceRoom] Gemini ready for room ${room.id}`);
        return;
      }

      // ── صوت ─────────────────────────────────────────────────────────────
      const audioParts =
        msg.serverContent?.modelTurn?.parts?.filter(
          (p: any) => p.inlineData?.mimeType?.startsWith("audio/")
        ) || [];
      for (const part of audioParts) {
        sendAll(room, { type: "audio", data: part.inlineData.data });
      }

      // ── نص ──────────────────────────────────────────────────────────────
      const textParts =
        msg.serverContent?.modelTurn?.parts?.filter((p: any) => p.text) || [];
      for (const part of textParts) {
        sendAll(room, { type: "text", text: part.text });
      }

      // ── نهاية الدور ─────────────────────────────────────────────────────
      if (msg.serverContent?.turnComplete) {
        sendAll(room, { type: "turn_complete" });
      }

    } catch (e: any) {
      console.error("[VoiceRoom] Gemini parse error:", e.message);
    }
  });

  geminiWs.on("error", (err) => {
    console.error("[VoiceRoom] Gemini error:", err.message);
    sendAll(room, { type: "error", message: `خطأ Gemini: ${err.message}` });
  });

  geminiWs.on("close", (code, reason) => {
    const reasonStr = reason?.toString() || "";
    console.log(`[VoiceRoom] Gemini closed — code: ${code}, reason: "${reasonStr}"`);
    room.geminiWs    = null;
    room.geminiReady = false;

    let errorMsg = "";
    if (code === 1008 || reasonStr.toLowerCase().includes("api key") || reasonStr.toLowerCase().includes("invalid")) {
      errorMsg = `API Key خطأ (${code}): ${reasonStr || "مرفوض من Gemini"}`;
    } else if (code !== 1000 && code !== 1001) {
      errorMsg = reasonStr || `انقطع الاتصال (${code})`;
    }
    if (errorMsg) sendAll(room, { type: "error", message: errorMsg });
  });
}

// ─── التهيئة الرئيسية ──────────────────────────────────────────────────────

export function setupVoiceRooms(httpServer: HttpServer, app: Express, externalWss?: WebSocketServer) {

  // ── REST: إنشاء غرفة ──────────────────────────────────────────────────
  app.post("/api/voice-rooms", (req, res) => {
    const { name } = (req as any).body || {};
    const id = shortId();
    const room: VoiceRoom = {
      id,
      name:         name?.trim() || `غرفة ${id}`,
      createdAt:    new Date(),
      geminiWs:     null,
      geminiReady:  false,
      participants: new Map(),
      pendingAudio: [],
      audioQueues:  new Map(),
      mixPending:   false,
    };
    rooms.set(id, room);
    console.log(`[VoiceRoom] Created room ${id}: "${room.name}"`);
    res.json({ id, name: room.name });
  });

  // ── REST: معلومات غرفة ────────────────────────────────────────────────
  app.get("/api/voice-rooms/:id", (req, res) => {
    const room = rooms.get(req.params.id.toUpperCase());
    if (!room) return res.status(404).json({ error: "الغرفة غير موجودة" });
    res.json({ id: room.id, name: room.name, participants: toList(room), geminiReady: room.geminiReady });
  });

  // ── REST: قائمة الغرف ─────────────────────────────────────────────────
  app.get("/api/voice-rooms", (_req, res) => {
    const list = Array.from(rooms.values()).map(r => ({
      id: r.id, name: r.name, count: r.participants.size,
    }));
    res.json(list);
  });

  // ── WebSocket: /ws/voice-room?room=ID&name=الاسم ──────────────────────
  const wss = externalWss ?? new WebSocketServer({ server: httpServer, path: "/ws/voice-room" });

  wss.on("connection", (clientWs: WebSocket, req: IncomingMessage) => {
    const url  = new URL(req.url || "", "http://x");
    const rId  = (url.searchParams.get("room") || "").toUpperCase();
    const pName = decodeURIComponent(url.searchParams.get("name") || "مشارك");

    const room = rooms.get(rId);
    if (!room) {
      clientWs.send(JSON.stringify({ type: "error", message: "الغرفة غير موجودة أو انتهت" }));
      clientWs.close();
      return;
    }

    const pId: string = Math.random().toString(36).slice(2, 8);
    room.participants.set(pId, { ws: clientWs, name: pName, id: pId });

    console.log(`[VoiceRoom] "${pName}" joined room ${rId} (${room.participants.size} total)`);

    // أبلغ المشارك الجديد
    clientWs.send(JSON.stringify({
      type:        "joined",
      participantId: pId,
      roomId:      room.id,
      roomName:    room.name,
      participants: toList(room),
    }));

    // أبلغ الباقين
    sendAll(room, {
      type:        "participant_joined",
      participant: { id: pId, name: pName },
      participants: toList(room),
    }, clientWs);

    // إذا Gemini جاهز أصلاً أبلغ المشارك الجديد
    if (room.geminiReady) {
      clientWs.send(JSON.stringify({ type: "ready" }));
    }

    // إذا هذا أول مشارك ابدأ Gemini
    if (!room.geminiWs && room.participants.size === 1) {
      const settings    = loadSettings();
      const apiKey      = settings.geminiKey || "";
      const sysPr       = settings.systemPrompt || "أنت مساعد ذكي.";
      if (apiKey) {
        connectGemini(room, apiKey, sysPr);
      } else {
        sendAll(room, { type: "error", message: "Gemini API Key غير مُعدّ في الإعدادات" });
      }
    }

    // صوت وفيديو من المشارك
    clientWs.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // ── فيديو: أعد الإرسال لباقي المشاركين ─────────────────────────────
        if (msg.type === "video") {
          const videoMsg = JSON.stringify({
            type:          "video",
            participantId: pId,
            data:          msg.data,
          });
          for (const p of room.participants.values()) {
            if (p.id !== pId && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(videoMsg);
            }
          }
          return;
        }

        // ── كاميرا مُغلقة: أبلغ الباقين ────────────────────────────────────
        if (msg.type === "camera_off") {
          sendAll(room, { type: "camera_off", participantId: pId }, clientWs);
          return;
        }

        if (msg.type !== "audio") return;

        // إذا مشارك واحد فقط: أرسل مباشرة بدون مزج
        if (room.participants.size === 1) {
          const raw = JSON.stringify({
            realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: msg.data } },
          });
          if (room.geminiReady && room.geminiWs?.readyState === WebSocket.OPEN) {
            room.geminiWs.send(raw);
          } else if (room.pendingAudio.length < 50) {
            room.pendingAudio.push(raw);
          }
          return;
        }

        // عدة مشاركين: خزّن في قائمة الانتظار ثم اخلط بعد 25ms
        if (!room.audioQueues.has(pId)) room.audioQueues.set(pId, []);
        const pcmBuf = Buffer.from(msg.data, "base64");
        room.audioQueues.get(pId)!.push(pcmBuf);

        if (!room.mixPending) {
          room.mixPending = true;
          setTimeout(() => {
            room.mixPending = false;
            if (!room.geminiReady || room.geminiWs?.readyState !== WebSocket.OPEN) return;

            // اجمع قطعة واحدة من كل مشارك لديه صوت
            const chunks: Buffer[] = [];
            for (const q of room.audioQueues.values()) {
              if (q.length > 0) chunks.push(q.shift()!);
            }
            if (chunks.length === 0) return;

            const mixed   = mixPCMBuffers(chunks);
            const b64data = mixed.toString("base64");
            room.geminiWs!.send(JSON.stringify({
              realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: b64data } },
            }));
          }, 25);
        }
      } catch { /* ignore */ }
    });

    clientWs.on("close", () => {
      room.participants.delete(pId);
      room.audioQueues.delete(pId);
      console.log(`[VoiceRoom] "${pName}" left room ${rId} (${room.participants.size} remaining)`);

      sendAll(room, {
        type:        "participant_left",
        participant: { id: pId, name: pName },
        participants: toList(room),
      });

      // إذا الغرفة فارغة أغلق Gemini وامسح الغرفة
      if (room.participants.size === 0) {
        room.geminiWs?.readyState === WebSocket.OPEN && room.geminiWs.close();
        rooms.delete(rId);
        console.log(`[VoiceRoom] Room ${rId} deleted (empty)`);
      }
    });

    clientWs.on("error", () => {
      room.participants.delete(pId);
      room.audioQueues.delete(pId);
      if (room.participants.size === 0) {
        room.geminiWs?.readyState === WebSocket.OPEN && room.geminiWs.close();
        rooms.delete(rId);
      }
    });
  });

  // ── تنظيف الغرف الفارغة كل 30 ثانية ─────────────────────────────────────
  setInterval(() => {
    for (const [id, room] of rooms.entries()) {
      if (room.participants.size === 0) {
        room.geminiWs?.readyState === WebSocket.OPEN && room.geminiWs.close();
        rooms.delete(id);
        console.log(`[VoiceRoom] Room ${id} cleaned up (empty)`);
      }
    }
  }, 30_000);

  console.log("[VoiceRooms] Ready — REST: /api/voice-rooms | WS: /ws/voice-room");
}
