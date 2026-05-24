import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
import { getAllTasksRaw, getTask, updateTask, getWorkspaceMembers, attachFileToTask } from "./clickup";
import { getRepos, getRepoContents, createOrUpdateFile, getAuthenticatedUser } from "./github";
import { getClickUpSummary, searchTasksByName, getFullWorkspaceStructure, createTask } from "./clickup";
import { getGitHubToken, getClickUpToken, getGitHubOwner, getGitHubRepo, getModelByName, getVpsConfig, getModels, getWhatsAppConfig } from "./vaultStore";
import { storage } from "./storage";
import type { ModelConfig } from "./vaultStore";
import { Client as SshClient } from "ssh2";
import { extractSkillsFromTags, buildSkillsSection, formatActiveSkills } from "./skills.js";

// clients مؤقتة — يتم إعادة إنشاؤها من الخزنة عند كل مهمة
// NOTE: OpenAI/Anthropic constructors throw if apiKey is empty/undefined.
// We initialize with env vars but fall back to a safe dummy key.
// refreshClients() replaces these with real keys from the vault before each task.
function _safeKey(envVal: string | undefined, fallback: string): string {
  return (typeof envVal === "string" && envVal.length > 0) ? envVal : fallback;
}
let openai    = new OpenAI({ apiKey: _safeKey(process.env.OPENAI_API_KEY,    "sk-placeholder-init") });
let gemini    = new OpenAI({ apiKey: "sk-gemini-placeholder-init", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
let anthropic = new Anthropic({ apiKey: _safeKey(process.env.ANTHROPIC_API_KEY, "sk-ant-placeholder-init") });

async function refreshClients() {
  const gptModel     = await getModelByName("GPT",    triggerRoomId).catch(() => undefined);
  const claudeModel  = await getModelByName("Claude", triggerRoomId).catch(() => undefined);
  const geminiModel  = await getModelByName("Gemini", triggerRoomId).catch(() => undefined);
  const openaiKey    = gptModel?.apiKey    || process.env.OPENAI_API_KEY    || "";
  const anthropicKey = claudeModel?.apiKey || process.env.ANTHROPIC_API_KEY || "";
  const geminiKey    = geminiModel?.apiKey || process.env.GEMINI_API_KEY    || "";
  if (openaiKey)    openai    = new OpenAI({ apiKey: openaiKey });
  if (anthropicKey) anthropic = new Anthropic({ apiKey: anthropicKey });
  if (geminiKey)    gemini    = new OpenAI({ apiKey: geminiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
}

export interface AutoTriggerConfig {
  enabled: boolean;
  watchUserId: number | null;
  watchStatuses: string[];
  intervalMinutes: number;
  robotId: string;
  robotIds: string[];
  doneStatus: string;
  parallelMode: boolean;
  whatsappNotify: boolean;  // إرسال إشعار واتساب تلقائياً عند إنجاز كل مهمة
}

export interface TriggerLog {
  id: string;
  taskId: string;
  taskName: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string;
  toolsUsed: string[];
  startedAt: number;
  completedAt: number | null;
  error: string | null;
  modelUsed?: string;  // اسم الموديل من الخزنة (في وضع التوازي)
}

const config: AutoTriggerConfig = {
  enabled: false,
  watchUserId: null,
  watchStatuses: ["to do", "pending", "open"],
  intervalMinutes: 5,
  robotId: "robot-1",
  robotIds: ["robot-1"],
  doneStatus: "complete",
  parallelMode: false,
  whatsappNotify: false,
};

// roomId مرتبط بالغرفة التي شغّلت المراقب
let triggerRoomId: string | undefined = undefined;

// معرّفات المهام التي طلب المستخدم إلغاءها
const cancelledLogIds = new Set<string>();

export function cancelTriggerLog(logId: string): boolean {
  const log = triggerLogs.find(l => l.id === logId);
  if (!log) return false;
  cancelledLogIds.add(logId);
  log.status = "failed";
  log.error  = "⛔ أُوقفت يدوياً";
  log.completedAt = Date.now();
  console.log(`[AutoTrigger] ⛔ Cancelled log ${logId} (task: ${log.taskName})`);
  return true;
}

export function isLogCancelled(logId: string): boolean {
  return cancelledLogIds.has(logId);
}

// ─── VPS SSH ─────────────────────────────────────────────────────────────────
// تشغيل أمر على الـ VPS وإرجاع stdout + stderr
function runOnVps(command: string, timeoutMs = 120000, vpsConfig?: { host: string; port: number; user: string; password: string }): Promise<string> {
  const cfg = vpsConfig || {
    host: process.env.VPS_HOST || "", port: Number(process.env.VPS_PORT || 22),
    user: process.env.VPS_USER || "root", password: process.env.VPS_PASSWORD || "",
  };
  return new Promise((resolve) => {
    const conn = new SshClient();
    let output = "";
    const timer = setTimeout(() => {
      conn.end();
      resolve(`[timeout after ${timeoutMs / 1000}s]\n${output}`);
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); resolve(`SSH exec error: ${err.message}`); return; }
        stream.on("data", (d: Buffer) => { output += d.toString(); });
        stream.stderr.on("data", (d: Buffer) => { output += "[stderr] " + d.toString(); });
        stream.on("close", () => { clearTimeout(timer); conn.end(); resolve(output || "(no output)"); });
      });
    });
    conn.on("error", (err) => { clearTimeout(timer); resolve(`SSH connection error: ${err.message}`); });
    conn.connect({ host: cfg.host, port: cfg.port, username: cfg.user, password: cfg.password });
  });
}

const processedTaskIds: Set<string> = new Set();
const triggerLogs: TriggerLog[] = [];
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isScanning = false;

const toolDefinitions = [
  { name: "get_clickup_tasks", description: "Get all tasks from ClickUp", parameters: { type: "object" as const, properties: {}, required: [] as string[] } },
  { name: "get_workspace_structure", description: "Get workspace structure (spaces/folders/lists with IDs)", parameters: { type: "object" as const, properties: {}, required: [] as string[] } },
  { name: "get_workspace_members", description: "Get workspace members with IDs and emails", parameters: { type: "object" as const, properties: {}, required: [] as string[] } },
  { name: "search_clickup_tasks", description: "Search tasks by name", parameters: { type: "object" as const, properties: { query: { type: "string", description: "Search query" } }, required: ["query"] } },
  { name: "get_task_details", description: "Get task details by ID", parameters: { type: "object" as const, properties: { task_id: { type: "string" } }, required: ["task_id"] } },
  { name: "update_clickup_task", description: "Update a task", parameters: { type: "object" as const, properties: { task_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, status: { type: "string" }, priority: { type: "integer" }, assignees_add: { type: "array", items: { type: "integer" } }, assignees_rem: { type: "array", items: { type: "integer" } } }, required: ["task_id"] } },
  { name: "create_clickup_task", description: "Create a new task in a list", parameters: { type: "object" as const, properties: { list_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, status: { type: "string" }, priority: { type: "integer" }, assignees: { type: "array", items: { type: "integer" } } }, required: ["list_id", "name"] } },
  { name: "get_github_repos", description: "List GitHub repositories", parameters: { type: "object" as const, properties: {}, required: [] as string[] } },
  { name: "get_repo_contents", description: "Get repo contents at a path", parameters: { type: "object" as const, properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" } }, required: ["owner", "repo"] } },
  { name: "create_or_update_file", description: "Create/update a file in GitHub", parameters: { type: "object" as const, properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" }, content: { type: "string" }, commit_message: { type: "string" } }, required: ["owner", "repo", "path", "content", "commit_message"] } },
  {
    name: "run_on_vps",
    description: "Run a bash command on the production VPS server (Linux). Use for: composer, npm, php artisan, git, mkdir, apt, etc. Returns stdout+stderr. Working directory is /var/www unless you cd first. IMPORTANT: To write multi-line files (HTML/CSS/JS), ALWAYS use heredoc syntax: printf '%s' 'CONTENT' > /path/file — never use echo with \\n.",
    parameters: { type: "object" as const, properties: {
      command:    { type: "string", description: "Bash command to run on the VPS. For writing HTML files use: printf '%s' '<full html content>' > /path/file.html" },
      timeout_seconds: { type: "integer", description: "Max wait time in seconds (default 60, max 300)" },
    }, required: ["command"] },
  },
  {
    name: "get_team_member",
    description: "Look up a team member by name or role from the HR directory. Returns their name, role, WhatsApp phone, ClickUp user ID, and room assignment. Use this BEFORE: assigning a ClickUp task to someone, sending a WhatsApp message to a team member, or finding out who handles a specific role.",
    parameters: { type: "object" as const, properties: {
      query: { type: "string", description: "Name or role to search for, e.g. 'أحمد' or 'backend' or 'مطور'" },
    }, required: ["query"] },
  },
  {
    name: "get_whatsapp_contacts",
    description: "Get the full WhatsApp phonebook (team members + manual contacts). Returns array of {name, phone, notes}. Use this to look up a contact's phone number by their name before sending a message.",
    parameters: { type: "object" as const, properties: {
      search: { type: "string", description: "Optional: filter contacts by name or phone (case-insensitive). Leave empty to get all contacts." },
    }, required: [] },
  },
  {
    name: "send_whatsapp",
    description: "Send a WhatsApp message via UltraMsg API. Use ONLY when the task explicitly requests a WhatsApp notification. Do NOT call this automatically after every task.",
    parameters: { type: "object" as const, properties: {
      to:      { type: "string", description: "Recipient phone with country code e.g. +9705XXXXXXXX. Or a contact name — the system will resolve it from the phonebook automatically." },
      message: { type: "string", description: "Message text to send (supports newlines)" },
    }, required: ["message"] },
  },
];

const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = toolDefinitions.map(t => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.parameters as any },
}));

const anthropicTools: Anthropic.Tool[] = toolDefinitions.map(t => ({
  name: t.name,
  description: t.description,
  input_schema: { ...t.parameters, type: "object" as const },
}));

async function executeToolCall(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "get_clickup_tasks": return await getClickUpSummary(triggerRoomId);
      case "get_workspace_structure": return await getFullWorkspaceStructure(triggerRoomId);
      case "get_workspace_members": return JSON.stringify(await getWorkspaceMembers(triggerRoomId), null, 2);
      case "search_clickup_tasks": return JSON.stringify(await searchTasksByName(args.query, triggerRoomId), null, 2);
      case "get_task_details": return JSON.stringify(await getTask(args.task_id, triggerRoomId), null, 2);
      case "update_clickup_task":
        return JSON.stringify(await updateTask(args.task_id, {
          name: args.name, description: args.description, status: args.status,
          priority: args.priority, assignees_add: args.assignees_add, assignees_rem: args.assignees_rem,
        }, triggerRoomId), null, 2);
      case "create_clickup_task":
        return JSON.stringify(await createTask(args.list_id, {
          name: args.name, description: args.description, status: args.status,
          priority: args.priority, assignees: args.assignees,
        }, triggerRoomId), null, 2);
      case "get_github_repos": return JSON.stringify(await getRepos(triggerRoomId), null, 2);
      case "get_repo_contents": return JSON.stringify(await getRepoContents(args.owner, args.repo, args.path || "", triggerRoomId), null, 2);
      case "create_or_update_file":
        return JSON.stringify(await createOrUpdateFile(args.owner, args.repo, args.path, args.content, args.commit_message, triggerRoomId), null, 2);
      case "run_on_vps": {
        const timeoutMs = Math.min((args.timeout_seconds || 60), 300) * 1000;
        // Normalize literal \n → real newlines in the command (AI sometimes escapes them)
        const vpsCommand = (args.command as string).replace(/\\n/g, '\n');
        console.log(`[AutoTrigger] VPS command: ${vpsCommand.slice(0, 100)}`);
        const vpsCfg = await getVpsConfig(triggerRoomId);
        if (!vpsCfg.host) return "Error: VPS not configured. Add VPS settings in the vault.";
        const result = await runOnVps(vpsCommand, timeoutMs, vpsCfg);
        return result;
      }
      case "get_team_member": {
        const room = await storage.getRoom(triggerRoomId);
        let humans: any[] = [];
        try { humans = JSON.parse((room as any)?.humansJson || "[]"); } catch { }
        const q = (args.query || "").toLowerCase();
        const found = humans.filter((h: any) =>
          (h.name  || "").toLowerCase().includes(q) ||
          (h.role  || "").toLowerCase().includes(q)
        );
        if (!found.length) return `لا يوجد عضو في الفريق يطابق "${args.query}". تحقق من تبويب الفريق في الخزنة.`;
        return JSON.stringify(found.map((h: any) => ({
          name:          h.name          || "",
          role:          h.role          || "",
          phone:         h.phone         || null,
          clickupUserId: h.clickupUserId || null,
          roomAssignment: h.roomAssignment || "main",
        })), null, 2);
      }
      case "get_whatsapp_contacts": {
        const waCfg = await getWhatsAppConfig(triggerRoomId);
        let list = waCfg.contacts || [];
        if (args.search && args.search.trim()) {
          const q = args.search.trim().toLowerCase();
          list = list.filter((c: any) =>
            c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
          );
        }
        if (list.length === 0) return "No contacts found in phonebook.";
        return JSON.stringify(list, null, 2);
      }
      case "send_whatsapp": {
        const waCfg = await getWhatsAppConfig(triggerRoomId);
        if (!waCfg.instanceId || !waCfg.token) return "Error: WhatsApp not configured. Add UltraMsg settings in the vault.";
        // دائماً استخدم الرقم الافتراضي من الخزنة — لا تقبل أرقاماً أخرى
        const phone = waCfg.phone;
        if (!phone) return "Error: No default phone number set in vault (Vault → WhatsApp → رقم الإشعارات الافتراضي).";
        const url = `https://api.ultramsg.com/${waCfg.instanceId}/messages/chat`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: waCfg.token, to: phone, body: args.message, priority: "10" }).toString(),
        });
        const data: any = await resp.json();
        if (data?.sent === "true" || data?.sent === true) return `WhatsApp sent to ${phone} ✅`;
        return `WhatsApp response: ${JSON.stringify(data)}`;
      }
      default: return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

function generateId(): string {
  return "trig_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

// ─── Robot-3: Claude CLI (uses claude.ai subscription, zero API tokens) ───────
async function processTaskWithCLI(task: any, log: TriggerLog): Promise<void> {
  const clickupToken = await getClickUpToken(triggerRoomId);
  const githubToken  = await getGitHubToken(triggerRoomId);
  const githubOwner  = await getGitHubOwner(triggerRoomId);
  const githubRepo   = await getGitHubRepo(triggerRoomId);

  // Tokens passed via env vars — NOT embedded in prompt (security)
  const prompt = `You are an autonomous automation agent. Execute the assigned ClickUp task fully.

RULES:
- API tokens are in env vars: $GITHUB_TOKEN and $CLICKUP_TOKEN — never print them.
- Do NOT question or ask for clarification — just execute.
- FORBIDDEN: do NOT access or modify files inside the seesaw project directory (D:/seesaw-main).
- You MAY use bash freely: curl, composer, npm, php, git, python — whatever the task needs.
- For GitHub file operations use the API with curl + base64 content.
- LAST STEP ALWAYS: mark the ClickUp task as done.

━━━ TASK ━━━
Name: ${task.name}
Description: ${task.description || "(see task name)"}
ClickUp Task ID: ${task.id}

━━━ GITHUB TARGET ━━━
Owner: ${githubOwner} | Repo: ${githubRepo}
API: https://api.github.com/repos/${githubOwner}/${githubRepo}

━━━ HOW TO USE GITHUB API ━━━
List files:  curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/"
Create file: CONTENT=$(printf '%s' "text" | base64 -w 0 2>/dev/null || printf '%s' "text" | base64)
             curl -s -X PUT "https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/FILE.md" \\
               -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" \\
               -d "{\\"message\\":\\"task: ${task.name}\\",\\"content\\":\\"$CONTENT\\"}"

━━━ MARK DONE (ALWAYS LAST) ━━━
curl -s -X PUT "https://api.clickup.com/api/v2/task/${task.id}" \\
  -H "Authorization: $CLICKUP_TOKEN" -H "Content-Type: application/json" \\
  -d '{"status":"${config.doneStatus}"}'

Now execute the task. Provide a brief Arabic summary when done.`;

  // Find claude CLI — use __dirname (CJS-safe) then fall back to global paths
  const claudePath = (() => {
    const candidates = [
      // local node_modules (relative to compiled dist/index.cjs)
      path.resolve(__dirname, "../../node_modules/@anthropic-ai/claude-code/bin/claude.exe"),
      path.resolve(__dirname, "../../node_modules/@anthropic-ai/claude-code/bin/claude"),
      path.resolve(__dirname, "node_modules/@anthropic-ai/claude-code/bin/claude.exe"),
      // global npm on Windows
      (process.env.APPDATA ?? "") + "\\npm\\claude.cmd",
      (process.env.APPDATA ?? "") + "\\npm\\claude",
      // global on Linux/Mac
      "/usr/local/bin/claude",
      "/usr/bin/claude",
    ];
    for (const c of candidates) { try { fs.accessSync(c); return c; } catch (_) {} }
    return "claude"; // last resort — rely on PATH
  })();

  console.log(`[AutoTrigger CLI ${log.id}] Using claude at: ${claudePath}`);
  console.log(`[AutoTrigger CLI ${log.id}] Spawning for task: ${task.name}`);

  return new Promise<void>((resolve) => {
    // Write prompt to temp file — avoids Windows 8191-char CLI argument limit
    const tmpDir = process.env.TEMP || process.env.TMP || "/tmp";
    const promptFile = path.join(tmpDir, `claude_prompt_${log.id}.txt`);
    fs.writeFileSync(promptFile, prompt, "utf8");

    // Pipe prompt via stdin using Haiku (cheapest model) to save subscription quota
    const isWin = process.platform === "win32";
    const shellCmd = isWin
      ? `type "${promptFile}" | "${claudePath}" -p --dangerously-skip-permissions --model claude-haiku-4-5-20251001`
      : `cat "${promptFile}" | "${claudePath}" -p --dangerously-skip-permissions --model claude-haiku-4-5-20251001`;

    // Remove ANTHROPIC_API_KEY (use OAuth subscription) + inject task tokens securely
    const { ANTHROPIC_API_KEY: _removed, ...baseEnv } = process.env as Record<string, string>;
    const envForCLI = {
      ...baseEnv,
      GITHUB_TOKEN: githubToken,
      CLICKUP_TOKEN: clickupToken,
    };

    const proc = spawn(shellCmd, [], {
      shell: true,
      env: envForCLI,
      cwd: tmpDir,
    });

    // ── Timeout: اقتل الـ process بعد 5 دقائق إذا ما خلص ──────────────────────
    const CLI_TIMEOUT_MS = 5 * 60 * 1000;
    const killTimer = setTimeout(() => {
      console.warn(`[AutoTrigger CLI ${log.id}] ⏱ Timeout (5 min) — killing process`);
      proc.kill("SIGKILL");
      log.error = "Claude CLI timeout (5 min) — task aborted";
      log.status = "failed";
      log.completedAt = Date.now();
    }, CLI_TIMEOUT_MS);

    let fullOutput = "";

    proc.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;
      log.result = fullOutput;
    });

    proc.stderr.on("data", (data: Buffer) => {
      console.error(`[AutoTrigger CLI ${log.id}]`, data.toString().trim());
    });

    proc.on("close", async (code) => {
      clearTimeout(killTimer);
      try { fs.unlinkSync(promptFile); } catch (_) {}

      // Detect limit exhaustion phrases
      const limitHit =
        fullOutput.includes("out of extra usage") ||
        fullOutput.includes("Credit balance is too low") ||
        fullOutput.includes("Usage limit reached") ||
        fullOutput.includes("rate limit") ||
        fullOutput.includes("exceeded");

      if (limitHit) {
        console.warn(`[AutoTrigger CLI ${log.id}] ⚠ Limit reached — falling back to robot-2 (Claude API)`);
        log.result = "⚠ Claude CLI limit reached — switching to Claude API...\n\n";
        log.toolsUsed.push("fallback:robot-2");
        // Switch to robot-2 (Anthropic API) transparently
        const savedRobot = config.robotId;
        config.robotId = "robot-2";
        try {
          await processTaskWithAI(task, log);
        } finally {
          config.robotId = savedRobot;
        }
      } else {
        log.status = code === 0 ? "completed" : "failed";
        log.completedAt = Date.now();
        if (code !== 0) log.error = `claude CLI exited with code ${code}`;
        console.log(`[AutoTrigger CLI ${log.id}] Done (exit ${code})`);
      }
      resolve();
    });

    proc.on("error", (err: Error) => {
      clearTimeout(killTimer);
      log.status = "failed";
      log.error = `Spawn error: ${err.message} — هل claude CLI مثبت؟`;
      log.completedAt = Date.now();
      console.error(`[AutoTrigger CLI ${log.id}] Spawn error:`, err.message);
      try { fs.unlinkSync(promptFile); } catch (_) {}
      resolve();
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Robot-5: Devin (Cognition AI — fully autonomous software engineer) ──────
async function processTaskWithDevin(task: any, log: TriggerLog): Promise<void> {
  const devinModel = await getModelByName("Devin", triggerRoomId).catch(() => undefined);
  if (!devinModel?.apiKey) {
    throw new Error("Devin API key غير مضبوط — أضف موديل باسم 'Devin' في الخزنة.");
  }

  const apiKey       = devinModel.apiKey;
  const DEVIN_BASE   = "https://api.devin.ai/v1";
  const githubOwner  = await getGitHubOwner(triggerRoomId).catch(() => "");
  const githubRepo   = await getGitHubRepo(triggerRoomId).catch(() => "");
  const clickupToken = await getClickUpToken(triggerRoomId).catch(() => "");

  const githubToken  = await getGitHubToken(triggerRoomId).catch(() => "");

  const prompt = `You are an autonomous software engineer. Execute the following ClickUp task fully and autonomously.

━━━ TASK ━━━
Name: ${task.name}
Description: ${task.description || "(see task name)"}
ClickUp Task ID: ${task.id}

━━━ GITHUB REPO ━━━
Owner: ${githubOwner}
Repo:  ${githubRepo}
URL:   https://github.com/${githubOwner}/${githubRepo}

IMPORTANT — Use this token for ALL git push/commit operations (do NOT use GitHub App):
  git remote set-url origin https://x-access-token:${githubToken}@github.com/${githubOwner}/${githubRepo}
  git config user.email "devin@sillar.ai"
  git config user.name "Devin"
Then commit and push normally. Do NOT create a PR — push directly to main/master.

━━━ WHEN DONE ━━━
Mark the ClickUp task as completed:
curl -s -X PUT "https://api.clickup.com/api/v2/task/${task.id}" \\
  -H "Authorization: ${clickupToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"${config.doneStatus}"}'

Execute everything autonomously without asking for clarification.`;

  console.log(`[AutoTrigger Devin ${log.id}] Creating session for: ${task.name}`);

  // 1 — إنشاء Session
  const createRes = await fetch(`${DEVIN_BASE}/sessions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, idempotent_id: log.id }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Devin session creation failed (${createRes.status}): ${err}`);
  }

  const session = await createRes.json();
  const sessionId  = session.session_id;
  const sessionUrl = session.url || `https://app.devin.ai/sessions/${sessionId}`;

  log.result = `🤖 Devin started\n🔗 ${sessionUrl}\nStatus: ${session.status}`;
  log.toolsUsed.push(`devin-session:${sessionId}`);
  console.log(`[AutoTrigger Devin ${log.id}] Session: ${sessionId} — ${sessionUrl}`);

  // 2 — Polling حتى يكتمل (max 30 دقيقة)
  const maxWaitMs  = 30 * 60 * 1000;
  const pollMs     = 30 * 1000;
  const startTime  = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollMs));

    try {
      const pollRes = await fetch(`${DEVIN_BASE}/session/${sessionId}`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      if (!pollRes.ok) continue;

      const status = await pollRes.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log.result = `🤖 Devin — ${status.status} (${elapsed}s)\n🔗 ${sessionUrl}`;

      if (status.structured_output) {
        log.result += `\n\n📋 Output:\n${JSON.stringify(status.structured_output, null, 2)}`;
      }

      console.log(`[AutoTrigger Devin ${log.id}] status=${status.status} elapsed=${elapsed}s`);

      if (status.status === "stopped") {
        log.status       = "completed";
        log.completedAt  = Date.now();
        log.result += "\n\n✅ Devin أتم المهمة.";
        return;
      }
      if (status.status === "blocked") {
        log.result += "\n\n⚠️ Devin يحتاج تدخل بشري — blocked.";
        // نكمل الانتظار — قد يُفتح تلقائياً
      }
    } catch (_e) { /* ignore transient errors */ }
  }

  // Timeout
  log.result += "\n\n⏱️ انتهت المهلة (30 دقيقة) — راجع الجلسة يدوياً.";
  log.status      = "completed";
  log.completedAt = Date.now();
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── كشف مزوّد الذكاء الاصطناعي من اسم/موديل الموديل ────────────────────────
function detectProvider(model: ModelConfig): "openai" | "anthropic" | "gemini" {
  const text = (model.name + " " + (model.modelId || "") + " " + (model.alias || "")).toLowerCase();
  if (text.includes("claude") || text.includes("anthropic") || text.includes("sonnet") || text.includes("haiku") || text.includes("opus"))
    return "anthropic";
  if (text.includes("gemini") || text.includes("google") || text.includes("flash") || text.includes("bison"))
    return "gemini";
  return "openai"; // الافتراضي GPT
}

// ─── تنفيذ مهمة باستخدام موديل محدد من الخزنة (للوضع المتوازي) ───────────────
async function processTaskWithModel(task: any, log: TriggerLog, model: ModelConfig): Promise<void> {
  if (!model.apiKey.trim()) {
    log.status  = "failed";
    log.error   = `الموديل "${model.name}" لا يملك API Key في الخزنة`;
    log.completedAt = Date.now();
    return;
  }

  const provider = detectProvider(model);
  log.modelUsed = model.name;

  const oaiClient  = provider === "openai"  ? new OpenAI({ apiKey: model.apiKey }) : openai;
  const antClient  = provider === "anthropic" ? new Anthropic({ apiKey: model.apiKey }) : anthropic;
  const gemClient  = provider === "gemini"
    ? new OpenAI({ apiKey: model.apiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" })
    : gemini;

  const robotOverride = provider === "anthropic" ? "robot-2" : provider === "gemini" ? "robot-4" : "robot-1";
  await processTaskWithAI(task, log, { robotId: robotOverride, openaiClient: oaiClient, anthropicClient: antClient, geminiClient: gemClient });
}

interface ProcessOpts {
  robotId?:          string;
  openaiClient?:     OpenAI;
  anthropicClient?:  Anthropic;
  geminiClient?:     OpenAI;
}

async function processTaskWithAI(task: any, log: TriggerLog, opts: ProcessOpts = {}) {
  // ── فحص الإلغاء المبكر ───────────────────────────────────────────────────────
  if (isLogCancelled(log.id)) return;

  // ── تحميل سياق المشروع بشكل متوازي (أسرع بكثير من التسلسلي) ─────────────────
  const taskListId = task.list?.id || task.list_id || "";

  const [wsProject, vaultOwnerDirect, vaultRepoDirect, vpsCfg, waCfg] = await Promise.all([
    storage.getProjectByListId(triggerRoomId, taskListId).catch(() => undefined),
    getGitHubOwner(triggerRoomId).catch(() => ""),
    getGitHubRepo(triggerRoomId).catch(() => ""),
    getVpsConfig(triggerRoomId).catch(() => ({ host: "", port: 22, user: "root", password: "", webRoot: "/var/www" })),
    getWhatsAppConfig(triggerRoomId).catch(() => ({ instanceId: "", token: "", phone: "", contacts: [] as any[] })),
  ]);

  // قراءة الـ repo والـ VPS: project-level يتقدم على workspace defaults
  const vaultOwner = wsProject?.githubOwner || vaultOwnerDirect;
  const vaultRepo  = wsProject?.githubRepo  || vaultRepoDirect;
  const projectVpsPath = wsProject?.vpsPath || "";
  const waDefault = waCfg.phone || "";

  // Context section يُضاف لأعلى كل system prompt
  const projectContextSection = wsProject?.contextMd
    ? `━━━ PROJECT CONTEXT (${wsProject.name || wsProject.projectKey}) ━━━\n${wsProject.contextMd}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    : "";

  // Playbook — يُطابق بناءً على اسم المهمة + وصفها
  let playbookSection = "";
  if (wsProject) {
    const taskText = `${task.name} ${task.description || ""}`;
    const matched  = await storage.matchPlaybook(triggerRoomId, wsProject.projectKey, taskText).catch(() => undefined);
    if (matched) {
      playbookSection = `━━━ PLAYBOOK: ${matched.name} ━━━\n${matched.content}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      console.log(`[AutoTrigger] Matched playbook: "${matched.name}" for task: "${task.name}"`);
    }
  }

  // Skills — يُفعَّل بناءً على tags المهمة في ClickUp
  const taskTags     = task.tags || [];
  console.log(`[AutoTrigger] Task tags for "${task.name}": ${JSON.stringify(taskTags)}`);
  const activeSkills = extractSkillsFromTags(taskTags);
  const skillsSection = buildSkillsSection(activeSkills);
  if (activeSkills.length > 0) {
    console.log(`[AutoTrigger] Active skills: ${formatActiveSkills(activeSkills)} for task: "${task.name}"`);
    log.result += `\n[Skills] ${formatActiveSkills(activeSkills)}`;
  } else {
    console.log(`[AutoTrigger] No skills matched for task: "${task.name}"`);
  }

  const taskPrompt = `You are an autonomous AI developer at Sillar Digital Production. A ClickUp task has been assigned and you must execute it.

TASK DETAILS:
- Name: ${task.name}
- Description: ${task.description || "No description provided"}
- Status: ${task.status}
- Priority: ${task.priority || "Normal"}
- Space: ${task.space}
- Folder: ${task.folder}
- List: ${task.list}
- Task ID: ${task.id}

GITHUB TARGET (use ONLY this):
- Owner: ${vaultOwner || "not configured"}
- Repo:  ${vaultRepo  || "not configured"}

INSTRUCTIONS:
1. Read the task description carefully and understand what needs to be done.
2. If the task involves GitHub files: use get_repo_contents("${vaultOwner}", "${vaultRepo}", "") to explore, then create_or_update_file with owner="${vaultOwner}", repo="${vaultRepo}". NEVER use a different repo.
3. If the task involves ClickUp operations, use ClickUp tools.
4. ONLY after the actual work is fully done, update this task's status to "${config.doneStatus}" using update_clickup_task.
5. Provide a summary in Arabic of exactly what you did (include file paths created, URLs, etc.).

CRITICAL RULES:
- Do NOT call get_github_repos — the target repo is already specified above.
- ALWAYS use owner="${vaultOwner}", repo="${vaultRepo}" — no exceptions.
- Do NOT mark the task as done before completing the actual work.
- Never say "I will do X" without actually calling the tool to do X.
- The task ID is: ${task.id}`;

  const targetRepo = (vaultOwner && vaultRepo)
    ? `${vaultOwner}/${vaultRepo}`
    : "not configured";

  const systemPrompt = `${projectContextSection}${playbookSection}${skillsSection}You are sillar-model, an autonomous CI/CD agent. You execute ClickUp tasks automatically. Always respond in Arabic.

━━━ GITHUB TARGET (FIXED) ━━━
Owner : ${vaultOwner || "not configured"}
Repo  : ${vaultRepo  || "not configured"}

━━━ VPS SERVER ━━━
Host     : ${vpsCfg.host || "not configured"} (Linux)
Web Root : ${projectVpsPath || vpsCfg.webRoot || "/var/www"}
Tool     : run_on_vps("command") — runs bash directly on the server

━━━ DECISION GUIDE ━━━
Use run_on_vps when the task needs:
  • Local project setup   → composer create-project, npm init, php artisan
  • Install dependencies  → apt install, composer install, npm install
  • File system ops       → mkdir, cp, chmod, chown
  • Run migrations/seeds  → php artisan migrate, npm run build
  • Git on server         → git clone, git pull

Use create_or_update_file (GitHub) when the task needs:
  • Add/edit source files  → .php, .ts, .vue, README, config files
  • Document something     → markdown, JSON config
  • Code review artifacts  → any text file that belongs in the repo

Use BOTH for full CI/CD tasks:
  1. run_on_vps → create project / run commands on server
  2. create_or_update_file → push code/config to GitHub repo
  3. update_clickup_task → mark done

━━━ WHATSAPP NOTIFICATIONS ━━━
Tool: send_whatsapp(to, message) — sends WhatsApp via UltraMsg.
${waDefault ? `DEFAULT NUMBER (FIXED): ${waDefault}` : "DEFAULT NUMBER: not configured"}
${config.whatsappNotify
  ? `• AUTO-NOTIFY IS ON: After completing or failing each task, ALWAYS call:
  send_whatsapp("${waDefault}", "✅ تم إنجاز: <task name>")   — on success
  send_whatsapp("${waDefault}", "❌ فشل: <task name> — <brief reason>")   — on failure
• ALWAYS use the fixed default number above. Do NOT use any other number.`
  : `• Use ONLY when the task explicitly says "أرسل إشعار", "أبلغ الفريق", or "notify".
• When sending, ALWAYS use the fixed default number: ${waDefault || "(not set)"}.
• Do NOT look up contacts or use any other number — always send to the default only.`
}

👥 TEAM DIRECTORY: get_team_member(query) — find a team member by name or role.
• Use ONLY for ClickUp task assignment (to get clickupUserId).
• Do NOT use their phone number for WhatsApp — always send to the default number above.

EFFICIENCY RULES (CRITICAL):
- START WORKING IMMEDIATELY — do NOT call get_clickup_tasks, get_workspace_structure, or get_workspace_members unless the task explicitly requires it.
- The task details, GitHub repo, and VPS are already given above — no need to explore first.
- Chain multiple bash commands with && in ONE run_on_vps call instead of multiple calls.
- Use get_repo_contents ONLY if you need to read an existing file before modifying it.
- NEVER use get_github_repos — target repo is already given above.
- For GitHub: always owner="${vaultOwner}", repo="${vaultRepo}".
- Aim to complete each task in the fewest tool calls possible (ideally 3-5 calls total).

You must actually execute tool calls — do not describe what you will do, just do it.`;

  // استخدم الـ clients المُمررة أو الـ globals الافتراضية
  const _robotId  = opts.robotId          ?? config.robotId;
  const _openai   = opts.openaiClient     ?? openai;
  const _anthropic = opts.anthropicClient ?? anthropic;
  const _gemini   = opts.geminiClient     ?? gemini;

  // ── Task timeout: 8 دقائق كحد أقصى لكل مهمة ────────────────────────────────
  const TASK_TIMEOUT_MS = 8 * 60 * 1000;
  const MAX_ITERATIONS  = 12;  // أقل من 20 — يكفي لأي مهمة عادية
  const taskStartTime   = Date.now();

  const checkTimeout = () => Date.now() - taskStartTime > TASK_TIMEOUT_MS;

  try {
    // robot-5: Devin — autonomous software engineer (Cognition AI)
    if (_robotId === "robot-5") {
      await processTaskWithDevin(task, log);
      return;
    }

    // robot-3: Claude CLI — uses claude.ai subscription (zero API tokens)
    if (_robotId === "robot-3") {
      await processTaskWithCLI(task, log);
      return;
    }

    if (_robotId === "robot-2") {
      let messages: Anthropic.MessageParam[] = [{ role: "user", content: taskPrompt }];
      let fullResult = "";
      let iterations = 0;

      while (iterations++ < MAX_ITERATIONS) {
        // فحص الإلغاء + الـ timeout داخل كل دورة
        if (isLogCancelled(log.id)) return;
        if (checkTimeout()) {
          fullResult += "\n\n⏱️ انتهت المهلة (8 دقائق) — توقفت تلقائياً.";
          log.result = fullResult;
          break;
        }

        const response = await _anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: systemPrompt,
          tools: anthropicTools,
          messages,
        });

        let hasToolUse = false;
        const toolResults: Anthropic.MessageParam[] = [];

        for (const block of response.content) {
          if (block.type === "text") {
            fullResult += block.text;
            log.result = fullResult;
          } else if (block.type === "tool_use") {
            hasToolUse = true;
            log.toolsUsed.push(block.name);
            console.log(`[AutoTrigger ${log.id}] Tool: ${block.name}`);
            const toolResult = await executeToolCall(block.name, block.input);
            toolResults.push({
              role: "user",
              content: [{ type: "tool_result", tool_use_id: block.id, content: toolResult }],
            } as any);
          }
        }

        if (!hasToolUse || response.stop_reason === "end_turn") break;
        messages = [...messages, { role: "assistant", content: response.content }, ...toolResults];
      }

      log.result = fullResult;
    } else if (_robotId === "robot-4") {
      // Gemini — OpenAI-compatible API
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskPrompt },
      ];
      let fullResult = "";
      let iterations = 0;

      while (iterations++ < MAX_ITERATIONS) {
        if (isLogCancelled(log.id)) return;
        if (checkTimeout()) {
          fullResult += "\n\n⏱️ انتهت المهلة (8 دقائق) — توقفت تلقائياً.";
          log.result = fullResult;
          break;
        }

        const response = await _gemini.chat.completions.create({
          model: "gemini-2.0-flash",
          messages,
          tools: openaiTools,
          max_tokens: 2048,
        });

        const choice = response.choices[0];
        if (choice.message.content) {
          fullResult += choice.message.content;
          log.result = fullResult;
        }

        if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
          messages.push(choice.message);
          for (const toolCall of choice.message.tool_calls) {
            const tc = toolCall as any;
            const args = JSON.parse(tc.function.arguments);
            log.toolsUsed.push(tc.function.name);
            console.log(`[AutoTrigger ${log.id}] Gemini Tool: ${tc.function.name}`);
            const toolResult = await executeToolCall(tc.function.name, args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
          }
        } else { break; }
      }

      log.result = fullResult;
    } else {
      // robot-1: GPT-4o (default)
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskPrompt },
      ];
      let fullResult = "";
      let iterations = 0;

      while (iterations++ < MAX_ITERATIONS) {
        if (isLogCancelled(log.id)) return;
        if (checkTimeout()) {
          fullResult += "\n\n⏱️ انتهت المهلة (8 دقائق) — توقفت تلقائياً.";
          log.result = fullResult;
          break;
        }

        const response = await _openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools: openaiTools,
          max_completion_tokens: 2048,
        });

        const choice = response.choices[0];
        if (choice.message.content) {
          fullResult += choice.message.content;
          log.result = fullResult;
        }

        if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
          messages.push(choice.message);
          for (const toolCall of choice.message.tool_calls) {
            const tc = toolCall as any;
            const args = JSON.parse(tc.function.arguments);
            log.toolsUsed.push(tc.function.name);
            console.log(`[AutoTrigger ${log.id}] Tool: ${tc.function.name}`);
            const toolResult = await executeToolCall(tc.function.name, args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
          }
        } else {
          break;
        }
      }

      log.result = fullResult;
    }

    log.status = "completed";
    log.completedAt = Date.now();
    const elapsed = Math.round((Date.now() - taskStartTime) / 1000);
    console.log(`[AutoTrigger ${log.id}] Completed task: ${task.name} (${elapsed}s)`);
  } catch (err: any) {
    log.status = "failed";
    log.error = err.message;
    log.completedAt = Date.now();
    console.error(`[AutoTrigger ${log.id}] Failed:`, err.message);
  }
}

async function scanAndProcess() {
  if (isScanning || !config.enabled || !config.watchUserId) return;
  isScanning = true;

  console.log(`[AutoTrigger] Scanning ClickUp for tasks assigned to user ${config.watchUserId} (room: ${triggerRoomId})...`);

  try {
    const allTasks = await getAllTasksRaw(triggerRoomId);
    const matchingTasks = allTasks.filter(t => {
      const isAssigned = t.assignees.some((a: any) => a.id === config.watchUserId);
      const statusMatch = config.watchStatuses.some(s => t.status?.toLowerCase() === s.toLowerCase());
      const notProcessed = !processedTaskIds.has(t.id);
      return isAssigned && statusMatch && notProcessed;
    });

    console.log(`[AutoTrigger] Found ${matchingTasks.length} new tasks to process`);

    // ─── مساعد: تنفيذ مهمة واحدة وإرفاق النتيجة ─────────────────────────────
    const runOne = async (task: any, log: TriggerLog, vaultModel?: ModelConfig, overrideRobotId?: string) => {
      triggerLogs.unshift(log);
      if (triggerLogs.length > 50) triggerLogs.splice(50);

      const label = vaultModel ? `✦${vaultModel.name}` : overrideRobotId ?? config.robotId;
      console.log(`[AutoTrigger ${label}] Processing: ${task.name} (${task.id})`);

      try {
        await updateTask(task.id, { status: "in progress" }, triggerRoomId);
      } catch (e: any) {
        console.warn(`[AutoTrigger] Could not set in-progress:`, e.message);
      }

      if (vaultModel) {
        await processTaskWithModel(task, log, vaultModel);
      } else {
        await refreshClients();
        // ← دائماً نمرر robotId عبر opts — لا نعتمد على config.robotId المشترك
        const rId = overrideRobotId ?? config.robotId;
        log.modelUsed = rId;
        await processTaskWithAI(task, log, { robotId: rId });
      }

      // إرفاق ملف النتيجة بمهمة ClickUp
      if (log.result || log.error) {
        try {
          const timestamp = new Date(log.startedAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const filename  = `result-${timestamp}.txt`;
          const content   = [
            `المهمة: ${task.name}`,
            `الحالة: ${log.status}`,
            vaultModel ? `الموديل: ${vaultModel.name}` : `الروبوت: ${config.robotId}`,
            `الوقت: ${new Date(log.startedAt).toLocaleString("ar-SA")}`,
            `الأدوات: ${log.toolsUsed.join(", ") || "—"}`,
            "",
            log.result || "",
            log.error ? `\nخطأ: ${log.error}` : "",
          ].join("\n");
          await attachFileToTask(task.id, filename, content, triggerRoomId);
        } catch (e: any) {
          console.warn(`[AutoTrigger] Could not attach file:`, e.message);
        }
      }
    };

    // ─── وضع التوازي: كل مهمة على موديل مختلف من الخزنة ─────────────────────
    if (config.parallelMode) {
      const vaultModels = (await getModels(triggerRoomId)).filter(m => m.apiKey.trim());
      if (vaultModels.length === 0) {
        console.warn("[AutoTrigger] Parallel mode: no vault models with API keys — falling back to sequential");
      } else {
        // أقصى عدد مهام = عدد الموديلات المتاحة
        const tasksToRun = matchingTasks.slice(0, vaultModels.length);
        tasksToRun.forEach(t => processedTaskIds.add(t.id));

        console.log(`[AutoTrigger] Parallel: ${tasksToRun.length} tasks × ${vaultModels.length} models`);

        await Promise.all(tasksToRun.map((task, i) => {
          const model = vaultModels[i % vaultModels.length];
          const log: TriggerLog = {
            id: generateId(), taskId: task.id, taskName: task.name,
            status: "running", result: "", toolsUsed: [],
            startedAt: Date.now(), completedAt: null, error: null,
            modelUsed: model.name,
          };
          return runOne(task, log, model);
        }));

        // إذا كان في مهام زيادة عن الموديلات — تُعالَج في الدورة القادمة
        if (matchingTasks.length > vaultModels.length) {
          console.log(`[AutoTrigger] ${matchingTasks.length - vaultModels.length} tasks deferred to next scan`);
        }
        isScanning = false;
        return;
      }
    }

    // ─── وضع التسلسل — كل مهمة تُشغَّل على جميع الـ robotIds بالتوازي ──────────
    for (const task of matchingTasks) {
      processedTaskIds.add(task.id);
      const activeRobots = config.robotIds.length > 0 ? config.robotIds : [config.robotId];

      if (activeRobots.length === 1) {
        // مودل واحد — نمرر robotId صراحةً عبر overrideRobotId
        const rId = activeRobots[0];
        const log: TriggerLog = {
          id: generateId(), taskId: task.id, taskName: task.name,
          status: "running", result: "", toolsUsed: [],
          startedAt: Date.now(), completedAt: null, error: null,
          modelUsed: rId,
        };
        await runOne(task, log, undefined, rId);
      } else {
        // متعدد — شغّل كل المودلات بالتوازي على نفس المهمة
        console.log(`[AutoTrigger] 🔀 Multi-model: task "${task.name}" → [${activeRobots.join(", ")}]`);
        try { await updateTask(task.id, { status: "in progress" }, triggerRoomId); } catch {}

        await Promise.all(activeRobots.map(async (rId) => {
          const log: TriggerLog = {
            id: generateId(), taskId: task.id, taskName: task.name,
            status: "running", result: "", toolsUsed: [],
            startedAt: Date.now(), completedAt: null, error: null,
            modelUsed: rId,
          };
          triggerLogs.unshift(log);
          if (triggerLogs.length > 50) triggerLogs.splice(50);

          // نمرر robotId مباشرة عبر opts — لا نمس config.robotId المشترك
          await refreshClients();
          await processTaskWithAI(task, log, { robotId: rId });

          // ارفق النتيجة
          if (log.result || log.error) {
            try {
              const ts = new Date(log.startedAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const robotLabel = rId === "robot-1" ? "GPT" : rId === "robot-2" ? "Claude" : rId === "robot-3" ? "ClaudeCLI" : "Gemini";
              const content = [
                `المهمة: ${task.name}`, `الروبوت: ${robotLabel}`,
                `الحالة: ${log.status}`, `الوقت: ${new Date(log.startedAt).toLocaleString("ar-SA")}`,
                `الأدوات: ${log.toolsUsed.join(", ") || "—"}`, "",
                log.result || "", log.error ? `\nخطأ: ${log.error}` : "",
              ].join("\n");
              await attachFileToTask(task.id, `result-${robotLabel}-${ts}.txt`, content, triggerRoomId);
            } catch {}
          }
        }));

        // أغلق المهمة بعد انتهاء الكل
        try { await updateTask(task.id, { status: config.doneStatus }, triggerRoomId); } catch {}
      }
    }
  } catch (err: any) {
    console.error("[AutoTrigger] Scan error:", err.message);
  }

  isScanning = false;
}

export function startAutoTrigger(
  userId: number,
  intervalMinutes?: number,
  robotId?: string,
  watchStatuses?: string[],
  doneStatus?: string,
  roomId?: string,
  parallelMode?: boolean,
  robotIds?: string[],
  whatsappNotify?: boolean,
) {
  config.watchUserId   = userId;
  if (intervalMinutes !== undefined) config.intervalMinutes = intervalMinutes;
  if (robotIds && robotIds.length > 0) {
    config.robotIds = robotIds;
    config.robotId  = robotIds[0]; // للتوافق مع القديم
  } else if (robotId) {
    config.robotId  = robotId;
    config.robotIds = [robotId];
  }
  if (watchStatuses)    config.watchStatuses  = watchStatuses;
  if (doneStatus)       config.doneStatus     = doneStatus;
  if (roomId)           triggerRoomId         = roomId;
  if (parallelMode    !== undefined) config.parallelMode    = parallelMode;
  if (whatsappNotify  !== undefined) config.whatsappNotify  = whatsappNotify;
  config.enabled = true;

  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  console.log(`[AutoTrigger] Started! Watching user ${userId}, interval: ${config.intervalMinutes}min, statuses: [${config.watchStatuses.join(", ")}]`);

  scanAndProcess();

  intervalHandle = setInterval(() => {
    scanAndProcess();
  }, config.intervalMinutes * 60 * 1000);
}

export function stopAutoTrigger() {
  config.enabled = false;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log("[AutoTrigger] Stopped");
}

export function getAutoTriggerConfig(): AutoTriggerConfig {
  return { ...config };
}

export function getTriggerLogs(): TriggerLog[] {
  return [...triggerLogs];
}

export function clearProcessedTasks() {
  processedTaskIds.clear();
  console.log("[AutoTrigger] Cleared processed tasks cache");
}

export function triggerScanNow(roomId?: string) {
  if (!config.enabled || !config.watchUserId) {
    return { error: "Auto-trigger is not enabled or no user configured" };
  }
  // Update triggerRoomId if provided (important after server restart)
  if (roomId) triggerRoomId = roomId;
  scanAndProcess();
  return { success: true, message: "Scan triggered" };
}

// إرجاع موديلات الخزنة التي لديها API Key (للـ UI)
export async function getAvailableVaultModels(roomId?: string): Promise<{ id: string; name: string; provider: string }[]> {
  const models = await getModels(roomId || triggerRoomId);
  return models
    .filter(m => m.apiKey.trim())
    .map(m => ({ id: m.id, name: m.name, provider: detectProvider(m) }));
}

export async function testVpsConnection(roomId?: string): Promise<{ connected: boolean; output?: string; error?: string }> {
  try {
    const vpsCfg = await getVpsConfig(roomId);
    if (!vpsCfg.host) return { connected: false, error: "VPS host not configured" };
    const result = await runOnVps("echo OK && hostname", 10000, vpsCfg);
    if (result.startsWith("SSH connection error:")) return { connected: false, error: result };
    if (result.startsWith("[timeout")) return { connected: false, error: result };
    return { connected: true, output: result.trim() };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}
