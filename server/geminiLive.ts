/**
 * geminiLive.ts — office-lite
 * WebSocket proxy: Browser ↔ Server ↔ Gemini Live API
 * بسيط: بدون GitHub / ClickUp / VPS — يقرأ الإعدادات من settings.json
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server as HttpServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { google } from "googleapis";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR      = path.join(__dirname, "../data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const UPLOADS_DIR   = path.join(__dirname, "../data/uploads");
const TOKENS_FILE   = path.join(DATA_DIR, "google-tokens.json");

function loadTokens(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8")); }
  catch { return {}; }
}

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID     || "",
    process.env.GOOGLE_CLIENT_SECRET || "",
    process.env.GOOGLE_REDIRECT_URI  || "http://localhost:3001/api/google/callback"
  );
}

async function loadGoogleContext(): Promise<string> {
  const tokens = loadTokens();
  console.log("[GeminiLive] Tokens available:", Object.keys(tokens));
  let context  = "";

  // ── تقويم Google ──────────────────────────────────────────────────────────
  if (tokens?.calendar) {
    try {
      const auth = makeOAuth2Client();
      auth.setCredentials(tokens.calendar);
      const cal = google.calendar({ version: "v3", auth });

      // من بداية اليوم الحالي (لا نفوّت أحداث اليوم)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfMonth = new Date();
      endOfMonth.setDate(endOfMonth.getDate() + 30);

      const result = await cal.events.list({
        calendarId: "primary",
        timeMin: startOfToday.toISOString(),
        timeMax: endOfMonth.toISOString(),
        maxResults: 20,
        singleEvents: true,
        orderBy: "startTime",
      });
      const items = result.data.items || [];
      if (items.length) {
        context += "\n\n[📅 مواعيد التقويم القادمة]\n" +
          items.map(e => `• ${e.summary || "بدون عنوان"} — ${e.start?.dateTime || e.start?.date || ""}`).join("\n");
      } else {
        context += "\n\n[📅 التقويم: لا توجد مواعيد قادمة]";
      }
    } catch (e: any) {
      console.warn("[GeminiLive] Calendar error:", e.message);
    }
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────
  if (tokens?.gmail) {
    try {
      const auth = makeOAuth2Client();
      auth.setCredentials(tokens.gmail);
      const gmail  = google.gmail({ version: "v1", auth });
      const list   = await gmail.users.messages.list({ userId: "me", maxResults: 5, q: "is:inbox is:unread" });
      const msgs   = list.data.messages || [];
      if (msgs.length) {
        const details = await Promise.all(msgs.map(m =>
          gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["Subject", "From"] })
        ));
        context += "\n\n[📧 آخر رسائل البريد غير المقروءة]\n" +
          details.map(d => {
            const h    = d.data.payload?.headers || [];
            const subj = h.find(x => x.name === "Subject")?.value || "(بدون موضوع)";
            const from = h.find(x => x.name === "From")?.value || "";
            return `• من: ${from}\n  الموضوع: ${subj}`;
          }).join("\n");
      } else {
        context += "\n\n[📧 البريد: لا توجد رسائل غير مقروءة]";
      }
    } catch (e: any) {
      console.warn("[GeminiLive] Gmail error:", e.message);
    }
  }

  return context;
}

async function loadFilesContext(): Promise<string> {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return "";
    const files = fs.readdirSync(UPLOADS_DIR);
    if (files.length === 0) return "";
    const parts: string[] = [];
    for (const name of files) {
      try {
        const filePath = path.join(UPLOADS_DIR, name);
        let content = "";
        if (/\.pdf$/i.test(name)) {
          const buf = fs.readFileSync(filePath);
          const data = await pdfParse(buf);
          content = data.text;
        } else {
          content = fs.readFileSync(filePath, "utf-8");
        }
        if (content.trim()) {
          parts.push(`=== ملف: ${name} ===\n${content.slice(0, 150000)}`);
        }
      } catch (e: any) {
        console.warn(`[GeminiLive] Could not read file ${name}:`, e.message);
      }
    }
    console.log(`[GeminiLive] Loaded ${parts.length} file(s) as context`);
    return parts.length > 0 ? "\n\n--- ملفات السياق ---\n" + parts.join("\n\n") : "";
  } catch { return ""; }
}

const GEMINI_LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

function loadSettings(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")); }
  catch { return {}; }
}

// ── Setup Proxy ───────────────────────────────────────────────────────────────
export function setupGeminiLive(httpServer: HttpServer, externalWss?: WebSocketServer) {
  const wss = externalWss ?? new WebSocketServer({ server: httpServer, path: "/ws/gemini-live" });

  wss.on("connection", (clientWs: WebSocket, _req: IncomingMessage) => {
    console.log("[GeminiLive] Client connected — waiting for init...");

    // سجّل handler الـ init فوراً قبل أي async
    let initResolve!: (data: Buffer) => void;
    const initPromise = new Promise<Buffer>(resolve => { initResolve = resolve; });
    clientWs.once("message", (data: Buffer) => initResolve(data));

    (async () => {
      // قراءة الإعدادات
      const settings    = loadSettings();
      let apiKey        = settings.geminiKey || "";
      let systemPrompt  = settings.systemPrompt || "أنت مساعد ذكي ومفيد. أجب باختصار وبوضوح.";
      let initMessages: { role: string; content: string }[] = [];

      // انتظر رسالة init
      const rawData = await initPromise;
      try {
        const initMsg = JSON.parse(rawData.toString());
        if (initMsg.type === "init") {
          if (initMsg.apiKey)       apiKey       = initMsg.apiKey;      // override من العميل
          if (initMsg.systemPrompt) systemPrompt = initMsg.systemPrompt;
          if (Array.isArray(initMsg.messages)) initMessages = initMsg.messages;
        }
      } catch { /* ignore parse errors */ }

      if (!apiKey) {
        clientWs.send(JSON.stringify({ type: "error", message: "Gemini API Key غير مُعدّ — أضفه في الإعدادات" }));
        clientWs.close();
        return;
      }

      console.log(`[GeminiLive] Connecting — prompt: ${systemPrompt.slice(0, 60)}...`);

      // ── اتصال بـ Gemini ───────────────────────────────────────────────────────
      const geminiWs = new WebSocket(`${GEMINI_LIVE_URL}?key=${apiKey}`);

      const connectTimeout = setTimeout(() => {
        if (geminiWs.readyState !== WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: "error", message: "انتهت مهلة الاتصال بـ Gemini" }));
          geminiWs.terminate();
          clientWs.close();
        }
      }, 12000);

      geminiWs.on("open", async () => {
        clearTimeout(connectTimeout);

        const filesCtx   = await loadFilesContext();
        const googleCtx  = await loadGoogleContext();
        const calendarNote = "\n\n[ملاحظة للمساعد: بيانات التقويم المعروضة أعلاه تم تحميلها عند بدء الجلسة. إذا أضاف المستخدم أحداثاً جديدة أو طلب رؤية أحدث المواعيد، استخدم أداة get_calendar_events لجلب البيانات المحدّثة.]";
        const fullSystemPrompt = systemPrompt + filesCtx + googleCtx + (googleCtx.includes("📅") ? calendarNote : "");
        console.log(`[GeminiLive] System prompt: ${fullSystemPrompt.length} chars`);

        geminiWs.send(JSON.stringify({
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generation_config: {
              response_modalities: ["AUDIO"],
              speech_config: {
                voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } },
              },
            },
            system_instruction: { parts: [{ text: fullSystemPrompt }] },
            tools: [{
              functionDeclarations: [
                {
                  name: "create_calendar_event",
                  description: "أضف حدثاً جديداً إلى Google Calendar",
                  parameters: {
                    type: "object",
                    properties: {
                      summary:     { type: "string",  description: "عنوان الحدث" },
                      start:       { type: "string",  description: "وقت البداية ISO 8601 مثال: 2025-05-10T09:00:00" },
                      end:         { type: "string",  description: "وقت النهاية ISO 8601 مثال: 2025-05-10T10:00:00" },
                      description: { type: "string",  description: "وصف الحدث (اختياري)" },
                      location:    { type: "string",  description: "الموقع (اختياري)" },
                    },
                    required: ["summary", "start", "end"],
                  },
                },
                {
                  name: "send_email",
                  description: "أرسل بريداً إلكترونياً عبر Gmail",
                  parameters: {
                    type: "object",
                    properties: {
                      to:      { type: "string", description: "البريد الإلكتروني للمستلم" },
                      subject: { type: "string", description: "موضوع الرسالة" },
                      body:    { type: "string", description: "نص الرسالة" },
                    },
                    required: ["to", "subject", "body"],
                  },
                },
                {
                  name: "get_calendar_events",
                  description: "اجلب أحداث التقويم المحدّثة (استخدمها لمشاهدة أحدث المواعيد أو التحقق من وجود حدث)",
                  parameters: {
                    type: "object",
                    properties: {
                      days: { type: "number", description: "عدد الأيام القادمة التي تريد عرضها (افتراضي: 30)" },
                    },
                    required: [],
                  },
                },
              ],
            }],
          },
        }));
      });

      // Gemini → Browser
      geminiWs.on("message", async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());

          // Setup كامل — أرسل تاريخ المحادثة ثم "ready"
          if (msg.setupComplete !== undefined) {
            if (initMessages.length > 0) {
              const turns = initMessages.slice(-10).map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              }));
              geminiWs.send(JSON.stringify({
                clientContent: { turns, turnComplete: false },
              }));
            }
            clientWs.send(JSON.stringify({ type: "ready" }));
            return;
          }

          // ── Tool calls من Gemini ──────────────────────────────────────────
          if (msg.toolCall?.functionCalls?.length) {
            const results: any[] = [];
            for (const call of msg.toolCall.functionCalls) {
              const args = call.args || {};
              let result = "";

              if (call.name === "create_calendar_event") {
                try {
                  const tokens = loadTokens();
                  if (!tokens?.calendar) { result = "خطأ: التقويم غير مربوط"; }
                  else {
                    const auth = makeOAuth2Client();
                    auth.setCredentials(tokens.calendar);
                    const cal = google.calendar({ version: "v3", auth });
                    const timeZone = "Asia/Jerusalem";
                    const event = await cal.events.insert({
                      calendarId: "primary",
                      requestBody: {
                        summary:     args.summary,
                        description: args.description || "",
                        location:    args.location || "",
                        start: { dateTime: args.start, timeZone },
                        end:   { dateTime: args.end,   timeZone },
                      },
                    });
                    result = `✅ تم إضافة الحدث: "${args.summary}" بنجاح (ID: ${event.data.id})`;
                    console.log("[GeminiLive] Calendar event created:", args.summary);
                  }
                } catch (e: any) {
                  result = `❌ فشل إضافة الحدث: ${e.message}`;
                  console.error("[GeminiLive] Calendar create error:", e.message);
                }
              }

              else if (call.name === "get_calendar_events") {
                try {
                  const tokens = loadTokens();
                  if (!tokens?.calendar) { result = "خطأ: التقويم غير مربوط"; }
                  else {
                    const auth = makeOAuth2Client();
                    auth.setCredentials(tokens.calendar);
                    const cal = google.calendar({ version: "v3", auth });
                    const days = typeof args.days === "number" ? args.days : 30;
                    const startOfToday = new Date();
                    startOfToday.setHours(0, 0, 0, 0);
                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + days);
                    const res2 = await cal.events.list({
                      calendarId: "primary",
                      timeMin: startOfToday.toISOString(),
                      timeMax: endDate.toISOString(),
                      maxResults: 30,
                      singleEvents: true,
                      orderBy: "startTime",
                    });
                    const items = res2.data.items || [];
                    if (items.length === 0) {
                      result = "لا توجد أحداث في التقويم خلال هذه الفترة.";
                    } else {
                      result = items.map(e =>
                        `• ${e.summary || "بدون عنوان"} — ${e.start?.dateTime || e.start?.date || ""}`
                      ).join("\n");
                    }
                    console.log(`[GeminiLive] get_calendar_events: returned ${items.length} events`);
                  }
                } catch (e: any) {
                  result = `❌ خطأ في جلب الأحداث: ${e.message}`;
                }
              }

              else if (call.name === "send_email") {
                try {
                  const tokens = loadTokens();
                  if (!tokens?.gmail) { result = "خطأ: Gmail غير مربوط"; }
                  else {
                    const auth = makeOAuth2Client();
                    auth.setCredentials(tokens.gmail);
                    const gmail = google.gmail({ version: "v1", auth });
                    const msg64 = Buffer.from(
                      `To: ${args.to}\nSubject: =?UTF-8?B?${Buffer.from(args.subject).toString("base64")}?=\nMIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\n\n${args.body}`
                    ).toString("base64url");
                    await gmail.users.messages.send({ userId: "me", requestBody: { raw: msg64 } });
                    result = `✅ تم إرسال البريد إلى ${args.to}`;
                    console.log("[GeminiLive] Email sent to:", args.to);
                  }
                } catch (e: any) {
                  result = `❌ فشل إرسال البريد: ${e.message}`;
                }
              }

              results.push({ id: call.id, name: call.name, response: { result } });
            }

            // أرسل النتائج لـ Gemini
            geminiWs.send(JSON.stringify({
              toolResponse: { functionResponses: results },
            }));
            return;
          }

          // صوت من Gemini
          const audioParts =
            msg.serverContent?.modelTurn?.parts?.filter((p: any) => p.inlineData?.mimeType?.startsWith("audio/")) || [];
          for (const part of audioParts) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: "audio",
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
              }));
            }
          }

          // نص من Gemini
          const textParts =
            msg.serverContent?.modelTurn?.parts?.filter((p: any) => p.text) || [];
          for (const part of textParts) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "text", text: part.text }));
            }
          }

          // نهاية الدور
          if (msg.serverContent?.turnComplete) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "turn_complete" }));
            }
          }

        } catch (e: any) {
          console.error("[GeminiLive] Parse error:", e.message);
        }
      });

      geminiWs.on("error", (err) => {
        console.error("[GeminiLive] Gemini WS error:", err.message);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: "error", message: `خطأ Gemini: ${err.message}` }));
        }
      });

      geminiWs.on("close", (code, reason) => {
        const reasonStr = reason?.toString() || "";
        console.error(`[GeminiLive] Gemini closed — code: ${code}, reason: ${reasonStr}`);

        let errorMsg = "";
        if (code === 1008 || reasonStr.toLowerCase().includes("invalid") || reasonStr.toLowerCase().includes("api key")) {
          errorMsg = "API Key غير صالح أو لا يملك صلاحية Gemini Live";
        } else if (code === 1011) {
          errorMsg = "خطأ داخلي في Gemini — جرّب لاحقاً";
        } else if (code !== 1000 && code !== 1001) {
          errorMsg = reasonStr || `انقطع الاتصال (${code})`;
        }

        if (clientWs.readyState === WebSocket.OPEN) {
          if (errorMsg) {
            clientWs.send(JSON.stringify({ type: "error", message: errorMsg }));
          } else {
            clientWs.send(JSON.stringify({ type: "closed" }));
          }
          clientWs.close();
        }
      });

      // Browser → Gemini (الصوت والنص)
      clientWs.on("message", (data: Buffer) => {
        if (geminiWs.readyState !== WebSocket.OPEN) return;
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === "audio") {
            geminiWs.send(JSON.stringify({
              realtimeInput: {
                audio: { mimeType: "audio/pcm;rate=16000", data: msg.data },
              },
            }));
          } else if (msg.type === "text") {
            geminiWs.send(JSON.stringify({
              clientContent: {
                turns: [{ role: "user", parts: [{ text: msg.text }] }],
                turnComplete: true,
              },
            }));
          }
        } catch { /* ignore */ }
      });

      clientWs.on("close", () => {
        if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
      });

      clientWs.on("error", () => {
        if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
      });

    })();
  });

  console.log("[GeminiLive] Ready on /ws/gemini-live");
}
