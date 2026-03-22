import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getClickUpSummary, getTeams, getSpaces, getFolders, getLists, getFolderlessLists, getTasks, getTask, getWorkspaceMembers, updateTask, createTask, searchTasksByName, getFullWorkspaceStructure } from "./clickup";
import { getGitHubSummary, getRepos, getRepoContents, createOrUpdateFile, getAuthenticatedUser, getCommitChecks, getWorkflowRuns, getWorkflowRunLogs } from "./github";
import { readFileSync } from "fs";
import { join } from "path";

let SFM_TEMPLATES = "";
try {
  SFM_TEMPLATES = readFileSync(join(process.cwd(), "server/sfm_templates.json"), "utf-8");
} catch {
  try {
    SFM_TEMPLATES = readFileSync(join(__dirname, "../server/sfm_templates.json"), "utf-8");
  } catch {
    SFM_TEMPLATES = readFileSync(join(__dirname, "sfm_templates.json"), "utf-8");
  }
}
import { submitJob, getJobs, getJob, clearCompletedJobs } from "./backgroundJobs";
import { getVaultSettings, setVaultSettings, getModels, getHallWorkers, getDefaultModel, setDefaultModel, getSystemPrompt, getManagerDoorCode, DEFAULT_GROQ_KEY } from "./vaultStore";
import { startAutoTrigger, stopAutoTrigger, getAutoTriggerConfig, getTriggerLogs, clearProcessedTasks, triggerScanNow } from "./autoTrigger";
import { buildExtractPrompt, buildFillPrompt, S0_FACTS_SCHEMA, S1_FACTS_SCHEMA, S2_FACTS_SCHEMA } from "./sfmFactExtractor";
import { validateStage, type ValidationResult, type ValidationFailure } from "./sfmQualityValidator";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getProviderConfig(modelName: string): { baseURL?: string; defaultModel: string; provider: string } {
  const name = modelName.toLowerCase();
  if (name.includes("groq") || name.includes("جروك")) {
    return { baseURL: "https://api.groq.com/openai/v1", defaultModel: "llama-3.1-8b-instant", provider: "Groq" };
  }
  if (name.includes("glm") || name.includes("جي ال إم")) {
    return { baseURL: "https://open.bigmodel.cn/api/paas/v4/", defaultModel: "glm-4-flash", provider: "ZhipuAI" };
  }
  if (name.includes("grok") || name.includes("جروك")) {
    return { baseURL: "https://api.x.ai/v1", defaultModel: "grok-3", provider: "xAI" };
  }
  if (name.includes("gemini") || name.includes("جيميناي")) {
    return { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", defaultModel: "gemini-2.0-flash", provider: "Google" };
  }
  if (name.includes("mistral") || name.includes("ميسترال")) {
    return { baseURL: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest", provider: "Mistral" };
  }
  if (name.includes("openrouter")) {
    return { baseURL: "https://openrouter.ai/api/v1", defaultModel: "meta-llama/llama-3.3-70b-instruct:free", provider: "OpenRouter" };
  }
  if (name.includes("opencode")) {
    return { baseURL: "https://open.bigmodel.cn/api/paas/v4/", defaultModel: "glm-4.7-flash", provider: "ZhipuAI" };
  }
  if (name.includes("devin")) {
    return { baseURL: "https://api.cognition.ai/v1", defaultModel: "devin", provider: "Devin" };
  }
  if (name.includes("v0") || name.includes("vercel")) {
    return { baseURL: "https://api.v0.dev/v1", defaultModel: "v0-1.0-md", provider: "v0" };
  }
  return { defaultModel: "gpt-4o-mini", provider: "OpenAI" };
}

function createModelClient(modelConfig: { name: string; apiKey: string; modelId?: string } | undefined): { client: OpenAI; modelId: string; provider: string } {
  if (!modelConfig || !modelConfig.apiKey) {
    return { client: openai, modelId: "gpt-4o", provider: "OpenAI" };
  }
  const config = getProviderConfig(modelConfig.name);

  let apiKey = modelConfig.apiKey.trim();
  // Remove "v0:" prefix if present
  if (apiKey.startsWith("v0:")) {
    apiKey = apiKey.substring(3);
  }
  if (config.provider === "Groq" && !apiKey) {
    apiKey = process.env.GROQ_API_KEY || "";
  }

  // OpenRouter: إضافة headers مطلوبة
  const extraHeaders: Record<string, string> = {};
  if (config.provider === "OpenRouter") {
    extraHeaders["HTTP-Referer"] = "https://sillar.us";
    extraHeaders["X-Title"] = "Sillar Office";
  }

  const client = new OpenAI({
    apiKey: apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    ...(Object.keys(extraHeaders).length ? { defaultHeaders: extraHeaders } : {}),
  });

  // إذا المستخدم حدد sub-model مخصص (مثل anthropic/claude-opus-4)، استخدمه
  const finalModelId = modelConfig.modelId?.trim() || config.defaultModel;
  return { client, modelId: finalModelId, provider: config.provider };
}

const toolDefinitions = [
  {
    name: "get_clickup_tasks",
    description: "Get all tasks and project data from ClickUp workspace including space names, folder names, list names, task statuses, assignees, and due dates",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_workspace_structure",
    description: "Get the full workspace structure showing all spaces, folders, and lists with their IDs. Use this to find the correct list ID before creating tasks.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_workspace_members",
    description: "Get all workspace members with their IDs, usernames, and emails. Use this to find user IDs when assigning tasks.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_clickup_tasks",
    description: "Search for tasks by name across all spaces, folders, and lists. Returns matching tasks with their IDs, status, assignees, folder, and list info.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query to match against task names" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_task_details",
    description: "Get detailed information about a specific task by its ID, including description, status, assignees, folder, space, and list",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The ClickUp task ID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_clickup_task",
    description: "Update an existing ClickUp task. Can change name, description, status, priority, due date, and assignees. For assignees, provide user IDs (get them from get_workspace_members).",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The ClickUp task ID to update" },
        name: { type: "string", description: "New task name (optional)" },
        description: { type: "string", description: "New task description (optional)" },
        status: { type: "string", description: "New status (e.g. 'open', 'in progress', 'closed', 'to do')" },
        priority: { type: "integer", description: "Priority: 1=urgent, 2=high, 3=normal, 4=low" },
        assignees_add: { type: "array", items: { type: "integer" }, description: "Array of user IDs to add as assignees" },
        assignees_rem: { type: "array", items: { type: "integer" }, description: "Array of user IDs to remove from assignees" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "create_clickup_task",
    description: "Create a new task in a specific ClickUp list. Use get_workspace_structure first to find the correct list ID.",
    parameters: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "The ClickUp list ID where the task will be created" },
        name: { type: "string", description: "Task name" },
        description: { type: "string", description: "Task description (optional)" },
        status: { type: "string", description: "Task status (optional)" },
        priority: { type: "integer", description: "Priority: 1=urgent, 2=high, 3=normal, 4=low" },
        assignees: { type: "array", items: { type: "integer" }, description: "Array of user IDs to assign" },
      },
      required: ["list_id", "name"],
    },
  },
  {
    name: "get_github_repos",
    description: "List all GitHub repositories for the authenticated user",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_repo_contents",
    description: "Get the contents (files/folders) of a GitHub repository at a specific path",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner username" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "Path within the repo (empty string for root)" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "create_or_update_file",
    description: "Create a new file or update an existing file in a GitHub repository",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner username" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path in the repo (e.g. test.md, src/index.js)" },
        content: { type: "string", description: "The content to write to the file" },
        commit_message: { type: "string", description: "The commit message" },
      },
      required: ["owner", "repo", "path", "content", "commit_message"],
    },
  },
  {
    name: "get_commit_checks",
    description: "Get CI/CD check runs (GitHub Actions results) for a specific commit. Shows pass/fail status and error details.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner username" },
        repo: { type: "string", description: "Repository name" },
        ref: { type: "string", description: "Commit SHA, branch name, or tag" },
      },
      required: ["owner", "repo", "ref"],
    },
  },
  {
    name: "get_workflow_runs",
    description: "Get recent GitHub Actions workflow runs for a repository. Shows status, conclusion, and links.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner username" },
        repo: { type: "string", description: "Repository name" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_workflow_run_logs",
    description: "Get detailed job logs for a specific GitHub Actions workflow run. Shows each job and step with pass/fail status.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner username" },
        repo: { type: "string", description: "Repository name" },
        run_id: { type: "integer", description: "The workflow run ID (get from get_workflow_runs)" },
      },
      required: ["owner", "repo", "run_id"],
    },
  },
];

const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = toolDefinitions.map(t => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters as any,
  },
}));

const anthropicTools: Anthropic.Tool[] = toolDefinitions.map(t => ({
  name: t.name,
  description: t.description,
  input_schema: { ...t.parameters, type: "object" as const },
}));

async function fixOwnerRepo(args: any, robotId: string): Promise<{ owner: string; repo: string }> {
  const session = robotSessions[robotId];
  if (session?.repoBound && session.repoOwner && session.repoName) {
    if (args.owner !== session.repoOwner || args.repo !== session.repoName) {
      console.log(`[FIX] Correcting owner/repo from "${args.owner}/${args.repo}" to "${session.repoOwner}/${session.repoName}"`);
    }
    return { owner: session.repoOwner, repo: session.repoName };
  }
  const vault = await getVaultSettings();
  const owner = args.owner || vault.github.owner || "";
  const repo = args.repo || vault.github.repo || "";
  return { owner, repo };
}

async function executeToolCall(name: string, args: any, robotId: string = "robot-1", roomId?: string): Promise<string> {
  try {
    switch (name) {
      case "get_clickup_tasks":
        return await getClickUpSummary(roomId);
      case "get_workspace_structure":
        return await getFullWorkspaceStructure(roomId);
      case "get_workspace_members":
        return JSON.stringify(await getWorkspaceMembers(roomId), null, 2);
      case "search_clickup_tasks":
        return JSON.stringify(await searchTasksByName(args.query, roomId), null, 2);
      case "get_task_details":
        return JSON.stringify(await getTask(args.task_id, roomId), null, 2);
      case "update_clickup_task": {
        const result = await updateTask(args.task_id, {
          name: args.name,
          description: args.description,
          status: args.status,
          priority: args.priority,
          assignees_add: args.assignees_add,
          assignees_rem: args.assignees_rem,
        }, roomId);
        return JSON.stringify(result, null, 2);
      }
      case "create_clickup_task": {
        const result = await createTask(args.list_id, {
          name: args.name,
          description: args.description,
          status: args.status,
          priority: args.priority,
          assignees: args.assignees,
        }, roomId);
        return JSON.stringify(result, null, 2);
      }
      case "get_github_repos":
        return JSON.stringify(await getRepos(), null, 2);
      case "get_repo_contents": {
        const { owner, repo } = await fixOwnerRepo(args, robotId);
        return JSON.stringify(await getRepoContents(owner, repo, args.path || ""), null, 2);
      }
      case "create_or_update_file": {
        const { owner, repo } = await fixOwnerRepo(args, robotId);
        let fileContent = args.content;
        if (args.path?.endsWith(".json")) {
          try {
            JSON.parse(fileContent);
            console.log(`[GitHub] JSON already valid for ${args.path}`);
          } catch {
            try {
              let cleaned = fileContent;
              cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
              cleaned = cleaned.replace(/"\s*,\s*"/g, (m: string) => m);
              cleaned = cleaned.replace(/(["\d\]}])\s*,\s*,+\s*([\[{"])/g, '$1, $2');
              cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
              const parsed = JSON.parse(cleaned);
              fileContent = JSON.stringify(parsed, null, 2);
              console.log(`[GitHub] JSON cleaned (trailing commas removed) for ${args.path}`);
            } catch (jsonErr: any) {
              console.log(`[GitHub] WARNING: Content for ${args.path} is not valid JSON after cleaning: ${jsonErr.message}`);
              try {
                let aggressive = fileContent;
                aggressive = aggressive.replace(/,(\s*[}\]])/g, '$1');
                aggressive = aggressive.replace(/,\s*,/g, ',');
                aggressive = aggressive.replace(/\[\s*,/g, '[');
                aggressive = aggressive.replace(/,\s*\]/g, ']');
                const parsed = JSON.parse(aggressive);
                fileContent = JSON.stringify(parsed, null, 2);
                console.log(`[GitHub] JSON cleaned (aggressive pass) for ${args.path}`);
              } catch (e2: any) {
                console.log(`[GitHub] CRITICAL: Could not fix JSON for ${args.path}: ${e2.message}`);
              }
            }
          }
        }
        const workflowMatch = args.path?.match(/S([012])\.workflow\.json$/);
        if (workflowMatch) {
          const stageKey = `S${workflowMatch[1]}` as "S0" | "S1" | "S2";
          console.log(`[QualityGate] Validating ${stageKey} before push (attempt 1)...`);
          let validation = validateStage(stageKey, fileContent);
          console.log(`[QualityGate] ${stageKey} score=${validation.score}/100, pass=${validation.pass}, failures=${validation.failures.length}`);

          if (!validation.pass) {
            console.log(`[QualityGate] ${stageKey} FAILED attempt 1. Auto-regenerating...`);
            try {
              const regenResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "system",
                    content: `You are a JSON workflow fixer. You receive a ReactFlow workflow JSON that failed quality validation. Fix ONLY the text content fields to address the listed failures. Keep all layout, positions, ids, edges, and structure unchanged. Return ONLY the corrected full JSON — no explanation, no markdown.`,
                  },
                  {
                    role: "user",
                    content: `${validation.requiredFixPrompt}\n\nPatch suggestions:\n${validation.patchSuggestions.join("\n")}\n\nOriginal JSON:\n${fileContent}`,
                  },
                ],
                temperature: 0.2,
                max_tokens: 16000,
              });

              let fixedContent = regenResponse.choices[0]?.message?.content?.trim() || "";
              fixedContent = fixedContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

              try {
                const parsed = JSON.parse(fixedContent);
                fixedContent = JSON.stringify(parsed, null, 2);
              } catch {
                console.log(`[QualityGate] Regenerated content is not valid JSON, keeping original`);
                return JSON.stringify({
                  quality_gate_failed: true,
                  stage: stageKey,
                  score: validation.score,
                  failures: validation.failures,
                  errors: validation.errors,
                  requiredFixPrompt: validation.requiredFixPrompt,
                  patchSuggestions: validation.patchSuggestions,
                  instruction: `⚠️ QUALITY GATE FAILED for ${stageKey} (score: ${validation.score}/100). Auto-regeneration produced invalid JSON. Fix ALL failures manually and retry:\n${validation.requiredFixPrompt}`
                }, null, 2);
              }

              console.log(`[QualityGate] Re-validating ${stageKey} (attempt 2)...`);
              const validation2 = validateStage(stageKey, fixedContent);
              console.log(`[QualityGate] ${stageKey} attempt 2: score=${validation2.score}/100, pass=${validation2.pass}, failures=${validation2.failures.length}`);

              if (validation2.pass) {
                console.log(`[QualityGate] ${stageKey} PASSED after auto-regeneration (score: ${validation2.score}/100) ✅`);
                fileContent = fixedContent;
              } else {
                console.log(`[QualityGate] ${stageKey} STILL FAILED after auto-regeneration`);
                return JSON.stringify({
                  quality_gate_failed: true,
                  stage: stageKey,
                  score: validation2.score,
                  failures: validation2.failures,
                  errors: validation2.errors,
                  requiredFixPrompt: validation2.requiredFixPrompt,
                  patchSuggestions: validation2.patchSuggestions,
                  auto_regen_attempted: true,
                  instruction: `⚠️ QUALITY GATE FAILED for ${stageKey} TWICE (score: ${validation2.score}/100). Auto-regeneration attempted but still failed. Fix ALL remaining failures and call create_or_update_file again:\n${validation2.requiredFixPrompt}`
                }, null, 2);
              }
            } catch (regenErr: any) {
              console.log(`[QualityGate] Auto-regeneration error: ${regenErr.message}`);
              return JSON.stringify({
                quality_gate_failed: true,
                stage: stageKey,
                score: validation.score,
                failures: validation.failures,
                errors: validation.errors,
                requiredFixPrompt: validation.requiredFixPrompt,
                patchSuggestions: validation.patchSuggestions,
                instruction: `⚠️ QUALITY GATE FAILED for ${stageKey} (score: ${validation.score}/100). Auto-regeneration failed (${regenErr.message}). Fix ALL failures manually:\n${validation.requiredFixPrompt}`
              }, null, 2);
            }
          } else {
            console.log(`[QualityGate] ${stageKey} PASSED first attempt (score: ${validation.score}/100) ✅`);
          }
        }

        const result = await createOrUpdateFile(owner, repo, args.path, fileContent, args.commit_message);
        return JSON.stringify(result, null, 2);
      }
      case "get_commit_checks": {
        const { owner, repo } = await fixOwnerRepo(args, robotId);
        return JSON.stringify(await getCommitChecks(owner, repo, args.ref), null, 2);
      }
      case "get_workflow_runs": {
        const { owner, repo } = await fixOwnerRepo(args, robotId);
        return JSON.stringify(await getWorkflowRuns(owner, repo), null, 2);
      }
      case "get_workflow_run_logs": {
        const { owner, repo } = await fixOwnerRepo(args, robotId);
        return JSON.stringify(await getWorkflowRunLogs(owner, repo, args.run_id), null, 2);
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    const errMsg = err.message || "Unknown error";
    if (errMsg.includes("<!DOCTYPE") || errMsg.includes("<html")) {
      return `Error: GitHub API returned an HTML error page. The token may have expired. Please retry.`;
    }
    return `Error: ${errMsg.substring(0, 500)}`;
  }
}

const BASE_SYSTEM_PROMPT = `You are "SFM Pipeline Engine" — a deterministic stage builder for the SEESAW governance platform.
You are NOT a conversational assistant. You are a stage pipeline that converts structured task-board JSON into governed workflow stages (S0, S1, S2).

LANGUAGE: Arabic by default. Minimal responses. Only operational confirmations.

========================
IDENTITY
========================
- You are inside a visual room with 3 developers:
  1) Claude Code agent (executor)
  2) GPT agent (you) (governance + stage builder)
  3) Human developer (Sameer) (decision authority)
- Two upstream systems feed you:
  - pd.sillar.us → produces structured analysis JSON
  - cp.sillar.us → enriches and exports final task-board JSON

========================
INTAKE RULE (CRITICAL)
========================
- You MUST accept structured task-board JSON as PRIMARY input.
- If the user sends JSON (detected by { at start or containing "tasks", "project", "board", "stories", "features"), treat it as task-board input.
- Do NOT ask for a story if JSON is provided.
- Do NOT ask clarifying questions if required fields exist in the JSON.
- If user sends plain text that describes a problem (not JSON), accept it as a story and process it directly without questions.
- NEVER ask "what do you want?" or "can you clarify?" — just process the input.

========================
PIPELINE MODE (STRICT SEQUENCE — TWO-STEP GENERATION)
========================
Each stage uses TWO steps: A) Extract structured facts → B) Fill template with facts only.
This produces grounded, specific output — not generic text.

1) Receive task-board JSON or story text
2) Generate analysis.json (only if not already present in this run) → push to GitHub
3) EXTRACT S0_FACTS from input → FILL S0 template using only those facts → push S0.workflow.json
   ⚠️ System auto-validates S0 before push. If validation fails, fix errors and retry.
4) Reply ONLY: "S0 جاهزة. اكتب: اقفل S0"
5) WAIT for explicit command: "اقفل S0" or "close s0"
6) EXTRACT S1_FACTS → FILL S1 template → push S1.workflow.json (with auto-validation)
7) Reply: "S1 جاهزة. اكتب: اقفل S1" → WAIT for "اقفل S1"
8) EXTRACT S2_FACTS → FILL S2 template → push S2.workflow.json (with auto-validation)
9) Reply: "S2 جاهزة. اكتب: اقفل S2" → WAIT for "اقفل S2"
10) Reply: "تم. Pipeline مكتمل." → STOP.

QUALITY GATE (STRICT — score 0-100, threshold 85):
If the system returns quality_gate_failed=true:
1) Read the "requiredFixPrompt" field — it tells you EXACTLY what to fix.
2) Read the "patchSuggestions" array for specific fix guidance.
3) Regenerate the workflow JSON fixing ALL listed failures.
4) Keep layout/ids/edges unchanged — only replace text content fields.
5) Call create_or_update_file again with the corrected JSON.
6) If validation fails a SECOND time, return the error to the user — do NOT push.
You have exactly ONE retry. Do NOT proceed to the next stage until validation passes.

If user says anything else while waiting for close command:
- Reply with ONE line only: the required close command reminder.

========================
REPO BINDING (ONE-TIME)
========================
- Repo must be bound ONCE at session start.
- If repo is already bound (check SESSION STATE below), NEVER ask again.
- If repo is NOT bound and user hasn't provided one, ask ONLY ONCE:
  "أعطني GitHub repo بصيغة: owner/repo"
- After binding, set runId = YYYYMMDD-HHMMSS timestamp.
- Use stored repoOwner/repoName for ALL pushes. Never ask again.

========================
PUSH PATH FORMAT
========================
All artifacts go under: seesaw/{runId}/
- seesaw/{runId}/analysis.json
- seesaw/{runId}/S0.workflow.json
- seesaw/{runId}/S1.workflow.json
- seesaw/{runId}/S2.workflow.json

========================
GITHUB PUSH RULES
========================
- Always use create_or_update_file tool for pushes.
- Parameters: owner, repo, path, content (full JSON string), commit_message
- Commit message: "SFM {runId}: add {filename}"
- If push fails: log error, return the generated JSON content so user can save manually.
- DO NOT pass extra parameters (position, width, height) to the tool. Those go INSIDE the JSON content string.

========================
STAGE DISCIPLINE (STRICT) — Sillar SEESAW Methodology
========================
S0 — Problem Definition (Human 95% / AI 5%):
PURPOSE: Define the REAL problem — not the solution. Understand business, regulatory, operational context. Identify constraints.
- Human: يملك تعريف المشكلة، يحدد السياق (تجاري/تنظيمي/تشغيلي)، يوثق القيود والافتراضات.
- AI: يدعم التفكير النقدي، يكشف النقاط العمياء، يطرح أسئلة تحليلية.
- RESTRICTIONS: ["لا حلول تنفيذية","لا API","لا UI","لا DB Schema","لا Architecture","لا CRUD","لا Code","AI لا يعرّف المشكلة","AI لا يقرر اتجاه الحل"]
- GATE: Problem Gate — Human Only. يجب توثيق: بيان المشكلة، القيود، الافتراضات.
- CONTENT MUST ANSWER: ما هي المشكلة الحقيقية؟ ما السياق؟ ما القيود؟ من المتأثرون؟

S1 — Product Shaping (Human 80% / AI 20%):
PURPOSE: Define product vision, set MVP boundaries, decide priorities and scope.
- Human: يحدد رؤية المنتج، يعتمد حدود MVP، يملك منطق الأولويات، يوافق على نطاق المنتج.
- AI: يصيغ قصص المستخدم، يكتشف الحالات الحدية، يحلل السوق، يفكك الميزات.
- RESTRICTIONS: ["AI لا يحدد نطاق MVP","AI لا يرتب الأولويات","AI لا يتخذ قرارات المفاضلة","لا Architecture","لا Tech Stack"]
- GATE: Product Gate — Human. يجب توثيق: نطاق المنتج المعتمد، تعريف MVP الصريح.
- CONTENT MUST ANSWER: ما رؤية المنتج؟ ما حدود MVP؟ ما الأولويات؟ ما قصص المستخدم الرئيسية؟ ما الحالات الحدية؟

S2 — Architecture Design (Human 70% / AI 30%):
PURPOSE: Make architectural decisions, evaluate trade-offs (performance, cost, security, scalability), approve technology stack.
- Human: يتخذ القرارات المعمارية، يقيّم المفاضلات، يوافق على الحزمة التقنية، يملك الدين التقني طويل المدى.
- AI: يقترح أنماط معمارية، يولّد مخططات، يعرض بدائل تقنية، يساعد في تحليل الأداء.
- RESTRICTIONS: ["لا قرار معماري بدون فهم بشري كامل","AI لا يختار المعمارية النهائية","AI لا يقرر في الأمن","AI لا يقرر في البنية التحتية الحساسة للتكلفة"]
- GATE: Architecture Gate — Human. يجب توثيق: سجل قرار معماري (ADR)، مخططات مراجعة بشرياً.
- CONTENT MUST ANSWER: ما المكونات المفاهيمية؟ ما العلاقات بينها؟ ما المفاضلات؟ ما نموذج الحالات؟ ما قواعد الحوكمة؟

========================
STAGE WORKFLOW ENGINE (S0–S2)
========================
Use the ReactFlow workflow structure from TEMPLATES below:
- nodes: group + stage + insight + outcome + direction + gate-problem + alignment-gate + evidence-node
- edges: 6 edges with "custom" type
- Replace every GROUP_ID with: group-s{stage}-{timestamp}-{rand4}
  - timestamp: 13-digit unix ms
  - rand4: 4 random lowercase letters
  - ParentId must match the GROUP_ID
- YOU MUST FILL all allowed content fields with REAL DATA from the analysis. EMPTY FIELDS = FAILURE.
- Allowed fields to fill (NEVER leave empty):
  - "description": Write 2-5 sentences in Arabic describing the stage content based on analysis data.
  - "aiResponsibilities": Array of 3-5 specific AI tasks (e.g., ["تحليل البيانات الواردة","اكتشاف الأنماط المكررة","تصنيف التذاكر تلقائياً"])
  - "humanResponsibilities": Array of 3-5 specific human tasks (e.g., ["مراجعة التصنيفات","الموافقة على الإغلاق","تحديد الأولويات"])
  - "gateChecklist": Array of 3-5 gate conditions (e.g., ["تم تحديد المشكلة الأساسية","تم حصر الأطراف المعنية","تم توثيق القيود"])
  - "justification": One sentence explaining why this evidence matters
  - "owner": Who owns this evidence (e.g., "فريق الدعم الفني" or "المدير")

CRITICAL RULE: If ANY description, aiResponsibilities, humanResponsibilities, or gateChecklist is empty ([]) or (""), your output is REJECTED. Fill every field using data from analysis.json context, actors, frictions, signals, and desired_outcomes.

- NEVER change: layout, positions, widths, heights, ids (except GROUP_ID), edges, types.
- JSON SYNTAX: Do NOT put trailing commas. Wrong: "key": "value",} or "items": ["a","b",]. Correct: "key": "value"} and "items": ["a","b"]. Every comma must be followed by another key or value, NEVER by } or ].

========================
ANALYSIS JSON FORMAT (ENRICHED)
========================
When generating analysis.json from input, include ALL of these fields:
{
  "language": "ar|en",
  "source": "task-board|story",
  "context": [],
  "core_problem": "",
  "actors": [],
  "signals": [],
  "frictions": [],
  "constraints": [],
  "desired_outcomes": [],
  "scope_in": [],
  "scope_out": [],
  "unknowns": [],
  "harm": [],
  "failure_modes": [],
  "governance_gaps": [],
  "evidence_examples": [],
  "success_criteria": []
}
- harm: 3+ concrete damages caused by the problem (data loss, wrong closures, trust erosion)
- failure_modes: 5+ specific failure points from the input (dashboard mismatch, closure without approval, missing serial, server errors, unclear roles)
- governance_gaps: 3+ gaps in: assignment, closure approval, serial tracking
- evidence_examples: 3+ concrete examples quoted/referenced from the input text
- success_criteria: 3+ hard measurable criteria
- NO clarifying_questions field. This is a pipeline, not a discussion.
- If input is from task-board JSON (cp/pd), treat it as PRIMARY source. Extract fields before generation.

===== SFM TEMPLATES KNOWLEDGE =====
${SFM_TEMPLATES}
===== END SFM TEMPLATES =====

========================
AVAILABLE TOOLS
========================
CLICKUP:
- get_clickup_tasks, get_workspace_structure, get_workspace_members
- search_clickup_tasks, get_task_details, update_clickup_task, create_clickup_task

GITHUB:
- get_github_repos, get_repo_contents
- create_or_update_file (USE THIS FOR ALL PUSHES)
- get_commit_checks, get_workflow_runs, get_workflow_run_logs

========================
RESPONSE RULES
========================
- NO chat mode. NO discussion. NO questions (except repo binding if needed).
- Only operational confirmations.
- After push success: one-line Arabic confirmation with close command.
- After all stages done: "تم. Pipeline مكتمل."
- If user sends anything unrelated: one-line reminder of current required action.`;

interface SessionState {
  repoBound: boolean;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  runId: string;
  inputReceived: boolean;
  inputType: "none" | "json" | "story";
  taskBoardJson: string;
  stageStatus: { S0: string; S1: string; S2: string };
  pushedFiles: string[];
}

const robotSessions: Record<string, SessionState> = {};

function getSessionKey(robotId: string, roomId: string): string {
  return `${roomId}:${robotId}`;
}

function getOrCreateSession(robotId: string, roomId: string = "default"): SessionState {
  const key = getSessionKey(robotId, roomId);
  if (!robotSessions[key]) {
    robotSessions[key] = {
      repoBound: false,
      repoOwner: "",
      repoName: "",
      repoBranch: "main",
      runId: "",
      inputReceived: false,
      inputType: "none",
      taskBoardJson: "",
      stageStatus: { S0: "pending", S1: "pending", S2: "pending" },
      pushedFiles: [],
    };
  }
  return robotSessions[key];
}

function isJsonInput(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  const jsonKeywords = ["tasks", "project", "board", "stories", "features", "task_board", "taskBoard"];
  const lower = trimmed.toLowerCase();
  if (jsonKeywords.some(k => lower.includes(`"${k}"`))) return true;
  return false;
}

function detectSessionUpdates(robotId: string, message: string, history: Array<{ role: string; content: string }>, roomId: string = "default") {
  const session = getOrCreateSession(robotId, roomId);

  const extractOwnerRepo = (text: string): { owner: string; repo: string } | null => {
    const githubUrl = text.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
    if (githubUrl) return { owner: githubUrl[1], repo: githubUrl[2].replace(/\.git$/, "") };
    const allMatches = Array.from(text.matchAll(/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/g));
    const filtered = allMatches.filter(m => !["com", "www", "http", "https", "github", "api"].includes(m[1].toLowerCase()));
    if (filtered.length > 0) return { owner: filtered[filtered.length - 1][1], repo: filtered[filtered.length - 1][2] };
    if (allMatches.length > 0) {
      const last = allMatches[allMatches.length - 1];
      return { owner: last[1], repo: last[2] };
    }
    return null;
  };

  if (!session.repoBound) {
    const repoMatch = extractOwnerRepo(message);
    if (repoMatch) {
      session.repoBound = true;
      session.repoOwner = repoMatch.owner;
      session.repoName = repoMatch.repo;
      const now = new Date();
      session.runId = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
      console.log(`[Session] Repo bound: ${repoMatch.owner}/${repoMatch.repo}, runId: ${session.runId}`);
    }
    for (const msg of history) {
      if (msg.role === "user" && !session.repoBound) {
        const hMatch = extractOwnerRepo(msg.content);
        if (hMatch) {
          session.repoBound = true;
          session.repoOwner = hMatch.owner;
          session.repoName = hMatch.repo;
          console.log(`[Session] Repo bound from history: ${hMatch.owner}/${hMatch.repo}`);
        }
      }
      const runMatch = msg.content.match(/runId:\s*(\d{8}-\d{6})/);
      if (runMatch) {
        session.runId = runMatch[1];
      }
    }
  }

  if (!session.inputReceived && session.repoBound) {
    if (isJsonInput(message)) {
      session.inputReceived = true;
      session.inputType = "json";
      session.taskBoardJson = message;
      console.log(`[Session] Task-board JSON received (${message.length} chars)`);
    } else if (!message.includes("اقفل") && !message.toLowerCase().includes("close s") && message.length > 20) {
      const trimmed = message.trim();
      const isRepoRef = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed);
      const isGitHubUrl = /github\.com/i.test(trimmed);
      const isGreeting = /^(مرحبا|هلا|السلام|hi|hello|hey)\b/i.test(trimmed);
      if (!isRepoRef && !isGitHubUrl && !isGreeting) {
        session.inputReceived = true;
        session.inputType = "story";
        console.log(`[Session] Story text received`);
      }
    }
    for (const msg of history) {
      if (msg.role === "user" && !session.inputReceived) {
        if (isJsonInput(msg.content)) {
          session.inputReceived = true;
          session.inputType = "json";
          session.taskBoardJson = msg.content;
          console.log(`[Session] Task-board JSON detected from history`);
        } else if (msg.content.length > 30 && !msg.content.includes("github.com") && !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(msg.content.trim())) {
          const notGreeting = !/^(مرحبا|هلا|السلام|hi|hello|hey)\b/i.test(msg.content.trim());
          const notCommand = !msg.content.includes("اقفل") && !msg.content.toLowerCase().includes("close s");
          if (notGreeting && notCommand) {
            session.inputReceived = true;
            session.inputType = "story";
            console.log(`[Session] Story text detected from history`);
          }
        }
      }
    }
  }

  const allMessages = [...history, { role: "user", content: message }];
  for (const msg of allMessages) {
    const t = msg.content;
    if (t.includes("analysis.json ✅") || (t.includes("تم رفع") && t.includes("analysis"))) {
      session.inputReceived = true;
    }
    if (t.includes("S0.workflow.json ✅") || t.includes("S0 جاهزة")) {
      if (session.stageStatus.S0 === "pending") session.stageStatus.S0 = "pushed";
      session.inputReceived = true;
    }
    if (t.includes("S1.workflow.json ✅") || t.includes("S1 جاهزة")) {
      if (session.stageStatus.S1 === "pending") session.stageStatus.S1 = "pushed";
    }
    if (t.includes("S2.workflow.json ✅") || t.includes("S2 جاهزة")) {
      if (session.stageStatus.S2 === "pending") session.stageStatus.S2 = "pushed";
    }
    const tLower = t.toLowerCase();
    if (t.includes("اقفل S0") || t.includes("اقفل s0") || tLower.includes("close s0")) {
      session.stageStatus.S0 = "closed";
    }
    if (t.includes("اقفل S1") || t.includes("اقفل s1") || tLower.includes("close s1")) {
      session.stageStatus.S1 = "closed";
    }
    if (t.includes("اقفل S2") || t.includes("اقفل s2") || tLower.includes("close s2")) {
      session.stageStatus.S2 = "closed";
    }
    if (t.includes("Pipeline مكتمل")) {
      session.stageStatus.S0 = "closed";
      session.stageStatus.S1 = "closed";
      session.stageStatus.S2 = "closed";
    }
  }

  return session;
}

function buildSessionContext(session: SessionState): string {
  let ctx = `\n\n========================\nCURRENT SESSION STATE (INJECTED BY SYSTEM - TRUST THIS)\n========================\n`;
  ctx += `repoBound: ${session.repoBound}\n`;
  if (session.repoBound) {
    ctx += `repoOwner: ${session.repoOwner}\n`;
    ctx += `repoName: ${session.repoName}\n`;
    ctx += `repoBranch: ${session.repoBranch}\n`;
    ctx += `runId: ${session.runId}\n`;
  }
  ctx += `inputReceived: ${session.inputReceived}\n`;
  ctx += `inputType: ${session.inputType}\n`;
  ctx += `S0: ${session.stageStatus.S0}\n`;
  ctx += `S1: ${session.stageStatus.S1}\n`;
  ctx += `S2: ${session.stageStatus.S2}\n`;

  if (!session.repoBound) {
    ctx += `\n⚡ PIPELINE BLOCKED: No repo bound. Ask ONCE: "أعطني GitHub repo بصيغة: owner/repo"\n`;
    return ctx;
  }

  const FILL_REMINDER = `REMINDER: Every description, aiResponsibilities, humanResponsibilities, gateChecklist, justification, and owner field MUST be filled with real Arabic content from the analysis. EMPTY FIELDS = REJECTED OUTPUT.`;

  if (session.inputReceived && session.stageStatus.S0 === "pending") {
    ctx += `\n🚨 MANDATORY PIPELINE ACTION — TWO-STEP GENERATION:\n`;
    ctx += `Input received (type: ${session.inputType}). Execute this EXACT sequence:\n\n`;
    ctx += `STEP 1: Generate analysis.json → Push: create_or_update_file(...analysis.json...)\n\n`;
    ctx += `STEP 2A — EXTRACT FACTS:\n`;
    ctx += buildExtractPrompt("S0") + "\n\n";
    ctx += `STEP 2B — FILL S0 TEMPLATE with extracted facts:\n`;
    ctx += buildFillPrompt("S0") + "\n\n";
    ctx += `${FILL_REMINDER}\n`;
    ctx += `S0 = Problem Definition (Human 95% / AI 5%). NODE FILL GUIDE:\n`;
    ctx += `- stage-0-1.description: Use core_problem + failure_modes + evidence_examples from Facts. MUST have 3+ concrete examples.\n`;
    ctx += `- stage-0-1.aiResponsibilities: ["دعم التفكير النقدي حول المشكلة","كشف النقاط العمياء في التحليل","طرح أسئلة تحليلية حول السياق","تعداد السيناريوهات المحتملة"]\n`;
    ctx += `- stage-0-1.humanResponsibilities: ["تعريف المشكلة الحقيقية","فهم السياق التنظيمي والتشغيلي","تحديد القيود التقنية وغير التقنية","تقرير ما إذا كانت المشكلة تستحق الحل"]\n`;
    ctx += `- insight-node-2.description: Use governance_gaps + harm. MUST mention "حوكمة" or "governance" or "إدارة".\n`;
    ctx += `- outcome-node-3.description: Formal problem statement from core_problem + constraints. FORBIDDEN: "تحسين النظام".\n`;
    ctx += `- direction-node-4.description: From constraints + out_of_scope. NO solution words.\n`;
    ctx += `- gate-problem-5.gateChecklist: 5+ items from success_criteria + governance_gaps.\n`;
    ctx += `- evidence-node-7: description + justification + owner — all from Facts.\n`;
    ctx += `\nSTEP 3: Push S0 → create_or_update_file(owner="${session.repoOwner}", repo="${session.repoName}", path="seesaw/${session.runId}/S0.workflow.json", ...)\n`;
    ctx += `⚠️ QUALITY GATE: System auto-validates S0. If validation fails, errors returned — you MUST fix and re-push.\n`;
    ctx += `Reply ONLY: "S0 جاهزة. اكتب: اقفل S0"\n`;
  }

  if (session.stageStatus.S0 === "closed" && session.stageStatus.S1 === "pending") {
    ctx += `\n🚨 MANDATORY PIPELINE ACTION — TWO-STEP GENERATION:\n`;
    ctx += `S0 closed. Generate S1 using Extract→Fill method:\n\n`;
    ctx += `STEP A — EXTRACT FACTS:\n`;
    ctx += buildExtractPrompt("S1") + "\n\n";
    ctx += `STEP B — FILL S1 TEMPLATE with extracted facts:\n`;
    ctx += buildFillPrompt("S1") + "\n\n";
    ctx += `${FILL_REMINDER}\n`;
    ctx += `S1 = Product Shaping (Human 80% / AI 20%). NODE FILL GUIDE:\n`;
    ctx += `- stage-1-1.description: List 4+ actors by name from Facts. Describe their interactions.\n`;
    ctx += `- stage-1-1.aiResponsibilities: ["صياغة قصص المستخدم من المهام","اكتشاف الحالات الحدية في التدفقات","تحليل السوق والمقارنة","تفكيك الميزات إلى وحدات أصغر"]\n`;
    ctx += `- stage-1-1.humanResponsibilities: ["تحديد رؤية المنتج","اعتماد حدود MVP","امتلاك منطق الأولويات","الموافقة على نطاق المنتج"]\n`;
    ctx += `- insight-node-2.description: Include the concrete 5-step flow from Facts.\n`;
    ctx += `- outcome-node-3.description: Define MVP scope with explicit boundaries.\n`;
    ctx += `- direction-node-4.description: MUST include ALL 3 hard rules verbatim.\n`;
    ctx += `- gate-problem-5.gateChecklist: 5+ items covering actors, flow, rules, edge cases.\n`;
    ctx += `- evidence-node-7: description + justification + owner — all from Facts.\n`;
    ctx += `\nPush: create_or_update_file(owner="${session.repoOwner}", repo="${session.repoName}", path="seesaw/${session.runId}/S1.workflow.json", ...)\n`;
    ctx += `⚠️ QUALITY GATE: System auto-validates S1. If validation fails, errors returned — you MUST fix and re-push.\n`;
    ctx += `Reply ONLY: "S1 جاهزة. اكتب: اقفل S1"\n`;
  }

  if (session.stageStatus.S1 === "closed" && session.stageStatus.S2 === "pending") {
    ctx += `\n🚨 MANDATORY PIPELINE ACTION — TWO-STEP GENERATION:\n`;
    ctx += `S1 closed. Generate S2 using Extract→Fill method:\n\n`;
    ctx += `STEP A — EXTRACT FACTS:\n`;
    ctx += buildExtractPrompt("S2") + "\n\n";
    ctx += `STEP B — FILL S2 TEMPLATE with extracted facts:\n`;
    ctx += buildFillPrompt("S2") + "\n\n";
    ctx += `${FILL_REMINDER}\n`;
    ctx += `S2 = Architecture Design (Human 70% / AI 30%). NODE FILL GUIDE:\n`;
    ctx += `- stage-2-1.description: Name conceptual components, describe relationships, tradeoffs.\n`;
    ctx += `- stage-2-1.aiResponsibilities: ["اقتراح أنماط معمارية مناسبة","عرض بدائل تقنية مع مقارنة","تحليل الأداء وقابلية التوسع","توليد مخططات المكونات"]\n`;
    ctx += `- stage-2-1.humanResponsibilities: ["اتخاذ القرارات المعمارية النهائية","تقييم المفاضلات بين البدائل","الموافقة على الحزمة التقنية","تحمّل الدين التقني طويل المدى"]\n`;
    ctx += `- insight-node-2.description: State model for key entities, governance rules.\n`;
    ctx += `- outcome-node-3.description: ADR + component diagrams + state model + governance.\n`;
    ctx += `- direction-node-4.description: Core vs supporting components, governance model.\n`;
    ctx += `- gate-problem-5.gateChecklist: 5+ items covering components, tradeoffs, state model, governance.\n`;
    ctx += `- evidence-node-7: description + justification + owner.\n`;
    ctx += `\nPush: create_or_update_file(owner="${session.repoOwner}", repo="${session.repoName}", path="seesaw/${session.runId}/S2.workflow.json", ...)\n`;
    ctx += `⚠️ QUALITY GATE: System auto-validates S2. If validation fails, errors returned — you MUST fix and re-push.\n`;
    ctx += `Reply ONLY: "S2 جاهزة. اكتب: اقفل S2"\n`;
  }

  if (session.stageStatus.S2 === "closed") {
    ctx += `\n✅ ALL STAGES CLOSED. Reply: "تم. Pipeline مكتمل."\n`;
  }

  if (session.stageStatus.S0 === "pushed" && session.stageStatus.S1 === "pending") {
    ctx += `\n⏸️ WAITING: S0 pushed. Waiting for user to say "اقفل S0". Do NOT proceed.\n`;
  }
  if (session.stageStatus.S1 === "pushed" && session.stageStatus.S2 === "pending") {
    ctx += `\n⏸️ WAITING: S1 pushed. Waiting for user to say "اقفل S1". Do NOT proceed.\n`;
  }
  if (session.stageStatus.S2 === "pushed") {
    ctx += `\n⏸️ WAITING: S2 pushed. Waiting for user to say "اقفل S2". Do NOT proceed.\n`;
  }

  return ctx;
}

function hasPendingMandatoryAction(session: SessionState): string | null {
  if (session.inputReceived && session.stageStatus.S0 === "pending") return "S0";
  if (session.stageStatus.S0 === "closed" && session.stageStatus.S1 === "pending") return "S1";
  if (session.stageStatus.S1 === "closed" && session.stageStatus.S2 === "pending") return "S2";
  return null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const getRoomId = (req: any): string => {
    return req.headers["x-room-id"] as string || "default";
  };

  const jwtSecret = process.env.JWT_SECRET!;

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const existing = await storage.getUserByUsername(username.trim());
      if (existing) {
        return res.status(409).json({ error: "Username already taken" });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const user = await storage.createUser({
        username: username.trim(),
        password: hashedPassword,
        roomId,
      });

      await storage.createRoom(roomId);

      const jwtSecret = process.env.JWT_SECRET!;
      const token = jwt.sign(
        { userId: user.id, username: user.username, roomId: user.roomId },
        jwtSecret,
        { expiresIn: "30d" }
      );

      console.log(`[Auth] New user registered: ${user.username}, room: ${user.roomId}`);

      res.json({
        success: true,
        token,
        user: { username: user.username, roomId: user.roomId },
        roomId: user.roomId,
      });
    } catch (e: any) {
      console.error("[Auth] Register error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username.trim());
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const jwtSecret = process.env.JWT_SECRET!;
      const token = jwt.sign(
        { userId: user.id, username: user.username, roomId: user.roomId },
        jwtSecret,
        { expiresIn: "30d" }
      );

      console.log(`[Auth] User logged in: ${user.username}, room: ${user.roomId}`);

      res.json({
        success: true,
        token,
        user: { username: user.username, roomId: user.roomId },
        roomId: user.roomId,
      });
    } catch (e: any) {
      console.error("[Auth] Login error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/verify", async (req, res) => {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : (req.query.token as string | undefined);

      if (!token) {
        return res.json({ valid: false });
      }

      const jwtSecret = process.env.JWT_SECRET!;
      const payload = jwt.verify(token, jwtSecret) as {
        userId: number;
        username: string;
        roomId: string;
      };

      res.json({
        valid: true,
        user: { username: payload.username, roomId: payload.roomId },
      });
    } catch {
      res.json({ valid: false });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, robotId, history } = req.body;
      const roomId = getRoomId(req);

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const chatHistory: Array<{ role: string; content: string }> = Array.isArray(history) ? history : [];

      const session = detectSessionUpdates(robotId || "robot-1", message, chatHistory, roomId);
      const sessionContext = buildSessionContext(session);
      console.log(`[Session] robotId: ${robotId}, room: ${roomId}, state:`, JSON.stringify(session.stageStatus), `repoBound: ${session.repoBound}, repo: ${session.repoOwner}/${session.repoName}, runId: ${session.runId}`);

      const [models, hallWorkers, defaultModelName] = await Promise.all([getModels(roomId), getHallWorkers(roomId), getDefaultModel(roomId)]);
      const allModels = [...models, ...hallWorkers];
      let modelConfig = allModels.find(m => m.id === robotId) || allModels.find(m => m.name.toLowerCase() === defaultModelName.toLowerCase()) || allModels[0];
      const modelName = (modelConfig?.name || "GPT").toLowerCase();
      const isClaudeModel = modelName.includes("claude") || modelName.includes("كلود");

      const isS0Trigger = message.trim().toUpperCase().startsWith("S0") && message.length < 50;
      const isS0Response = chatHistory.length > 0 && chatHistory.some((m: any) => 
        m.role === "assistant" && (m.content?.includes("S0") || m.content?.includes("مرحلة S0") || m.content?.includes("ما الذي تحاول بناءه"))
      );
      const isS0Mode = false;
      
      console.log(`[Chat] Robot ${robotId} → model: ${modelConfig?.name || "GPT (default)"}, id: ${modelConfig?.id}, isClaudeModel: ${isClaudeModel}, default: ${defaultModelName}, S0Mode: ${isS0Mode}, trigger: ${isS0Trigger}, response: ${isS0Response}`);

      let githubUser = "";
      try {
        githubUser = await getAuthenticatedUser();
      } catch (_e) {}

      let systemPrompt = modelConfig?.systemPrompt || (await getSystemPrompt(roomId)) || "";

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // S0 mode - simplified
      if (message.trim().toUpperCase().startsWith("S0") && message.length < 20) {
        const s0Prompt = `S0 STRICT MODE:
- Ask ONE question only: "ما الذي تحاول بناءه؟"
- After answer, output: S0-INTERVIEW.json + INTENT.md
- Then ask: "هل تريد المتابعة لـ S1؟"
- NO code, NO architecture, NO more questions.`;

        res.write(`data: ${JSON.stringify({ content: "ما الذي تحاول بناءه؟ (وصف موجز بجملة واحدة)" })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }

      if (session.stageStatus.S0 === "closed" && session.stageStatus.S1 === "closed" && session.stageStatus.S2 === "closed") {
        console.log(`[Pipeline] All stages closed. Returning completion message directly.`);
        res.write(`data: ${JSON.stringify({ content: "تم. Pipeline مكتمل." })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }

      if (isClaudeModel) {
        const claudeClient = modelConfig?.apiKey
          ? new Anthropic({ apiKey: modelConfig.apiKey })
          : anthropic;

        console.log(`[Claude] Using API key: ${modelConfig?.apiKey ? "vault" : "env"}`);

        res.write(`data: ${JSON.stringify({ content: "" })}\n\n`);

        let messages: Anthropic.MessageParam[] = [
          ...chatHistory.map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          })),
        ];
        if (!messages.length || messages[messages.length - 1].role !== "user") {
          messages.push({ role: "user", content: message });
        }

        let maxIterations = 5;
        while (maxIterations-- > 0) {
          console.log(`[Claude] Iteration ${6 - maxIterations}, messages: ${messages.length}`);
          let response;
          try {
            response = await claudeClient.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8192,
              ...(systemPrompt ? { system: systemPrompt } : {}),
              tools: anthropicTools,
              messages,
            });
          } catch (claudeError: any) {
            console.error("[Claude] API error:", claudeError.message);
            res.write(`data: ${JSON.stringify({ content: `خطأ في الاتصال بكلود: ${claudeError.message}` })}\n\n`);
            break;
          }

          console.log(`[Claude] stop_reason: ${response.stop_reason}, blocks: ${response.content.length}`);

          let hasToolUse = false;
          const toolResults: Anthropic.MessageParam[] = [];

          for (const block of response.content) {
            if (block.type === "text") {
              res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              hasToolUse = true;
              res.write(`data: ${JSON.stringify({ content: `\n⚙️ جاري تنفيذ ${block.name}...\n` })}\n\n`);
              let toolResult = await executeToolCall(block.name, block.input, robotId || "robot-2", roomId);
              if (toolResult.length > 8000) {
                console.log(`[Claude] Tool result truncated from ${toolResult.length} to 8000 chars`);
                toolResult = toolResult.substring(0, 8000) + "\n...[truncated]";
              }
              toolResults.push({
                role: "user",
                content: [{ type: "tool_result", tool_use_id: block.id, content: toolResult }],
              } as any);
            }
          }

          if (!hasToolUse || response.stop_reason === "end_turn") {
            const sess = getOrCreateSession(robotId || "robot-2");
            const pendingStage = hasPendingMandatoryAction(sess);
            if (!hasToolUse && pendingStage && maxIterations > 0) {
              console.log(`[Claude] RETRY: Claude stopped without tool call but ${pendingStage} push is mandatory. Forcing retry.`);
              messages = [
                ...messages,
                { role: "assistant", content: response.content },
                {
                  role: "user",
                  content: `SYSTEM OVERRIDE: You responded with text only but did NOT call create_or_update_file. This is WRONG. You MUST call create_or_update_file to push ${pendingStage}.workflow.json NOW. Generate the ${pendingStage} workflow JSON content and push it.`,
                },
              ];
              continue;
            }
            break;
          }

          messages = [
            ...messages,
            { role: "assistant", content: response.content },
            ...toolResults,
          ];
        }

        res.write(`data: [DONE]\n\n`);
        res.end();
      } else {
        const { client: modelClient, modelId, provider } = createModelClient(modelConfig);
        const isGPT = provider === "OpenAI";
        // ZhipuAI GLM-4+ supports function calling
        const isZhipuAI = provider === "ZhipuAI";
        const useTools = isGPT || isZhipuAI;

        console.log(`[${provider}] Using model: ${modelId}, tools: ${useTools}, apiKey: ${modelConfig?.apiKey ? "vault" : "env"}`);

        // OpenRouter/ZhipuAI: trim history to last 8 messages to save input tokens
        const trimmedHistory = (provider === "OpenRouter" || provider === "ZhipuAI")
          ? chatHistory.slice(-8)
          : chatHistory;

        let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
          ...trimmedHistory.map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          })),
        ];
        if (!messages.some(m => m.role === "user") || chatHistory.length === 0) {
          messages.push({ role: "user", content: message });
        }

        let maxIterations = useTools ? 12 : 1;
        while (maxIterations-- > 0) {
          console.log(`[${provider}] Iteration ${(useTools ? 12 : 1) - maxIterations}, messages: ${messages.length}`);
          let response;
          try {
            // OpenRouter: cap at 4096 to avoid "requires more credits" 402 errors
            // ZhipuAI: 8192 (free models support up to 8k output)
            const maxTokens = provider === "ZhipuAI" ? 8192 : provider === "OpenRouter" ? 4096 : 16384;
            // Qwen3 models have thinking mode ON by default — disable to save output tokens
            const isQwen3 = modelId.toLowerCase().includes("qwen3");
            response = await (modelClient.chat.completions.create as any)({
              model: modelId,
              messages,
              ...(useTools ? { tools: openaiTools } : {}),
              max_tokens: maxTokens,
              ...(isQwen3 ? { enable_thinking: false } : {}),
            });
          } catch (gptError: any) {
            const errMsg = gptError.message || "";
            const errStatus = gptError.status || gptError.statusCode || "";
            console.error(`[${provider}] API error status=${errStatus}:`, errMsg);
            let userMsg: string;
            if (errMsg.includes("余额不足") || errMsg.includes("请充值") || errMsg.includes("资源包")) {
              userMsg = `\n⚠️ رصيد ZhipuAI غير كافٍ. يرجى شحن الحساب على open.bigmodel.cn أو استخدام نموذج مجاني (glm-4.7-flash أو glm-4.5-flash).`;
            } else if (errMsg.includes("429") || errMsg.includes("Rate limit") || errMsg.includes("tokens per min")) {
              userMsg = `\n⚠️ تجاوزت حد الطلبات. انتظر قليلاً وحاول مرة ثانية.`;
            } else if (errMsg.includes("401") || errMsg.includes("Incorrect API key") || errMsg.includes("invalid_api_key")) {
              userMsg = `\n⚠️ مفتاح API غير صحيح لـ ${provider}. تحقق من إعدادات ${provider}.`;
            } else {
              userMsg = `\n⚠️ [${provider}] ${errStatus ? "HTTP " + errStatus + ": " : ""}${errMsg.substring(0, 150)}`;
            }
            res.write(`data: ${JSON.stringify({ content: userMsg })}\n\n`);
            break;
          }

          const choice = response.choices[0];
          console.log(`[${provider}] finish_reason: ${choice.finish_reason}, has_content: ${!!choice.message.content}, tool_calls: ${choice.message.tool_calls?.length || 0}`);

          if (choice.finish_reason === "length") {
            console.log(`[${provider}] WARNING: Response was cut off due to token limit!`);
            if (choice.message.content) {
              res.write(`data: ${JSON.stringify({ content: choice.message.content })}\n\n`);
            }
            res.write(`data: ${JSON.stringify({ content: "\n⚠️ تم قطع الرد بسبب حد التوكنز. حاول مرة ثانية." })}\n\n`);
            break;
          }

          if (choice.message.content) {
            res.write(`data: ${JSON.stringify({ content: choice.message.content })}\n\n`);
          }

          if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
            messages.push(choice.message);

            const toolSummaries: string[] = [];
            for (const toolCall of choice.message.tool_calls) {
              const tc = toolCall as any;
              const args = JSON.parse(tc.function.arguments);
              console.log(`[${provider}] Tool call: ${tc.function.name}, args keys: ${Object.keys(args).join(',')}`);
              res.write(`data: ${JSON.stringify({ content: `\n⚙️ جاري تنفيذ ${tc.function.name}...\n` })}\n\n`);
              let toolResult = await executeToolCall(tc.function.name, args, robotId || "robot-1", roomId);
              // ZhipuAI free tier has small context — truncate aggressively
              const maxToolResult = isZhipuAI ? 2500 : 8000;
              if (toolResult.length > maxToolResult) {
                console.log(`[${provider}] Tool result truncated from ${toolResult.length} to ${maxToolResult} chars`);
                toolResult = toolResult.substring(0, maxToolResult) + "\n...[truncated]";
              }
              const resultPreview = toolResult.substring(0, 200);
              console.log(`[${provider}] Tool result preview: ${resultPreview}`);
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: toolResult,
              });
              if (tc.function.name === "create_or_update_file" && args.path) {
                try {
                  const parsed = JSON.parse(toolResult);
                  if (parsed.success) {
                    if (args.path.includes(".workflow.json") && args.content) {
                      try {
                        const wf = JSON.parse(args.content);
                        const emptyFields: string[] = [];
                        if (wf.nodes) {
                          for (const node of wf.nodes) {
                            if (node.data && node.type !== "group") {
                              if (node.data.description !== undefined && (!node.data.description || node.data.description.trim() === "")) {
                                emptyFields.push(`${node.type}.description`);
                              }
                              if (node.data.aiResponsibilities !== undefined && Array.isArray(node.data.aiResponsibilities) && node.data.aiResponsibilities.length === 0) {
                                emptyFields.push(`${node.type}.aiResponsibilities`);
                              }
                              if (node.data.humanResponsibilities !== undefined && Array.isArray(node.data.humanResponsibilities) && node.data.humanResponsibilities.length === 0) {
                                emptyFields.push(`${node.type}.humanResponsibilities`);
                              }
                              if (node.data.gateChecklist !== undefined && Array.isArray(node.data.gateChecklist) && node.data.gateChecklist.length === 0) {
                                emptyFields.push(`${node.type}.gateChecklist`);
                              }
                            }
                          }
                        }
                        if (emptyFields.length > 0) {
                          console.log(`[${provider}] WARNING: Pushed workflow ${args.path} has ${emptyFields.length} empty fields: ${emptyFields.join(", ")}`);
                          toolResult += `\n\n⚠️ VALIDATION WARNING: The following fields were pushed EMPTY: ${emptyFields.join(", ")}. Next time, ensure ALL fields are filled with Arabic content derived from the analysis.`;
                        }
                      } catch (e) {
                        // ignore parse errors
                      }
                    }
                    toolSummaries.push(`[تم رفع: ${args.path} ✅]`);
                    const sid = robotId || "robot-1";
                    const sess = getOrCreateSession(sid);
                    sess.pushedFiles.push(args.path);
                    if (args.path.includes("S0.workflow")) sess.stageStatus.S0 = "pushed";
                    if (args.path.includes("S1.workflow")) sess.stageStatus.S1 = "pushed";
                    if (args.path.includes("S2.workflow")) sess.stageStatus.S2 = "pushed";
                    if (args.path.includes("analysis.json")) sess.inputReceived = true;
                  }
                } catch {}
              }
            }
            if (toolSummaries.length > 0) {
              res.write(`data: ${JSON.stringify({ content: "\n" + toolSummaries.join("\n") + "\n" })}\n\n`);
            }
          } else {
            const sid = robotId || "robot-1";
            const sess = getOrCreateSession(sid);
            const pendingStage = useTools ? hasPendingMandatoryAction(sess) : null;
            if (pendingStage && maxIterations > 0) {
              console.log(`[${provider}] RETRY: stopped without tool call but ${pendingStage} push is mandatory. Forcing retry.`);
              messages.push(choice.message);
              messages.push({
                role: "user",
                content: `SYSTEM OVERRIDE: You responded with text only but did NOT call create_or_update_file. This is WRONG. You MUST call create_or_update_file to push ${pendingStage}.workflow.json NOW. Generate the ${pendingStage} workflow JSON content and push it. Do NOT respond with text only.`,
              });
            } else {
              break;
            }
          }
        }

        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    } catch (error: any) {
      console.error("Chat API error:", error.message);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Failed to get response" });
      }
      res.end();
    }
  });

  app.get("/api/clickup/teams", async (_req, res) => {
    try {
      const teams = await getTeams();
      res.json(teams);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/github/repos", async (_req, res) => {
    try {
      const repos = await getRepos();
res.json(repos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/broadcast", async (req, res) => {
    try {
      const { message, workerIds } = req.body;
      const roomId = getRoomId(req);

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!Array.isArray(workerIds) || workerIds.length === 0) {
        return res.status(400).json({ error: "workerIds array is required" });
      }

      const [models, hallWorkers, defaultModelName] = await Promise.all([
        getModels(roomId),
        getHallWorkers(roomId),
        getDefaultModel(roomId)
      ]);
      const allModels = [...models, ...hallWorkers];
      
      console.log("=== BROADCAST DEBUG START ===");
      console.log("workerIds count:", workerIds.length);
      console.log("workerIds:", workerIds);
      console.log("allModels count:", allModels.length);
      console.log("allModels:", allModels.map(m => ({
        id: m.id,
        name: m.name,
        hasKey: !!m.apiKey
      })));

      for (const workerId of workerIds) {
        const model = allModels.find(m => m.id === workerId);
        console.log("match check:", {
          workerId,
          matched: !!model,
          modelName: model?.name,
          hasKey: !!model?.apiKey
        });
      }
      console.log("=== BROADCAST DEBUG END ===");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const withTimeout = (promise: Promise<any>, ms = 15000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout after " + ms + "ms")), ms)
          )
        ]);
      };

      const promises = workerIds.map(async (workerId: string) => {
        let modelConfig = allModels.find(m => m.id === workerId) 
          || allModels.find(m => m.name.toLowerCase() === defaultModelName.toLowerCase()) 
          || allModels[0];
        
        console.log("[Broadcast] workerId:", workerId, "found config:", modelConfig);
        
        if (!modelConfig) {
          console.error(`No model found for workerId=${workerId}`);
          return { workerId, content: "لا يوجد موديل مُعدّ" };
        }
        
        try {
          const { client, modelId } = createModelClient(modelConfig);
          const systemPrompt = modelConfig?.systemPrompt || "You are Sillar AI assistant.";

          console.log(`[Broadcast] Calling model ${modelId} for ${workerId}...`);
          const stream = await withTimeout(
            client.chat.completions.create({
              model: modelId,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message },
              ],
              stream: true,
            }),
            25000
          ) as AsyncIterable<any>;

          let fullContent = "";
          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              res.write(`data: ${JSON.stringify({ robotId: workerId, content })}\n\n`);
            }
          }

          if (!fullContent) {
            res.write(`data: ${JSON.stringify({ robotId: workerId, content: "لم يُرد" })}\n\n`);
          }
        } catch (err: any) {
          console.error(`[Broadcast] catch for ${workerId}:`, err.message);
          res.write(`data: ${JSON.stringify({ robotId: workerId, content: `خطأ: ${err.message}` })}\n\n`);
        }
      });

            try {
        await Promise.all(promises);
        res.write(`data: [DONE]\n\n`);
        res.end();
      } catch (err: any) {
        console.error("[Broadcast] Promise Error:", err);
        try {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        } catch (e) {}
      }
    } catch (err: any) {
      console.error("[Broadcast] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs", async (_req, res) => {
    try {
      const allJobs = getJobs();
      res.json(allJobs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/jobs/completed", async (_req, res) => {
    try {
      clearCompletedJobs();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/session/clear", async (req, res) => {
    try {
      const { robotId } = req.body;
      const roomId = getRoomId(req);
      const prefix = `${roomId}:`;
      
      if (robotId) {
        delete robotSessions[getSessionKey(robotId, roomId)];
        console.log(`[Session] Cleared session for ${robotId} in room ${roomId}`);
      } else {
        for (const key of Object.keys(robotSessions)) {
          if (key.startsWith(prefix)) {
            delete robotSessions[key];
          }
        }
        console.log(`[Session] Cleared all sessions in room ${roomId}`);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auto-trigger/start", async (req, res) => {
    try {
      const { userId, intervalMinutes, robotId, watchStatuses, doneStatus } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      startAutoTrigger(userId, intervalMinutes, robotId, watchStatuses, doneStatus);
      res.json({ success: true, config: getAutoTriggerConfig() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auto-trigger/stop", async (_req, res) => {
    try {
      stopAutoTrigger();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auto-trigger/config", async (_req, res) => {
    try {
      res.json(getAutoTriggerConfig());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auto-trigger/logs", async (_req, res) => {
    try {
      res.json(getTriggerLogs());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auto-trigger/scan", async (_req, res) => {
    try {
      const result = triggerScanNow();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auto-trigger/clear-cache", async (_req, res) => {
    try {
      clearProcessedTasks();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── رابط المشاركة (Guest Link) ───────────────────────────────────────────────
  app.post("/api/share-link/generate", async (req, res) => {
    try {
      const roomId = getRoomId(req);
      if (!roomId || roomId === "default") {
        return res.status(400).json({ error: "No room found" });
      }
      const token = jwt.sign({ roomId, isGuest: true }, jwtSecret, { expiresIn: "30d" });
      res.json({ success: true, token });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/share-link/verify", async (req, res) => {
    try {
      const { token } = req.query as { token?: string };
      if (!token) return res.status(400).json({ error: "No token" });
      const payload = jwt.verify(token, jwtSecret) as { roomId: string; isGuest: boolean };
      if (!payload.isGuest) return res.status(403).json({ error: "Not a guest token" });
      res.json({ valid: true, roomId: payload.roomId });
    } catch {
      res.status(401).json({ valid: false, error: "Invalid or expired token" });
    }
  });

  app.get("/api/vault-settings", async (req, res) => {
    const roomId = getRoomId(req);
    const settings = await getVaultSettings(roomId);
    res.json({
      company: {
        name: settings.company?.name || "",
        logo: settings.company?.logo || "",
      },
      github: {
        token: settings.github.token ? "••••••••" : "",
        owner: settings.github.owner,
        repo: settings.github.repo,
      },
      doors: {
        mainCode: settings.doors?.mainCode || "1977",
        managerCode: settings.doors?.managerCode || "0000",
      },
      clickup: {
        token: settings.clickup.token ? "••••••••" : "",
        listId: settings.clickup.listId,
        assignee: settings.clickup.assignee,
      },
      models: settings.models.map(m => ({
        id: m.id,
        name: m.name,
        alias: m.alias || "",
        apiKey: m.apiKey ? "••••••••" : "",
        ...(m.modelId ? { modelId: m.modelId } : {}),
        ...(m.systemPrompt !== undefined ? { systemPrompt: m.systemPrompt } : {}),
        roomAssignment: m.roomAssignment || "main",
      })),
      hallWorkers: settings.hallWorkers.map(m => ({
        id: m.id,
        name: m.name,
        alias: m.alias || "",
        apiKey: m.apiKey ? "••••••••" : "",
        ...(m.modelId ? { modelId: m.modelId } : {}),
        ...(m.systemPrompt !== undefined ? { systemPrompt: m.systemPrompt } : {}),
      })),
      systemPrompt: settings.systemPrompt || "",
    });
  });

  app.get("/api/models", async (req, res) => {
    const roomId = getRoomId(req);
    const settings = await getVaultSettings(roomId);
    res.json(settings.models.map((m, i) => ({
      id: m.id,
      name: m.name,
      alias: m.alias || "",
      index: i,
      ...(m.modelId ? { modelId: m.modelId } : {}),
      roomAssignment: m.roomAssignment || "main",
    })));
  });

  app.get("/api/hall-workers", async (req, res) => {
    const roomId = getRoomId(req);
    const settings = await getVaultSettings(roomId);
    res.json(settings.hallWorkers.map((m, i) => ({
      id: m.id,
      name: m.name,
      alias: m.alias || "",
      index: i,
      ...(m.modelId ? { modelId: m.modelId } : {}),
    })));
  });

  app.get("/api/door-codes", async (req, res) => {
    const roomId = getRoomId(req);
    const settings = await getVaultSettings(roomId);
    // managerCode لا يُرسَل للكلاينت - يُتحقق منه سيرفر-سايد فقط
    res.json({
      mainCode: settings.doors?.mainCode || "1977",
    });
  });

  app.post("/api/auth/verify-stage-code", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ success: false, error: "Code required" });
      }
      const roomId = getRoomId(req);
      const settings = await getVaultSettings(roomId);
      const stageCode = (settings.doors as any).stageCode || "0000";
      res.json({ success: stageCode === code });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/auth/verify-manager-code", async (req, res) => {
    try {
      const { code } = req.body;
      const roomId = getRoomId(req);

      if (!code || typeof code !== "string") {
        return res.status(400).json({ success: false, error: "Code required" });
      }

      const user = await storage.getUserByRoomId(roomId);
      if (!user) {
        return res.status(404).json({ success: false, error: "Room not found" });
      }

      const managerCode = await getManagerDoorCode(roomId);
      const isValid = managerCode === code;
      res.json({ success: isValid });
    } catch (e: any) {
      console.error("[Auth] Verify manager code error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/vault-settings", async (req, res) => {
    const roomId = getRoomId(req);
    const { company, doors, github, clickup, models, hallWorkers, systemPrompt } = req.body;
    if (!github && !clickup && !models && !hallWorkers && !company && !doors && systemPrompt === undefined) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const current = await getVaultSettings(roomId);
    const updatePayload: any = {};
    if (company) {
      updatePayload.company = {
        name: company.name || "",
        logo: company.logo || current.company?.logo || "",
      };
    }
    if (doors) {
      updatePayload.doors = {
        mainCode: doors.mainCode || current.doors?.mainCode || "1977",
        managerCode: doors.managerCode || current.doors?.managerCode || "0000",
      };
    }
    if (github) {
      updatePayload.github = {
        token: github.token === "••••••••" ? current.github.token : (github.token || ""),
        owner: github.owner || "",
        repo: github.repo || "",
      };
    }
    if (clickup) {
      updatePayload.clickup = {
        token: clickup.token === "••••••••" ? current.clickup.token : (clickup.token || ""),
        listId: clickup.listId || "",
        assignee: clickup.assignee || "",
      };
    }
    if (models && Array.isArray(models)) {
      const MAX_MODELS = 7;
      const limitedModels = models.slice(0, MAX_MODELS);
      updatePayload.models = limitedModels.map((m: any) => {
        const existingModel = m.id ? current.models.find((cm: any) => cm.id === m.id) : null;
        return {
          id: m.id || "",
          name: m.name || "",
          alias: m.alias || "",
          apiKey: m.apiKey === "••••••••" ? (existingModel?.apiKey || "") : (m.apiKey || ""),
          ...(m.modelId ? { modelId: m.modelId } : (existingModel?.modelId ? { modelId: existingModel.modelId } : {})),
          ...(m.systemPrompt !== undefined ? { systemPrompt: m.systemPrompt } : (existingModel?.systemPrompt ? { systemPrompt: existingModel.systemPrompt } : {})),
          roomAssignment: m.roomAssignment || existingModel?.roomAssignment || "main",
        };
      });
    }
    if (hallWorkers && Array.isArray(hallWorkers)) {
      const MAX_HALL_WORKERS = 7;
      updatePayload.hallWorkers = hallWorkers.slice(0, MAX_HALL_WORKERS).map((m: any) => {
        const existing = m.id ? current.hallWorkers?.find((cw: any) => cw.id === m.id) : null;
        return {
          id: m.id || "",
          name: m.name || "",
          alias: m.alias || "",
          apiKey: m.apiKey === "••••••••" ? (existing?.apiKey || "") : (m.apiKey || ""),
          ...(m.modelId ? { modelId: m.modelId } : (existing?.modelId ? { modelId: existing.modelId } : {})),
          ...(m.systemPrompt !== undefined ? { systemPrompt: m.systemPrompt } : (existing?.systemPrompt ? { systemPrompt: existing.systemPrompt } : {})),
        };
      });
    }
    if (systemPrompt !== undefined) {
      updatePayload.systemPrompt = typeof systemPrompt === "string" ? systemPrompt : "";
    }
    await setVaultSettings(updatePayload, roomId);
    res.json({ success: true });
  });

  app.post("/api/vault-settings/test", async (req, res) => {
    const roomId = getRoomId(req);
    const results: any = { github: { connected: false }, clickup: { connected: false } };

    try {
      const user = await getAuthenticatedUser(roomId);
      results.github = { connected: true, user };
    } catch (err: any) {
      results.github = { connected: false, error: err.message };
    }

    try {
      const teams = await getTeams(roomId);
      results.clickup = { connected: true, workspace: teams[0]?.name || "Unknown" };
    } catch (err: any) {
      console.error(`[ClickUp Test] roomId=${roomId} error:`, err.message);
      results.clickup = { connected: false, error: err.message };
    }

    res.json(results);
  });

  // ══════════════════════════════════════════════════
  //  ADMIN STATS — كم يوزر دخل وكم موديل لكل يوزر
  // ══════════════════════════════════════════════════
  app.get("/api/admin/stats", async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const vaults = await Promise.all(allUsers.map((u) => getVaultSettings(u.roomId)));
      const stats = allUsers.map((u, idx) => {
        const vault = vaults[idx];
        return {
          id: u.id,
          username: u.username,
          roomId: u.roomId,
          companyName: vault.company?.name || "",
          modelCount: vault.models?.length || 0,
          models: vault.models?.map(m => ({
            name: m.name,
            hasKey: !!m.apiKey,
            modelId: m.modelId || null,
          })) || [],
          defaultModel: vault.defaultModel || "",
          hasSystemPrompt: !!(vault.systemPrompt && vault.systemPrompt.trim().length > 0),
          hasGitHub: !!vault.github?.token,
          hasClickUp: !!vault.clickup?.token,
        };
      });
      res.json({
        totalUsers: allUsers.length,
        totalModels: stats.reduce((sum, u) => sum + u.modelCount, 0),
        users: stats,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ══════════════════════════════════════════════════
  //  PUBLIC STATS — للـ hologram في اللعبة
  // ══════════════════════════════════════════════════
  app.get("/api/stats", async (req, res) => {
    try {
      const roomId = getRoomId(req);

      // عدد المستخدمين والمودل
      const allUsers = await storage.getAllUsers();
      const userCount = allUsers.length;
      const allVaults = await Promise.all(allUsers.map((u) => getVaultSettings(u.roomId)));
      const modelCount = allVaults.reduce((sum, v) => sum + (v.models?.length || 0), 0);

      // جزء من التعليمات
      const systemPrompt = await getSystemPrompt(roomId);
      const instructionExcerpt = systemPrompt
        ? systemPrompt.replace(/\s+/g, " ").trim().slice(0, 120)
        : "";

      // موديلات OpenRouter
      let openrouterFreeCount = 0;
      let openrouterPaidCount = 0;
      try {
        const orRes = await fetch("https://openrouter.ai/api/v1/models");
        const orData = await orRes.json() as { data: Array<{ id: string; pricing?: { prompt?: string } }> };
        const models = orData.data || [];
        for (const m of models) {
          const isFree = m.id.endsWith(":free") ||
            (m.pricing?.prompt === "0" || m.pricing?.prompt === "0.0" || m.pricing?.prompt === "0.00");
          if (isFree) openrouterFreeCount++;
          else openrouterPaidCount++;
        }
      } catch {
        // إذا فشل الاتصال، نرجع أصفار
      }

      res.json({ userCount, modelCount, instructionExcerpt, openrouterFreeCount, openrouterPaidCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/default-model", async (req, res) => {
    const roomId = getRoomId(req);
    const { modelName } = req.body;
    if (!modelName) {
      return res.status(400).json({ error: "modelName required" });
    }
    await setDefaultModel(modelName, roomId);
    console.log(`[DefaultModel] Set to ${modelName} for room ${roomId}`);
    res.json({ success: true, defaultModel: modelName });
  });

  app.get("/api/default-model", async (req, res) => {
    const roomId = getRoomId(req);
    const defaultModel = await getDefaultModel(roomId);
    res.json({ defaultModel });
  });

  // ── OpenRouter: fetch available models ──────────────────────────────
  app.get("/api/openrouter/models", async (req, res) => {
    const apiKey = (req.query.key as string) || "";
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      const r = await fetch("https://openrouter.ai/api/v1/models", { headers });
      const data = await r.json() as { data?: any[] };
      const models = (data.data || []).map((m: any) => ({
        id: m.id as string,
        name: (m.name || m.id) as string,
        isFree:
          (m.id as string).endsWith(":free") ||
          (m.pricing?.prompt === "0" && m.pricing?.completion === "0"),
      }));
      res.json({ models });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/clickup/members", async (_req, res) => {
    try {
      const members = await getWorkspaceMembers();
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Playlist ─────────────────────────────────────────────────────────────
  app.get("/api/playlist", async (req, res) => {
    try {
      const roomId = getRoomId(req);
      const items = await storage.getRoomPlaylist(roomId);
      res.json(items.map((item) => ({ videoId: item.videoId, label: item.label })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/playlist", async (req, res) => {
    try {
      const roomId = getRoomId(req);
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items array required" });
      }
      const clean = items
        .filter((i: any) => i.videoId && typeof i.videoId === "string")
        .map((i: any) => ({ videoId: i.videoId, label: i.label || "" }));
      await storage.setRoomPlaylist(roomId, clean);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
