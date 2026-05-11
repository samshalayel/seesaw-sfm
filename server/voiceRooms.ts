/**
 * voiceRooms.ts — seesaw
 * غرف صوتية جماعية: عدة مشاركين + Gemini Live session مشتركة
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server as HttpServer } from "http";
import fs from "fs";
import path from "path";
import type { Express } from "express";
import { getModelByName } from "./vaultStore";

const VOICE_SETTINGS_FILE = path.join(process.cwd(), "data/voice-rooms-settings.json");

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
  pendingAudio: string[];
  audioQueues:  Map<string, Buffer[]>;
  mixPending:   boolean;
}

// ─── خلط PCM int16 من عدة مشاركين ─────────────────────────────────────────
function mixPCMBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  const maxLen = Math.max(...buffers.map(b => b.length));
  const len = maxLen % 2 === 0 ? maxLen : maxLen - 1;
  const result = Buffer.alloc(len, 0);

  for (const buf of buffers) {
    const count = Math.floor(Math.min(buf.length, len) / 2);
    for (let i = 0; i < count; i++) {
      const offset   = i * 2;
      const existing = result.readInt16LE(offset);
      const sample   = buf.readInt16LE(offset);
      const mixed    = Math.max(-32768, Math.min(32767, existing + sample));
      result.writeInt16LE(mixed, offset);
    }
  }
  return result;
}

// ─── مخزن الغرف ────────────────────────────────────────────────────────────
const rooms = new Map<string, VoiceRoom>();

// ─── مساعدات ───────────────────────────────────────────────────────────────

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function toList(room: VoiceRoom) {
  return Array.from(room.participants.values()).map(p => ({ id: p.id, name: p.name }));
}

function sendAll(room: VoiceRoom, msg: object, exclude?: WebSocket) {
  const raw = JSON.stringify(msg);
  Array.from(room.participants.values()).forEach(p => {
    if (p.ws !== exclude && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(raw);
    }
  });
}

// ─── جلب مفتاح Gemini: الخزنة الصوتية → vaultStore → .env ───────────────
async function loadGeminiConfig(roomId?: string): Promise<{ apiKey: string; systemPrompt: string }> {
  const defaultPrompt = "أنت مساعد ذكي في غرفة اجتماع جماعية.";

  // 1. ملف إعدادات الغرف الصوتية (من تبويب الخزنة)
  try {
    const raw = fs.readFileSync(VOICE_SETTINGS_FILE, "utf-8");
    const cfg = JSON.parse(raw);
    if (cfg.geminiKey) {
      return { apiKey: cfg.geminiKey, systemPrompt: cfg.systemPrompt || defaultPrompt };
    }
  } catch { /* الملف غير موجود */ }

  // 2. vaultStore (موديل اسمه "Gemini")
  try {
    const model = await getModelByName("Gemini", roomId);
    if (model?.apiKey) {
      return { apiKey: model.apiKey, systemPrompt: model.systemPrompt || defaultPrompt };
    }
  } catch { /* ignore */ }

  // 3. متغير بيئي
  return { apiKey: process.env.GEMINI_API_KEY || "", systemPrompt: defaultPrompt };
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
    const fullPrompt =
      systemPrompt +
      "\n\n[ملاحظة: أنت في غرفة صوتية جماعية. عدة أشخاص قد يتحدثون معك. " +
      "حدد من يتكلم إذا عُرِّفوا لك. أجب بشكل طبيعي وودي على الجميع.]";

    geminiWs.send(JSON.stringify({
      setup: {
        model: "models/gemini-2.0-flash-exp",
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

      if (!msg.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData)) {
        console.log(`[VoiceRoom] Gemini msg:`, raw.slice(0, 200));
      }

      if (msg.setupComplete !== undefined) {
        room.geminiReady = true;
        const robotId = `robot-${room.id}`;
        sendAll(room, { type: "ready" });
        const robotParticipant = { id: robotId, name: "🤖 Gemini" };
        sendAll(room, {
          type: "participant_joined",
          participant: robotParticipant,
          participants: [...toList(room), robotParticipant],
        });
        for (const raw of room.pendingAudio) {
          if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(raw);
        }
        room.pendingAudio = [];
        console.log(`[VoiceRoom] Gemini ready for room ${room.id}`);
        return;
      }

      const audioParts =
        msg.serverContent?.modelTurn?.parts?.filter(
          (p: any) => p.inlineData?.mimeType?.startsWith("audio/")
        ) || [];
      for (const part of audioParts) {
        sendAll(room, { type: "participant_audio", participantId: `robot-${room.id}`, data: part.inlineData.data });
      }

      const textParts =
        msg.serverContent?.modelTurn?.parts?.filter((p: any) => p.text) || [];
      for (const part of textParts) {
        sendAll(room, { type: "text", text: part.text });
      }

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

  // REST: إنشاء غرفة
  app.post("/api/voice-rooms", (req, res) => {
    const { name } = (req as any).body || {};
    const id = shortId();
    const room: VoiceRoom = {
      id, name: name?.trim() || `غرفة ${id}`,
      createdAt: new Date(), geminiWs: null, geminiReady: false,
      participants: new Map(), pendingAudio: [], audioQueues: new Map(), mixPending: false,
    };
    rooms.set(id, room);
    console.log(`[VoiceRoom] Created room ${id}: "${room.name}"`);
    res.json({ id, name: room.name });
  });

  // REST: معلومات غرفة
  app.get("/api/voice-rooms/:id", (req, res) => {
    const room = rooms.get(req.params.id.toUpperCase());
    if (!room) return res.status(404).json({ error: "الغرفة غير موجودة" });
    res.json({ id: room.id, name: room.name, participants: toList(room), geminiReady: room.geminiReady });
  });

  // REST: قائمة الغرف
  app.get("/api/voice-rooms", (_req, res) => {
    const list = Array.from(rooms.values()).map(r => ({
      id: r.id, name: r.name, count: r.participants.size,
    }));
    res.json(list);
  });

  // WebSocket — noServer: true لتجنّب تعارض upgrade events مع geminiLive WSS
  const wss = externalWss ?? new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket: any, head: Buffer) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/ws/voice-room") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (clientWs: WebSocket, req: IncomingMessage) => {
    const url   = new URL(req.url || "", "http://x");
    const rId   = (url.searchParams.get("room") || "").toUpperCase();
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

    clientWs.send(JSON.stringify({
      type: "joined", participantId: pId,
      roomId: room.id, roomName: room.name, participants: toList(room),
    }));

    sendAll(room, {
      type: "participant_joined",
      participant: { id: pId, name: pName },
      participants: toList(room),
    }, clientWs);

    if (room.geminiReady) {
      clientWs.send(JSON.stringify({ type: "ready" }));
    }

    // إذا أول مشارك — ابدأ Gemini
    if (!room.geminiWs && room.participants.size === 1) {
      (async () => {
        const { apiKey, systemPrompt } = await loadGeminiConfig();
        if (apiKey) {
          connectGemini(room, apiKey, systemPrompt);
        } else {
          sendAll(room, { type: "error", message: "Gemini API Key غير مُعدّ — أضفه في الخزنة أو GEMINI_API_KEY" });
        }
      })();
    }

    // رسائل من المشارك
    clientWs.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // فيديو: أعد الإرسال لباقي المشاركين
        if (msg.type === "video") {
          const videoMsg = JSON.stringify({ type: "video", participantId: pId, data: msg.data });
          Array.from(room.participants.values()).forEach(p => {
            if (p.id !== pId && p.ws.readyState === WebSocket.OPEN) p.ws.send(videoMsg);
          });
          return;
        }

        // كاميرا مُغلقة
        if (msg.type === "camera_off") {
          sendAll(room, { type: "camera_off", participantId: pId }, clientWs);
          return;
        }

        if (msg.type !== "audio") return;

        // ── إعادة الصوت لباقي المشاركين ──────────────────────────────────
        const audioRelay = JSON.stringify({
          type: "participant_audio",
          participantId: pId,
          participantName: pName,
          data: msg.data,
        });
        Array.from(room.participants.values()).forEach(p => {
          if (p.id !== pId && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(audioRelay);
          }
        });

        // مشارك واحد: أرسل مباشرة
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

        // عدة مشاركين: خزّن ثم اخلط بعد 25ms
        if (!room.audioQueues.has(pId)) room.audioQueues.set(pId, []);
        const pcmBuf = Buffer.from(msg.data, "base64");
        room.audioQueues.get(pId)!.push(pcmBuf);

        if (!room.mixPending) {
          room.mixPending = true;
          setTimeout(() => {
            room.mixPending = false;
            if (!room.geminiReady || room.geminiWs?.readyState !== WebSocket.OPEN) return;
            const chunks: Buffer[] = [];
            Array.from(room.audioQueues.values()).forEach(q => {
              if (q.length > 0) chunks.push(q.shift()!);
            });
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
        type: "participant_left",
        participant: { id: pId, name: pName },
        participants: toList(room),
      });
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

  // تنظيف الغرف الفارغة كل 30 ثانية
  setInterval(() => {
    Array.from(rooms.entries()).forEach(([id, room]) => {
      if (room.participants.size === 0) {
        room.geminiWs?.readyState === WebSocket.OPEN && room.geminiWs.close();
        rooms.delete(id);
        console.log(`[VoiceRoom] Room ${id} cleaned up`);
      }
    });
  }, 30_000);

  console.log("[VoiceRooms] Ready — REST: /api/voice-rooms | WS: /ws/voice-room");
}
