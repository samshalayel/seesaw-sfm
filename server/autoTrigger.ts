import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getAllTasksRaw, getTask, updateTask, getWorkspaceMembers } from "./clickup";
import { getRepos, getRepoContents, createOrUpdateFile, getAuthenticatedUser } from "./github";
import { getClickUpSummary, searchTasksByName, getFullWorkspaceStructure, createTask } from "./clickup";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
      default: return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

function generateId(): string {
  return "trig_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

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

INSTRUCTIONS:
1. Read the task description carefully and understand what needs to be done.
2. If the task involves code/files, use GitHub tools to create or update the required files.
3. If the task involves ClickUp operations, use ClickUp tools.
4. After completing ALL the work, update this task's status to "${config.doneStatus}" using update_clickup_task.
5. Provide a summary of everything you did in Arabic.
6. If the task description is unclear or empty, still update the status and note that the task had no clear instructions.

IMPORTANT: You MUST update the task status to "${config.doneStatus}" when done. The task ID is: ${task.id}`;

  let githubUser = "";
  let githubRepos: any[] = [];
  try { githubUser = await getAuthenticatedUser(triggerRoomId); } catch (_e) {}
  try { githubRepos = await getRepos(triggerRoomId); } catch (_e) {}

  const repoLine = githubRepos.length > 0
    ? `GitHub repos available: ${githubRepos.map((r: any) => `${r.owner?.login || githubUser}/${r.name}`).join(", ")}`
    : (githubUser ? `GitHub user: ${githubUser} (use get_github_repos to list repos)` : "GitHub: not connected");

  const systemPrompt = `You are sillar-model, an autonomous AI agent. You execute ClickUp tasks automatically. Use all available tools to complete tasks. Always respond in Arabic.
${repoLine}

Available tools: get_clickup_tasks, get_workspace_structure, get_workspace_members, search_clickup_tasks, get_task_details, update_clickup_task, create_clickup_task, get_github_repos, get_repo_contents, create_or_update_file`;

  try {
    if (config.robotId === "robot-2") {
      let messages: Anthropic.MessageParam[] = [{ role: "user", content: taskPrompt }];
      let fullResult = "";
      let maxIterations = 10;

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
    } else {
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskPrompt },
      ];
      let fullResult = "";
      let maxIterations = 10;

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
      await processTaskWithAI(task, log);
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
