import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getClickUpSummary, getTeams, getSpaces, getFolders, getLists, getFolderlessLists, getTasks, getTask, getWorkspaceMembers, updateTask, createTask, searchTasksByName, getFullWorkspaceStructure } from "./clickup";
import { getGitHubSummary, getRepos, getRepoContents, createOrUpdateFile, getAuthenticatedUser } from "./github";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface BackgroundJob {
  id: string;
  message: string;
  robotId: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string;
  toolsUsed: string[];
  createdAt: number;
  completedAt: number | null;
  error: string | null;
}

const jobs: Map<string, BackgroundJob> = new Map();

const toolDefinitions = [
  { name: "get_clickup_tasks", description: "Get all tasks from ClickUp", parameters: { type: "object", properties: {}, required: [] } },
  { name: "get_workspace_structure", description: "Get workspace structure (spaces/folders/lists with IDs)", parameters: { type: "object", properties: {}, required: [] } },
  { name: "get_workspace_members", description: "Get workspace members with IDs and emails", parameters: { type: "object", properties: {}, required: [] } },
  { name: "search_clickup_tasks", description: "Search tasks by name", parameters: { type: "object", properties: { query: { type: "string", description: "Search query" } }, required: ["query"] } },
  { name: "get_task_details", description: "Get task details by ID", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } },
  { name: "update_clickup_task", description: "Update a task (name, status, priority, assignees)", parameters: { type: "object", properties: { task_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, status: { type: "string" }, priority: { type: "integer" }, assignees_add: { type: "array", items: { type: "integer" } }, assignees_rem: { type: "array", items: { type: "integer" } } }, required: ["task_id"] } },
  { name: "create_clickup_task", description: "Create a new task in a list", parameters: { type: "object", properties: { list_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, status: { type: "string" }, priority: { type: "integer" }, assignees: { type: "array", items: { type: "integer" } } }, required: ["list_id", "name"] } },
  { name: "get_github_repos", description: "List GitHub repositories", parameters: { type: "object", properties: {}, required: [] } },
  { name: "get_repo_contents", description: "Get repo contents at a path", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" } }, required: ["owner", "repo"] } },
  { name: "create_or_update_file", description: "Create/update a file in GitHub", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" }, content: { type: "string" }, commit_message: { type: "string" } }, required: ["owner", "repo", "path", "content", "commit_message"] } },
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
      case "get_clickup_tasks": return await getClickUpSummary();
      case "get_workspace_structure": return await getFullWorkspaceStructure();
      case "get_workspace_members": return JSON.stringify(await getWorkspaceMembers(), null, 2);
      case "search_clickup_tasks": return JSON.stringify(await searchTasksByName(args.query), null, 2);
      case "get_task_details": return JSON.stringify(await getTask(args.task_id), null, 2);
      case "update_clickup_task":
        return JSON.stringify(await updateTask(args.task_id, {
          name: args.name, description: args.description, status: args.status,
          priority: args.priority, assignees_add: args.assignees_add, assignees_rem: args.assignees_rem,
        }), null, 2);
      case "create_clickup_task":
        return JSON.stringify(await createTask(args.list_id, {
          name: args.name, description: args.description, status: args.status,
          priority: args.priority, assignees: args.assignees,
        }), null, 2);
      case "get_github_repos": return JSON.stringify(await getRepos(), null, 2);
      case "get_repo_contents": return JSON.stringify(await getRepoContents(args.owner, args.repo, args.path || ""), null, 2);
      case "create_or_update_file":
        return JSON.stringify(await createOrUpdateFile(args.owner, args.repo, args.path, args.content, args.commit_message), null, 2);
      default: return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

const BASE_SYSTEM_PROMPT = `Your name is sillar-model. You are a senior software developer at Sillar Digital Production.
You have access to the team's ClickUp workspace and GitHub repositories through tools.
This is a BACKGROUND JOB - the user has submitted this request and may not be online. Execute the task fully and provide a complete summary of what you did.

IMPORTANT:
1. Always answer in the same language the user uses (Arabic or English).
2. Execute ALL steps needed to complete the task. Don't ask questions - do your best with available info.
3. After completing, provide a clear summary of what was done.

CLICKUP: get_clickup_tasks, get_workspace_structure, get_workspace_members, search_clickup_tasks, get_task_details, update_clickup_task, create_clickup_task
GITHUB: get_github_repos, get_repo_contents, create_or_update_file

WORKFLOWS:
- Update task: search → get members if needed → update
- Create task: get workspace structure → create in correct list
- GitHub file: get repos → create/update file`;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

export function submitJob(message: string, robotId: string): BackgroundJob {
  const job: BackgroundJob = {
    id: generateId(),
    message,
    robotId,
    status: "pending",
    result: "",
    toolsUsed: [],
    createdAt: Date.now(),
    completedAt: null,
    error: null,
  };
  jobs.set(job.id, job);
  processJob(job.id);
  return job;
}

export function getJobs(): BackgroundJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getJob(id: string): BackgroundJob | undefined {
  return jobs.get(id);
}

export function clearCompletedJobs(): void {
  const keysToDelete: string[] = [];
  jobs.forEach((job, id) => {
    if (job.status === "completed" || job.status === "failed") {
      keysToDelete.push(id);
    }
  });
  keysToDelete.forEach(id => jobs.delete(id));
}

async function processJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "running";
  console.log(`[BackgroundJob ${job.id}] Starting: "${job.message}" via ${job.robotId}`);

  try {
    let githubUser = "";
    try { githubUser = await getAuthenticatedUser(); } catch (_e) {}

    const systemPrompt = githubUser
      ? `${BASE_SYSTEM_PROMPT}\nThe authenticated GitHub username is: ${githubUser}`
      : BASE_SYSTEM_PROMPT;

    if (job.robotId === "robot-2") {
      let messages: Anthropic.MessageParam[] = [{ role: "user", content: job.message }];
      let fullResult = "";
      let maxIterations = 8;

      while (maxIterations-- > 0) {
        console.log(`[BackgroundJob ${job.id}] Claude iteration ${9 - maxIterations}`);
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
            job.toolsUsed.push(block.name);
            console.log(`[BackgroundJob ${job.id}] Tool: ${block.name}`);
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

      job.result = fullResult;
    } else {
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: job.message },
      ];
      let fullResult = "";
      let maxIterations = 8;

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
            job.toolsUsed.push(tc.function.name);
            console.log(`[BackgroundJob ${job.id}] Tool: ${tc.function.name}`);
            const toolResult = await executeToolCall(tc.function.name, args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
          }
        } else {
          break;
        }
      }

      job.result = fullResult;
    }

    job.status = "completed";
    job.completedAt = Date.now();
    console.log(`[BackgroundJob ${job.id}] Completed successfully`);
  } catch (err: any) {
    job.status = "failed";
    job.error = err.message;
    job.completedAt = Date.now();
    console.error(`[BackgroundJob ${job.id}] Failed:`, err.message);
  }
}
