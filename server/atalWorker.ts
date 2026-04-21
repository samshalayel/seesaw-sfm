/**
 * atalWorker.ts — العتال 🏭
 * روبوت خلفي مستقل: يبحث عن الروبوت المعرّف بـ "عتال" في الـ vault
 * ويستخدم موديله وأدواته لرفع الملفات على GitHub تلقائياً.
 */

import OpenAI from "openai";
import { createOrUpdateFile } from "./github";
import { getVaultSettings, getModels, getHallWorkers } from "./vaultStore";

export interface AtalFile {
  id:      string;
  roomId:  string;
  path:    string;
  content: string;
  addedAt: number;
  status:  "pending" | "uploading" | "done" | "error";
  error?:  string;
}

// ── Queue ─────────────────────────────────────────────────────────────────────
const queue: AtalFile[] = [];
const MAX_QUEUE = 200;

export function atalEnqueue(roomId: string, path: string, content: string): AtalFile {
  const file: AtalFile = {
    id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    roomId,
    path:    path.trim().replace(/^\/+/, ""),
    content,
    addedAt: Date.now(),
    status:  "pending",
  };
  queue.unshift(file);
  if (queue.length > MAX_QUEUE) queue.splice(MAX_QUEUE);
  console.log(`[عتال] ✉️  queued: ${path} (room: ${roomId})`);
  return file;
}

export function atalGetQueue(roomId?: string): AtalFile[] {
  return roomId ? queue.filter(f => f.roomId === roomId) : [...queue];
}

export function atalClearDone(roomId: string) {
  const removed = queue.filter(f => f.roomId === roomId && (f.status === "done" || f.status === "error")).length;
  queue.splice(0, queue.length, ...queue.filter(
    f => !(f.roomId === roomId && (f.status === "done" || f.status === "error"))
  ));
  console.log(`[عتال] 🧹 cleared ${removed} entries (room: ${roomId})`);
}

// ── File detector ─────────────────────────────────────────────────────────────
// Block format:  [FILE:path/name.json]\ncontent\n[/FILE]
// Inline format: [FILE:path/name.json:content]  (legacy, no ] allowed in content)
const BLOCK_PATTERN  = /\[FILE:([^\]\n]+)\]\s*\n([\s\S]*?)\[\/FILE\]/g;
const INLINE_PATTERN = /\[FILE:([^\]:]+):([^\]]*)\]/g;

export function extractFiles(text: string): Array<{ path: string; content: string }> {
  const results: Array<{ path: string; content: string }> = [];
  let match: RegExpExecArray | null;

  // Block format first (handles JSON with ] in content)
  BLOCK_PATTERN.lastIndex = 0;
  while ((match = BLOCK_PATTERN.exec(text)) !== null) {
    results.push({ path: match[1].trim(), content: match[2].trim() });
  }

  // Inline format fallback (legacy)
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    const path = match[1].trim();
    if (!results.find(r => r.path === path)) {
      results.push({ path, content: match[2] });
    }
  }

  return results;
}

// ── ابحث عن روبوت العتال في الـ vault ────────────────────────────────────────
async function findAtalRobot(roomId: string) {
  const [models, hallWorkers] = await Promise.all([
    getModels(roomId),
    getHallWorkers(roomId),
  ]);
  const all = [...models, ...hallWorkers];
  return all.find(m =>
    m.alias?.includes("عتال") ||
    m.name?.includes("عتال") ||
    m.alias?.toLowerCase().includes("atal") ||
    m.name?.toLowerCase().includes("atal")
  );
}

// ── Provider config (مطابق لـ routes.ts) ─────────────────────────────────────
function getBaseURL(name: string): string | undefined {
  const n = name.toLowerCase();
  if (n.includes("groq"))       return "https://api.groq.com/openai/v1";
  if (n.includes("gemini"))     return "https://generativelanguage.googleapis.com/v1beta/openai/";
  if (n.includes("mistral"))    return "https://api.mistral.ai/v1";
  if (n.includes("openrouter")) return "https://openrouter.ai/api/v1";
  if (n.includes("glm") || n.includes("opencode")) return "https://open.bigmodel.cn/api/paas/v4/";
  if (n.includes("grok"))       return "https://api.x.ai/v1";
  if (n.includes("huggingface")) return "https://router.huggingface.co/cerebras/v1";
  return undefined;
}

function getDefaultModelId(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("groq"))        return "llama-3.1-8b-instant";
  if (n.includes("gemini"))      return "gemini-2.0-flash";
  if (n.includes("glm") || n.includes("opencode")) return "glm-4.7-flash";
  if (n.includes("huggingface")) return "llama3.1-8b";
  return "gpt-4o-mini";
}

// ── Process one file ──────────────────────────────────────────────────────────
async function processNext() {
  const pending = queue.filter(f => f.status === "pending");
  if (!pending.length) return;

  const file = pending[0];
  file.status = "uploading";
  console.log(`[عتال] 📤 processing: ${file.path} (room: ${file.roomId})`);

  try {
    const vault  = await getVaultSettings(file.roomId);
    const { owner, repo, token } = vault.github;

    if (!owner || !repo || !token) {
      file.status = "error";
      file.error  = "GitHub غير مُعدّ في إعدادات الخزنة";
      return;
    }

    // ابحث عن روبوت العتال
    const atalBot = await findAtalRobot(file.roomId);

    if (atalBot && atalBot.apiKey) {
      // ── استخدم موديل العتال المعرّف ─────────────────────────────────────
      console.log(`[عتال] 🤖 using robot: ${atalBot.alias || atalBot.name} (${atalBot.name})`);
      const baseURL  = getBaseURL(atalBot.name);
      const modelId  = atalBot.modelId?.trim() || getDefaultModelId(atalBot.name);
      const client   = new OpenAI({ apiKey: atalBot.apiKey, ...(baseURL ? { baseURL } : {}) });

      const prompt =
        `ارفع الملف التالي على GitHub فوراً بدون أي نص إضافي:\n` +
        `- المالك: ${owner}\n- الريبو: ${repo}\n` +
        `- المسار: ${file.path}\n- المحتوى:\n${file.content}\n` +
        `استخدم create_or_update_file الآن.`;

      const tool: OpenAI.Chat.Completions.ChatCompletionTool = {
        type: "function",
        function: {
          name: "create_or_update_file",
          description: "Creates or updates a file in a GitHub repository",
          parameters: {
            type: "object",
            properties: {
              owner:          { type: "string" },
              repo:           { type: "string" },
              path:           { type: "string" },
              content:        { type: "string" },
              commit_message: { type: "string" },
            },
            required: ["owner", "repo", "path", "content", "commit_message"],
          },
        },
      };

      const response = await (client.chat.completions.create as any)({
        model: modelId,
        messages: [
          ...(atalBot.systemPrompt ? [{ role: "system" as const, content: atalBot.systemPrompt }] : []),
          { role: "user" as const, content: prompt },
        ],
        tools: [tool],
        max_tokens: 1024,
      });

      const choice = response.choices[0];
      if (choice.message.tool_calls?.length) {
        const tc   = choice.message.tool_calls[0];
        const args = JSON.parse(tc.function.arguments);
        await createOrUpdateFile(
          args.owner || owner,
          args.repo  || repo,
          args.path  || file.path,
          file.content,
          args.commit_message || `[عتال] auto-upload: ${file.path}`
        );
        console.log(`[عتال] ✅ robot uploaded: ${file.path}`);
      } else {
        // الموديل ما استخدم الـ tool — نرفع مباشرة كـ fallback
        console.warn(`[عتال] ⚠️ robot didn't use tool, falling back to direct upload`);
        await createOrUpdateFile(owner, repo, file.path, file.content, `[عتال] auto-upload: ${file.path}`);
      }
    } else {
      // ── لا يوجد روبوت عتال — رفع مباشر ─────────────────────────────────
      console.log(`[عتال] 📁 no atal robot found, direct upload`);
      await createOrUpdateFile(owner, repo, file.path, file.content, `[عتال] auto-upload: ${file.path}`);
    }

    file.status = "done";
  } catch (err: any) {
    file.status = "error";
    file.error  = err.message;
    console.error(`[عتال] ❌ error: ${file.path} —`, err.message);
  }
}

// ── Worker loop ───────────────────────────────────────────────────────────────
let workerRunning = false;

export function startAtalWorker(intervalMs = 30_000) {
  if (workerRunning) return;
  workerRunning = true;
  console.log(`[عتال] 🏭 worker started (interval: ${intervalMs / 1000}s)`);
  setInterval(processNext, intervalMs);
  processNext();
}
