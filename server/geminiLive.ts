/**
 * geminiLive.ts
 * WebSocket proxy: Browser ↔ Server ↔ Gemini Live API
 * يدعم tool calling: GitHub (قراءة/كتابة) + ClickUp (مهام)
 *
 * تدفق الاتصال:
 * 1. Browser يفتح WS → Server يحمّل إعدادات الخزنة
 * 2. Browser يرسل { type:"init", systemPrompt, messages } → Server يتصل بـ Gemini
 * 3. Gemini يرسل setupComplete → Server يرسل { type:"ready" } → Browser يبدأ الميكروفون
 *
 * ✅ system prompt يُرسَل عبر WS message (لا URL param) — لا حد للطول
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server as HttpServer } from "http";
import { getModelByName, getGitHubOwner, getGitHubRepo, getClickUpListId } from "./vaultStore";
import { getRepoContents, createOrUpdateFile, getRepos } from "./github";
import { getTasks, getTask, updateTask, searchTasksByName } from "./clickup";

const GEMINI_LIVE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

// ── تعريف الأدوات ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "get_repo_contents",
    description: "اقرأ محتوى ملف أو قائمة ملفات من مستودع GitHub",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "مسار الملف أو المجلد، اتركه فارغاً للجذر" },
      },
    },
  },
  {
    name: "create_or_update_file",
    description: "أنشئ ملفاً جديداً أو عدّل ملفاً موجوداً في GitHub مع commit",
    parameters: {
      type: "object",
      properties: {
        path:    { type: "string", description: "مسار الملف مثال: README.md أو src/app.ts" },
        content: { type: "string", description: "المحتوى الكامل للملف" },
        message: { type: "string", description: "رسالة الـ commit" },
      },
      required: ["path", "content", "message"],
    },
  },
  {
    name: "get_clickup_tasks",
    description: "اجلب قائمة المهام من ClickUp — يمكن تصفيتها باسم المُكلَّف",
    parameters: {
      type: "object",
      properties: {
        assignee: { type: "string", description: "اسم المستخدم للتصفية (اختياري)" },
      },
    },
  },
  {
    name: "search_clickup_tasks",
    description: "ابحث عن مهام ClickUp بالاسم أو الكلمة المفتاحية",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "نص البحث" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_clickup_task",
    description: "اجلب تفاصيل مهمة ClickUp بالـ ID",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "رقم المهمة" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_clickup_task_status",
    description: "غيّر حالة مهمة ClickUp (مثال: in progress, closed, open)",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "رقم المهمة" },
        status:  { type: "string", description: "الحالة الجديدة: open | in progress | closed" },
      },
      required: ["task_id", "status"],
    },
  },
];

// ── تنفيذ الأدوات ─────────────────────────────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, string>,
  owner: string,
  repo: string,
  listId: string,
  roomId?: string,
): Promise<string> {
  try {
    if (name === "get_repo_contents") {
      if (!owner || !repo) return "GitHub غير مُعدّ في الخزنة";
      const contents = await getRepoContents(owner, repo, args.path || "", roomId);
      if (Array.isArray(contents)) {
        return contents.map((f: any) => `${f.type === "dir" ? "📁" : "📄"} ${f.path}`).join("\n");
      }
      const file = contents as any;
      const text = file.encoding === "base64"
        ? Buffer.from(file.content, "base64").toString("utf-8")
        : file.content;
      return `// ${file.path}\n${text}`;
    }

    if (name === "create_or_update_file") {
      if (!owner || !repo) return "GitHub غير مُعدّ في الخزنة";
      await createOrUpdateFile(owner, repo, args.path, args.content, args.message, roomId);
      return `✅ تم حفظ ${args.path} بنجاح — commit: "${args.message}"`;
    }

    if (name === "get_clickup_tasks") {
      if (!listId) return "ClickUp غير مُعدّ في الخزنة";
      const tasks = await getTasks(listId, roomId);
      const filtered = args.assignee
        ? tasks.filter((t: any) =>
            t.assignees?.some((a: string) =>
              a.toLowerCase().includes(args.assignee.toLowerCase())
            )
          )
        : tasks;
      if (!filtered.length) return "لا توجد مهام" + (args.assignee ? ` مُكلَّفة لـ ${args.assignee}` : "");
      return filtered.map((t: any) =>
        `[${t.id}] ${t.name} — الحالة: ${t.status} — مُكلَّف: ${t.assignees?.join(", ") || "-"}`
      ).join("\n");
    }

    if (name === "search_clickup_tasks") {
      const tasks = await searchTasksByName(args.query, roomId);
      if (!tasks.length) return `لا توجد مهام تحتوي على "${args.query}"`;
      return tasks.map((t: any) =>
        `[${t.id}] ${t.name} — الحالة: ${t.status?.status || t.status} — مُكلَّف: ${t.assignees?.map((a: any) => a.username || a).join(", ") || "-"}`
      ).join("\n");
    }

    if (name === "get_clickup_task") {
      const task = await getTask(args.task_id, roomId);
      return [
        `المهمة: ${task.name}`,
        `الحالة: ${task.status}`,
        `المُكلَّفون: ${task.assignees?.join(", ") || "-"}`,
        `الوصف:\n${task.description || "(بدون وصف)"}`,
      ].join("\n");
    }

    if (name === "update_clickup_task_status") {
      await updateTask(args.task_id, { status: args.status }, roomId);
      return `✅ تم تغيير حالة المهمة [${args.task_id}] إلى "${args.status}"`;
    }

    return `خطأ: الأداة "${name}" غير معروفة`;
  } catch (err: any) {
    return `خطأ في تنفيذ ${name}: ${err.message}`;
  }
}

// ── الاتصال بـ Gemini (يُستدعى بعد استقبال init) ──────────────────────────────
function connectToGemini(
  clientWs: WebSocket,
  apiKey: string,
  systemPrompt: string,
  githubOwner: string,
  githubRepoName: string,
  clickupListId: string,
  roomId: string | undefined,
  initMessages: { role: string; content: string }[],
) {
  const hasTools = !!(githubOwner && githubRepoName) || !!clickupListId;

  const geminiWs = new WebSocket(`${GEMINI_LIVE_URL}?key=${apiKey}`);

  const connectTimeout = setTimeout(() => {
    if (geminiWs.readyState !== WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "error", message: "انتهت مهلة الاتصال بـ Gemini" }));
      geminiWs.terminate();
      clientWs.close();
    }
  }, 10000);

  geminiWs.on("open", () => {
    clearTimeout(connectTimeout);
    const setup: any = {
      setup: {
        model: "models/gemini-2.5-flash-preview-native-audio-dialog",
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } },
          },
        },
        system_instruction: { parts: [{ text: systemPrompt }] },
      },
    };
    if (hasTools) {
      setup.setup.tools = [{ function_declarations: TOOLS }];
      console.log("[GeminiLive] Tools enabled");
    }
    geminiWs.send(JSON.stringify(setup));
  });

  // Gemini → Browser
  geminiWs.on("message", async (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete !== undefined) {
        // أرسل تاريخ المحادثة فور اكتمال setup
        if (initMessages.length > 0) {
          const turns = initMessages.slice(-12).map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));
          geminiWs.send(JSON.stringify({ clientContent: { turns, turnComplete: false } }));
          console.log(`[GeminiLive] Injected ${turns.length} history messages`);
        }
        console.log("[GeminiLive] Ready");
        clientWs.send(JSON.stringify({ type: "ready" }));
      }

      // Tool calls
      if (msg.toolCall?.functionCalls?.length) {
        const responses: any[] = [];
        for (const fc of msg.toolCall.functionCalls) {
          console.log(`[GeminiLive] 🔧 ${fc.name}`, JSON.stringify(fc.args || {}));
          clientWs.send(JSON.stringify({ type: "tool_call", name: fc.name, args: fc.args }));
          const result = await executeTool(
            fc.name, fc.args || {},
            githubOwner, githubRepoName, clickupListId,
            roomId,
          );
          console.log(`[GeminiLive] ✅ ${fc.name} →`, result.slice(0, 100));
          responses.push({ id: fc.id, response: { output: result } });
        }
        geminiWs.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
      }

      // صوت + نص
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

      if (msg.serverContent?.turnComplete) {
        clientWs.send(JSON.stringify({ type: "turn_complete" }));
      }
    } catch (_) {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
    }
  });

  geminiWs.on("error", (err: any) => {
    clearTimeout(connectTimeout);
    const detail = err.message + (err.code ? ` (code: ${err.code})` : "");
    console.error("[GeminiLive] error:", detail);
    if (clientWs.readyState === WebSocket.OPEN)
      clientWs.send(JSON.stringify({ type: "error", message: `Gemini: ${detail}` }));
  });

  geminiWs.on("close", (code: number, reason: Buffer) => {
    const reasonStr = reason?.toString() || "";
    console.log(`[GeminiLive] closed code:${code} ${reasonStr}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      const errMsg = reasonStr
        ? `Gemini أغلق الاتصال: ${reasonStr}`
        : `Gemini أغلق الاتصال (code ${code})`;
      clientWs.send(JSON.stringify({ type: "error", message: errMsg }));
      clientWs.close();
    }
  });

  // Browser → Gemini
  clientWs.on("message", (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (geminiWs.readyState !== WebSocket.OPEN) return;

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
      } else if (msg.type === "interrupt") {
        geminiWs.send(JSON.stringify({ clientContent: { turnComplete: true } }));
      }
      // "init" لو وصل بعد الاتصال — نتجاهله
    } catch (_) {
      if (geminiWs.readyState === WebSocket.OPEN) geminiWs.send(data);
    }
  });

  clientWs.on("close", () => {
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });

  clientWs.on("error", () => {
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });
}

// ── Proxy Setup ───────────────────────────────────────────────────────────────
export function setupGeminiLiveProxy(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/gemini-live" });

  wss.on("connection", (clientWs: WebSocket, req: IncomingMessage) => {
    const url    = new URL(req.url || "/", "http://localhost");
    const roomId = url.searchParams.get("roomId") || undefined;

    console.log(`[GeminiLive] connected room:${roomId || "default"} — waiting for init...`);

    // ── سجّل handler الـ init فوراً (قبل أي async) لتجنّب race condition ──
    // البراوزر يرسل init في ws.onopen مباشرة، لازم نكون جاهزين
    let initResolve!: (data: Buffer) => void;
    const initPromise = new Promise<Buffer>(resolve => { initResolve = resolve; });
    clientWs.once("message", (data: Buffer) => initResolve(data));

    // ── الآن نحمّل إعدادات الخزنة بشكل async ────────────────────────────
    (async () => {
      let apiKey         = "";
      let vaultPrompt    = "";
      let githubOwner    = "";
      let githubRepoName = "";
      let clickupListId  = "";

      try {
        const geminiModel = await getModelByName("Gemini", roomId);
        apiKey      = geminiModel?.apiKey || process.env.GEMINI_API_KEY || "";
        vaultPrompt = geminiModel?.systemPrompt || "";

        const [owner, repo, listId] = await Promise.all([
          getGitHubOwner(roomId),
          getGitHubRepo(roomId),
          getClickUpListId(roomId),
        ]);
        githubOwner    = owner  || "";
        githubRepoName = repo   || "";
        clickupListId  = listId || "";
      } catch (_) {}

      if (!apiKey) {
        clientWs.send(JSON.stringify({ type: "error", message: "Gemini API key غير مُعدّ" }));
        clientWs.close();
        return;
      }

      // ── انتظر رسالة init (قد تكون وصلت مسبقاً أو ستصل لاحقاً) ──────────
      const rawData = await initPromise;

      let robotSystemPrompt = vaultPrompt;
      let initMessages: { role: string; content: string }[] = [];

      try {
        const initMsg = JSON.parse(rawData.toString());
        if (initMsg.type === "init") {
          if (initMsg.systemPrompt) robotSystemPrompt = initMsg.systemPrompt;
          initMessages = Array.isArray(initMsg.messages) ? initMsg.messages : [];
        }
      } catch (_) {}

      // بنِ الـ system prompt النهائي
      let systemPrompt = robotSystemPrompt
        || "أنت مساعد ذكي في مكتب Sillar الرقمي. أجب باختصار وبوضوح.";

      // أضف سياق GitHub / ClickUp
      const ctx: string[] = [];
      if (githubOwner && githubRepoName) ctx.push(`GitHub repo: ${githubOwner}/${githubRepoName}`);
      if (clickupListId) ctx.push(`ClickUp list ID: ${clickupListId}`);
      if (ctx.length) systemPrompt += "\n\n[سياق المشروع]\n" + ctx.join("\n");

      systemPrompt += `

[تعليمات تنفيذ المهام]
عند طلب تنفيذ مهمة:
1. ابحث عنها في ClickUp
2. غيّر حالتها إلى "in progress"
3. اقرأ تفاصيلها
4. نفّذ ما تطلبه
5. غيّر حالتها إلى "closed"
6. أبلغ المستخدم بالنتيجة`;

      console.log(`[GeminiLive] init — prompt:${systemPrompt.slice(0, 80)}... msgs:${initMessages.length}`);

      connectToGemini(
        clientWs,
        apiKey,
        systemPrompt,
        githubOwner,
        githubRepoName,
        clickupListId,
        roomId,
        initMessages,
      );
    })();
  });

  console.log("[GeminiLive] Proxy ready on /ws/gemini-live");
}
