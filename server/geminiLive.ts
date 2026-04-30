/**
 * geminiLive.ts
 * WebSocket proxy: Browser ↔ Server ↔ Gemini Live API
 * الـ API key يبقى على السيرفر (آمن)
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server as HttpServer } from "http";
import { getModelByName } from "./vaultStore";

const GEMINI_LIVE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

export function setupGeminiLiveProxy(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/gemini-live" });

  wss.on("connection", async (clientWs: WebSocket, req: IncomingMessage) => {
    // استخرج roomId من الـ query string
    const url   = new URL(req.url || "/", "http://localhost");
    const roomId = url.searchParams.get("roomId") || undefined;
    const systemPrompt = url.searchParams.get("system") || "أنت مساعد ذكي في مكتب Sillar الرقمي. أجب باختصار وبوضوح.";

    // اجلب الـ API key من الخزنة
    let apiKey = "";
    try {
      const geminiModel = await getModelByName("Gemini", roomId);
      apiKey = geminiModel?.apiKey || process.env.GEMINI_API_KEY || "";
    } catch (_) {}

    if (!apiKey) {
      console.warn("[GeminiLive] No API key found for room:", roomId);
      clientWs.send(JSON.stringify({ type: "error", message: "Gemini API key غير مُعدّ — أضف موديل باسم 'Gemini' في الخزنة" }));
      clientWs.close();
      return;
    }

    console.log(`[GeminiLive] Client connected (room: ${roomId || "default"}) key: ${apiKey.slice(0,8)}...`);

    // افتح connection مع Gemini
    const geminiWs = new WebSocket(`${GEMINI_LIVE_URL}?key=${apiKey}`);

    // timeout للاتصال
    const connectTimeout = setTimeout(() => {
      if (geminiWs.readyState !== WebSocket.OPEN) {
        console.error("[GeminiLive] Connection timeout");
        clientWs.send(JSON.stringify({ type: "error", message: "انتهت مهلة الاتصال بـ Gemini" }));
        geminiWs.terminate();
        clientWs.close();
      }
    }, 10000);

    geminiWs.on("open", () => {
      clearTimeout(connectTimeout);
      console.log("[GeminiLive] Gemini WS opened — sending setup");
      // أرسل setup message أول شيء
      const setup = {
        setup: {
          model: "models/gemini-2.0-flash-live-001",
          generation_config: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } },
            },
          },
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
        },
      };
      geminiWs.send(JSON.stringify(setup));
      clientWs.send(JSON.stringify({ type: "ready" }));
      console.log(`[GeminiLive] Connected to Gemini`);
    });

    // Gemini → Browser
    geminiWs.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // صوت من Gemini
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.mimeType?.startsWith("audio/")) {
              clientWs.send(JSON.stringify({
                type: "audio",
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
              }));
            }
            if (part.text) {
              clientWs.send(JSON.stringify({ type: "text", text: part.text }));
            }
          }
        }

        // إشارة انتهاء الكلام
        if (msg.serverContent?.turnComplete) {
          clientWs.send(JSON.stringify({ type: "turn_complete" }));
        }

        // setup done
        if (msg.setupComplete !== undefined) {
          clientWs.send(JSON.stringify({ type: "setup_complete" }));
        }
      } catch (_) {
        // forward raw
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
      }
    });

    geminiWs.on("error", (err) => {
      clearTimeout(connectTimeout);
      console.error("[GeminiLive] Gemini WS error:", err.message);
      if (clientWs.readyState === WebSocket.OPEN)
        clientWs.send(JSON.stringify({ type: "error", message: `Gemini error: ${err.message}` }));
    });

    geminiWs.on("close", () => {
      console.log("[GeminiLive] Gemini closed");
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: "closed" }));
        clientWs.close();
      }
    });

    // Browser → Gemini
    clientWs.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (geminiWs.readyState !== WebSocket.OPEN) return;

        if (msg.type === "audio") {
          // صوت من المايكروفون → Gemini
          geminiWs.send(JSON.stringify({
            realtime_input: {
              media_chunks: [{
                mime_type: "audio/pcm;rate=16000",
                data: msg.data,
              }],
            },
          }));
        } else if (msg.type === "text") {
          // نص → Gemini
          geminiWs.send(JSON.stringify({
            client_content: {
              turns: [{ role: "user", parts: [{ text: msg.text }] }],
              turn_complete: true,
            },
          }));
        } else if (msg.type === "interrupt") {
          // قاطع الكلام
          geminiWs.send(JSON.stringify({ client_content: { turn_complete: true } }));
        }
      } catch (_) {
        if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(data);
      }
    });

    clientWs.on("close", () => {
      console.log("[GeminiLive] Client disconnected");
      if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
    });

    clientWs.on("error", (err) => {
      console.error("[GeminiLive] Client WS error:", err.message);
      if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
    });
  });

  console.log("[GeminiLive] Proxy ready on /ws/gemini-live");
}
