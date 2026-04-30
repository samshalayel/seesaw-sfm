import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getAllTasksRaw, getTask, updateTask, getWorkspaceMembers, attachFileToTask } from "./clickup";
import { getRepos, getRepoContents, createOrUpdateFile, getAuthenticatedUser } from "./github";
import { getClickUpSummary, searchTasksByName, getFullWorkspaceStructure, createTask } from "./clickup";
import { getGitHubToken, getClickUpToken, getGitHubOwner, getGitHubRepo, getModelByName, getVpsConfig } from "./vaultStore";
import { Client as SshClient } from "ssh2";

// clients مؤقتة — يتم إعادة إنشاؤها من الخزنة عند كل مهمة
let openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "placeholder" });
let gemini    = new OpenAI({ apiKey: "placeholder", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
let anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });

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
  doneStatus: string;
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
}

const config: AutoTriggerConfig = {
  enabled: false,
  watchUserId: null,
  watchStatuses: ["to do", "pending", "open"],
  intervalMinutes: 5,
  robotId: "robot-1",
  doneStatus: "complete",
};

// roomId مرتبط بالغرفة التي شغّلت المراقب
let triggerRoomId: string | undefined = undefined;

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
    description: "Run a bash command on the production VPS server (Linux). Use for: composer, npm, php artisan, git, mkdir, apt, etc. Returns stdout+stderr. Working directory is /var/www unless you cd first.",
    parameters: { type: "object" as const, properties: {
      command:    { type: "string", description: "Bash command to run on the VPS" },
      timeout_seconds: { type: "integer", description: "Max wait time in seconds (default 60, max 300)" },
    }, required: ["command"] },
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
        console.log(`[AutoTrigger] VPS command: ${args.command.slice(0, 100)}`);
        const vpsCfg = await getVpsConfig(triggerRoomId);
        if (!vpsCfg.host) return "Error: VPS not configured. Add VPS settings in the vault.";
        const result = await runOnVps(args.command, timeoutMs, vpsCfg);
        return result;
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

  // Find claude CLI: prefer local node_modules binary, fallback to global
  const localExe = new URL("../../node_modules/@anthropic-ai/claude-code/bin/claude.exe", import.meta.url).pathname.replace(/^\//, "");
  const claudePath = (() => {
    if (fs.existsSync(localExe)) return localExe;
    // try global npm bin
    const globals = [
      (process.env.APPDATA ?? "") + "\\npm\\claude.cmd",
      (process.env.APPDATA ?? "") + "\\npm\\claude",
      "/usr/local/bin/claude",
      "/usr/bin/claude",
    ];
    for (const c of globals) { try { fs.accessSync(c); return c; } catch (_) {} }
    return "claude";
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

async function processTaskWithAI(task: any, log: TriggerLog) {
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

  // قراءة الـ repo المحدد من الخزنة — هذا هو المرجع الوحيد
  const vaultOwner = await getGitHubOwner(triggerRoomId).catch(() => "");
  const vaultRepo  = await getGitHubRepo(triggerRoomId).catch(() => "");
  let githubUser = "";
  try { githubUser = await getAuthenticatedUser(triggerRoomId); } catch (_e) {}

  const targetRepo = (vaultOwner && vaultRepo)
    ? `${vaultOwner}/${vaultRepo}`
    : "not configured";

  const systemPrompt = `You are sillar-model, an autonomous CI/CD agent. You execute ClickUp tasks automatically. Always respond in Arabic.

━━━ GITHUB TARGET (FIXED) ━━━
Owner : ${vaultOwner || "not configured"}
Repo  : ${vaultRepo  || "not configured"}

━━━ VPS SERVER ━━━
Host  : ${VPS_CONFIG.host} (Linux, /var/www is the web root)
Tool  : run_on_vps("command") — runs bash directly on the server

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

RULES:
- NEVER use get_github_repos — target repo is already given above.
- For GitHub: always owner="${vaultOwner}", repo="${vaultRepo}".
- For VPS: project root is typically /var/www/<project-name>.
- Chain commands with && to keep them in one run_on_vps call.

You must actually execute tool calls — do not describe what you will do, just do it.`;

  try {
    // robot-3: Claude CLI — uses claude.ai subscription (zero API tokens)
    if (config.robotId === "robot-3") {
      await processTaskWithCLI(task, log);
      return;
    }

    if (config.robotId === "robot-2") {
      let messages: Anthropic.MessageParam[] = [{ role: "user", content: taskPrompt }];
      let fullResult = "";
      let maxIterations = 20;

      while (maxIterations-- > 0) {
        const response = await anthropic.messages.create({
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
    } else if (config.robotId === "robot-4") {
      // Gemini — OpenAI-compatible API
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskPrompt },
      ];
      let fullResult = "";
      let maxIterations = 20;

      while (maxIterations-- > 0) {
        const response = await gemini.chat.completions.create({
          model: "gemini-2.0-flash",
          messages,
          tools: openaiTools,
          max_tokens: 2048,
        });

        const choice = response.choices[0];
        if (choice.message.content) fullResult += choice.message.content;

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
      // robot-1: GPT-4o
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskPrompt },
      ];
      let fullResult = "";
      let maxIterations = 20;

      while (maxIterations-- > 0) {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools: openaiTools,
          max_completion_tokens: 2048,
        });

        const choice = response.choices[0];
        if (choice.message.content) {
          fullResult += choice.message.content;
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
    console.log(`[AutoTrigger ${log.id}] Completed task: ${task.name}`);
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

    for (const task of matchingTasks) {
      processedTaskIds.add(task.id);

      const log: TriggerLog = {
        id: generateId(),
        taskId: task.id,
        taskName: task.name,
        status: "running",
        result: "",
        toolsUsed: [],
        startedAt: Date.now(),
        completedAt: null,
        error: null,
      };
      triggerLogs.unshift(log);

      if (triggerLogs.length > 50) {
        triggerLogs.splice(50);
      }

      console.log(`[AutoTrigger] Processing task: ${task.name} (${task.id})`);

      // تحديث مفاتيح API من الخزنة قبل كل مهمة
      await refreshClients();

      // ① Mark as "in progress" so team can track
      try {
        await updateTask(task.id, { status: "in progress" }, triggerRoomId);
        console.log(`[AutoTrigger] Task ${task.id} marked as in progress`);
      } catch (e: any) {
        console.warn(`[AutoTrigger] Could not set in-progress:`, e.message);
      }

      await processTaskWithAI(task, log);

      // ② Attach result file after completion
      if (log.result || log.error) {
        try {
          const timestamp = new Date(log.startedAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const filename = `result-${timestamp}.txt`;
          const content = [
            `المهمة: ${task.name}`,
            `الحالة: ${log.status}`,
            `الوقت: ${new Date(log.startedAt).toLocaleString("ar-SA")}`,
            `الأدوات: ${log.toolsUsed.join(", ") || "—"}`,
            "",
            log.result || "",
            log.error ? `\nخطأ: ${log.error}` : "",
          ].join("\n");

          await attachFileToTask(task.id, filename, content, triggerRoomId);
          console.log(`[AutoTrigger] Attached result file to task ${task.id}`);
        } catch (e: any) {
          console.warn(`[AutoTrigger] Could not attach file:`, e.message);
        }
      }
    }
  } catch (err: any) {
    console.error("[AutoTrigger] Scan error:", err.message);
  }

  isScanning = false;
}

export function startAutoTrigger(userId: number, intervalMinutes?: number, robotId?: string, watchStatuses?: string[], doneStatus?: string, roomId?: string) {
  config.watchUserId = userId;
  if (intervalMinutes) config.intervalMinutes = intervalMinutes;
  if (robotId) config.robotId = robotId;
  if (watchStatuses) config.watchStatuses = watchStatuses;
  if (doneStatus) config.doneStatus = doneStatus;
  if (roomId) triggerRoomId = roomId;
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

export function triggerScanNow() {
  if (!config.enabled || !config.watchUserId) {
    return { error: "Auto-trigger is not enabled or no user configured" };
  }
  scanAndProcess();
  return { success: true, message: "Scan triggered" };
}
