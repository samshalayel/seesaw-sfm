# Sillar GPT Room - Key Files Export

---

## FILE 1: server/sfm_templates.json
```
```text
========================================
TEMPLATES (S0–S3) — DO NOT CHANGE
Paste these templates exactly. The ONLY allowed edits are the allowed fields you defined.
========================================

---------- TEMPLATE S0 ----------
{
  "nodes": [
    {
      "id": "GROUP_ID",
      "type": "group",
      "data": { "label": "S0" },
      "position": { "x": 150, "y": -705 },
      "width": 1697,
      "height": 1100,
      "style": { "width": 1697, "height": 1100, "zIndex": -1 }
    },
    {
      "id": "stage-0-1",
      "type": "stage-0",
      "data": {
        "group": "S0",
        "label": "Stage 0 — Problem / Technical Lock",
        "description": "",
        "aiPercentage": 20,
        "humanPercentage": 80,
        "aiResponsibilities": [],
        "humanResponsibilities": [],
        "stageNumber": 0,
        "restrictions": ["لا حلول تنفيذية","لا API","لا UI","لا DB Schema","لا Architecture Stack","لا CRUD","لا Code"],
        "customFields": {}
      },
      "position": { "x": 15, "y": 60 },
      "width": 300,
      "height": 208,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "insight-node-2",
      "type": "insight-node",
      "data": { "group": "S0", "label": "Insight", "description": "" },
      "position": { "x": 210, "y": 285 },
      "width": 300,
      "height": 297,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "outcome-node-3",
      "type": "outcome-node",
      "data": { "group": "S0", "label": "Outcome", "description": "" },
      "position": { "x": 570, "y": 90 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "direction-node-4",
      "type": "direction-node",
      "data": { "group": "S0", "label": "Direction", "description": "" },
      "position": { "x": 915, "y": 225 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "gate-problem-5",
      "type": "gate-problem",
      "data": {
        "group": "S0",
        "label": "S0 Blocking Gate",
        "description": "",
        "gateType": "problem",
        "decisionAuthority": "Human Only",
        "gateStatus": "pending",
        "aiPercentage": 0,
        "humanPercentage": 100,
        "gateChecklist": []
      },
      "position": { "x": 1095, "y": 540 },
      "width": 402,
      "height": 237,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "alignment-gate-6",
      "type": "alignment-gate",
      "data": { "group": "S0", "label": "Alignment Gate", "description": "Non-blocking: مراجعة سريعة لتأكيد أن الأطراف تفهم نفس تعريف المشكلة قبل التقدم." },
      "position": { "x": 1395, "y": 795 },
      "width": 280,
      "height": 298,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "evidence-node-7",
      "type": "evidence-node",
      "data": {
        "group": "S0",
        "label": "Evidence",
        "mandatory": true,
        "description": "",
        "evidenceKey": "s0_docs_pack",
        "justification": "",
        "owner": ""
      },
      "position": { "x": 1320, "y": 75 },
      "width": 320,
      "height": 290,
      "parentId": "GROUP_ID",
      "extent": "parent"
    }
  ],
  "edges": [
    { "id": "e-s0-insight", "type": "custom", "source": "stage-0-1", "target": "insight-node-2" },
    { "id": "e-insight-outcome", "type": "custom", "source": "insight-node-2", "target": "outcome-node-3" },
    { "id": "e-outcome-direction", "type": "custom", "source": "outcome-node-3", "target": "direction-node-4" },
    { "id": "e-direction-gate", "type": "custom", "source": "direction-node-4", "target": "gate-problem-5" },
    { "id": "e-gate-alignment", "type": "custom", "source": "gate-problem-5", "target": "alignment-gate-6" },
    { "id": "e-evidence-gate", "type": "custom", "source": "evidence-node-7", "target": "gate-problem-5", "label": "evidence" }
  ],
  "evidence": [],
  "exportedAt": ""
}

---------- TEMPLATE S1 ----------
{
  "nodes": [
    {
      "id": "GROUP_ID",
      "type": "group",
      "data": { "label": "S1" },
      "position": { "x": 150, "y": -705 },
      "width": 1697,
      "height": 1100,
      "style": { "width": 1697, "height": 1100, "zIndex": -1 }
    },
    {
      "id": "stage-1-1",
      "type": "stage-1",
      "data": {
        "group": "S1",
        "label": "Stage 1 — Product Shape",
        "description": "",
        "aiPercentage": 20,
        "humanPercentage": 80,
        "aiResponsibilities": [],
        "humanResponsibilities": [],
        "stageNumber": 1,
        "customFields": {}
      },
      "position": { "x": 15, "y": 60 },
      "width": 300,
      "height": 208,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "insight-node-2",
      "type": "insight-node",
      "data": { "group": "S1", "label": "Insight", "description": "" },
      "position": { "x": 210, "y": 285 },
      "width": 300,
      "height": 297,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "outcome-node-3",
      "type": "outcome-node",
      "data": { "group": "S1", "label": "Outcome", "description": "" },
      "position": { "x": 570, "y": 90 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "direction-node-4",
      "type": "direction-node",
      "data": { "group": "S1", "label": "Direction", "description": "" },
      "position": { "x": 915, "y": 225 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "gate-problem-5",
      "type": "gate-problem",
      "data": {
        "group": "S1",
        "label": "S1 Blocking Gate",
        "description": "",
        "gateType": "product",
        "decisionAuthority": "Human Only",
        "gateStatus": "pending",
        "aiPercentage": 0,
        "humanPercentage": 100,
        "gateChecklist": []
      },
      "position": { "x": 1095, "y": 540 },
      "width": 402,
      "height": 237,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "alignment-gate-6",
      "type": "alignment-gate",
      "data": { "group": "S1", "label": "Alignment Gate", "description": "Non-blocking: مراجعة سريعة لتأكيد أن الأطراف متفقة على شكل المنتج (Actors/Flow/Rules) قبل التقدم." },
      "position": { "x": 1395, "y": 795 },
      "width": 280,
      "height": 298,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "evidence-node-7",
      "type": "evidence-node",
      "data": {
        "group": "S1",
        "label": "Evidence",
        "mandatory": true,
        "description": "",
        "evidenceKey": "s1_docs_pack",
        "justification": "",
        "owner": ""
      },
      "position": { "x": 1320, "y": 75 },
      "width": 320,
      "height": 290,
      "parentId": "GROUP_ID",
      "extent": "parent"
    }
  ],
  "edges": [
    { "id": "e-s1-insight", "type": "custom", "source": "stage-1-1", "target": "insight-node-2" },
    { "id": "e-insight-outcome", "type": "custom", "source": "insight-node-2", "target": "outcome-node-3" },
    { "id": "e-outcome-direction", "type": "custom", "source": "outcome-node-3", "target": "direction-node-4" },
    { "id": "e-direction-gate", "type": "custom", "source": "direction-node-4", "target": "gate-problem-5" },
    { "id": "e-gate-alignment", "type": "custom", "source": "gate-problem-5", "target": "alignment-gate-6" },
    { "id": "e-evidence-gate", "type": "custom", "source": "evidence-node-7", "target": "gate-problem-5", "label": "evidence" }
  ],
  "evidence": [],
  "exportedAt": ""
}

---------- TEMPLATE S2 ----------
{
  "nodes": [
    {
      "id": "GROUP_ID",
      "type": "group",
      "data": { "label": "S2" },
      "position": { "x": 150, "y": -705 },
      "width": 1697,
      "height": 1100,
      "style": { "width": 1697, "height": 1100, "zIndex": -1 }
    },
    {
      "id": "stage-2-1",
      "type": "stage-2",
      "data": {
        "group": "S2",
        "label": "Stage 2 — Conceptual Architecture Spine",
        "description": "",
        "aiPercentage": 25,
        "humanPercentage": 75,
        "aiResponsibilities": [],
        "humanResponsibilities": [],
        "stageNumber": 2,
        "customFields": {}
      },
      "position": { "x": 15, "y": 60 },
      "width": 300,
      "height": 208,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "insight-node-2",
      "type": "insight-node",
      "data": { "group": "S2", "label": "Insight", "description": "" },
      "position": { "x": 210, "y": 285 },
      "width": 300,
      "height": 297,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "outcome-node-3",
      "type": "outcome-node",
      "data": { "group": "S2", "label": "Outcome", "description": "" },
      "position": { "x": 570, "y": 90 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "direction-node-4",
      "type": "direction-node",
      "data": { "group": "S2", "label": "Direction", "description": "" },
      "position": { "x": 915, "y": 225 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "gate-problem-5",
      "type": "gate-problem",
      "data": {
        "group": "S2",
        "label": "S2 Blocking Gate",
        "description": "",
        "gateType": "architecture",
        "decisionAuthority": "Human Only",
        "gateStatus": "pending",
        "aiPercentage": 0,
        "humanPercentage": 100,
        "gateChecklist": []
      },
      "position": { "x": 1095, "y": 540 },
      "width": 402,
      "height": 237,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "alignment-gate-6",
      "type": "alignment-gate",
      "data": { "group": "S2", "label": "Alignment Gate", "description": "Non-blocking: مراجعة سريعة للتأكد أن العمود الفقري المفاهيمي لا يتجاوز النطاق ولا يقفز للتقنيات." },
      "position": { "x": 1395, "y": 795 },
      "width": 280,
      "height": 298,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "evidence-node-7",
      "type": "evidence-node",
      "data": {
        "group": "S2",
        "label": "Evidence",
        "mandatory": true,
        "description": "",
        "evidenceKey": "s2_docs_pack",
        "justification": "",
        "owner": ""
      },
      "position": { "x": 1320, "y": 75 },
      "width": 320,
      "height": 290,
      "parentId": "GROUP_ID",
      "extent": "parent"
    }
  ],
  "edges": [
    { "id": "e-s2-insight", "type": "custom", "source": "stage-2-1", "target": "insight-node-2" },
    { "id": "e-insight-outcome", "type": "custom", "source": "insight-node-2", "target": "outcome-node-3" },
    { "id": "e-outcome-direction", "type": "custom", "source": "outcome-node-3", "target": "direction-node-4" },
    { "id": "e-direction-gate", "type": "custom", "source": "direction-node-4", "target": "gate-problem-5" },
    { "id": "e-gate-alignment", "type": "custom", "source": "gate-problem-5", "target": "alignment-gate-6" },
    { "id": "e-evidence-gate", "type": "custom", "source": "evidence-node-7", "target": "gate-problem-5", "label": "evidence" }
  ],
  "evidence": [],
  "exportedAt": ""
}

---------- TEMPLATE S3 ----------
{
  "nodes": [
    {
      "id": "GROUP_ID",
      "type": "group",
      "data": { "label": "S3" },
      "position": { "x": 150, "y": -705 },
      "width": 1697,
      "height": 1100,
      "style": { "width": 1697, "height": 1100, "zIndex": -1 }
    },
    {
      "id": "stage-3-1",
      "type": "stage-3",
      "data": {
        "group": "S3",
        "label": "Stage 3 — Production Slice",
        "description": "",
        "aiPercentage": 30,
        "humanPercentage": 70,
        "aiResponsibilities": [],
        "humanResponsibilities": [],
        "stageNumber": 3,
        "customFields": {}
      },
      "position": { "x": 15, "y": 60 },
      "width": 300,
      "height": 208,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "insight-node-2",
      "type": "insight-node",
      "data": { "group": "S3", "label": "Insight", "description": "" },
      "position": { "x": 210, "y": 285 },
      "width": 300,
      "height": 297,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "outcome-node-3",
      "type": "outcome-node",
      "data": { "group": "S3", "label": "Outcome", "description": "" },
      "position": { "x": 570, "y": 90 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "direction-node-4",
      "type": "direction-node",
      "data": { "group": "S3", "label": "Direction", "description": "" },
      "position": { "x": 915, "y": 225 },
      "width": 300,
      "height": 299,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "gate-problem-5",
      "type": "gate-problem",
      "data": {
        "group": "S3",
        "label": "S3 Blocking Gate",
        "description": "",
        "gateType": "slice",
        "decisionAuthority": "Human Only",
        "gateStatus": "pending",
        "aiPercentage": 0,
        "humanPercentage": 100,
        "gateChecklist": []
      },
      "position": { "x": 1095, "y": 540 },
      "width": 402,
      "height": 237,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "alignment-gate-6",
      "type": "alignment-gate",
      "data": { "group": "S3", "label": "Alignment Gate", "description": "Non-blocking: مراجعة سريعة للتأكد أن الـ Slice واحد ومحدد وغير متشعب." },
      "position": { "x": 1395, "y": 795 },
      "width": 280,
      "height": 298,
      "parentId": "GROUP_ID",
      "extent": "parent"
    },
    {
      "id": "evidence-node-7",
      "type": "evidence-node",
      "data": {
        "group": "S3",
        "label": "Evidence",
        "mandatory": true,
        "description": "",
        "evidenceKey": "s3_docs_pack",
        "justification": "",
        "owner": ""
      },
      "position": { "x": 1320, "y": 75 },
      "width": 320,
      "height": 290,
      "parentId": "GROUP_ID",
      "extent": "parent"
    }
  ],
  "edges": [
    { "id": "e-s3-insight", "type": "custom", "source": "stage-3-1", "target": "insight-node-2" },
    { "id": "e-insight-outcome", "type": "custom", "source": "insight-node-2", "target": "outcome-node-3" },
    { "id": "e-outcome-direction", "type": "custom", "source": "outcome-node-3", "target": "direction-node-4" },
    { "id": "e-direction-gate", "type": "custom", "source": "direction-node-4", "target": "gate-problem-5" },
    { "id": "e-gate-alignment", "type": "custom", "source": "gate-problem-5", "target": "alignment-gate-6" },
    { "id": "e-evidence-gate", "type": "custom", "source": "evidence-node-7", "target": "gate-problem-5", "label": "evidence" }
  ],
  "evidence": [],
  "exportedAt": ""
}
```
```

---

## FILE 2: server/routes.ts (Main Server - Chat + Generate + GitHub Upload)
```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
import { startAutoTrigger, stopAutoTrigger, getAutoTriggerConfig, getTriggerLogs, clearProcessedTasks, triggerScanNow } from "./autoTrigger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

async function executeToolCall(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "get_clickup_tasks":
        return await getClickUpSummary();
      case "get_workspace_structure":
        return await getFullWorkspaceStructure();
      case "get_workspace_members":
        return JSON.stringify(await getWorkspaceMembers(), null, 2);
      case "search_clickup_tasks":
        return JSON.stringify(await searchTasksByName(args.query), null, 2);
      case "get_task_details":
        return JSON.stringify(await getTask(args.task_id), null, 2);
      case "update_clickup_task": {
        const result = await updateTask(args.task_id, {
          name: args.name,
          description: args.description,
          status: args.status,
          priority: args.priority,
          assignees_add: args.assignees_add,
          assignees_rem: args.assignees_rem,
        });
        return JSON.stringify(result, null, 2);
      }
      case "create_clickup_task": {
        const result = await createTask(args.list_id, {
          name: args.name,
          description: args.description,
          status: args.status,
          priority: args.priority,
          assignees: args.assignees,
        });
        return JSON.stringify(result, null, 2);
      }
      case "get_github_repos":
        return JSON.stringify(await getRepos(), null, 2);
      case "get_repo_contents":
        return JSON.stringify(await getRepoContents(args.owner, args.repo, args.path || ""), null, 2);
      case "create_or_update_file": {
        const result = await createOrUpdateFile(args.owner, args.repo, args.path, args.content, args.commit_message);
        return JSON.stringify(result, null, 2);
      }
      case "get_commit_checks":
        return JSON.stringify(await getCommitChecks(args.owner, args.repo, args.ref), null, 2);
      case "get_workflow_runs":
        return JSON.stringify(await getWorkflowRuns(args.owner, args.repo), null, 2);
      case "get_workflow_run_logs":
        return JSON.stringify(await getWorkflowRunLogs(args.owner, args.repo, args.run_id), null, 2);
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

const BASE_SYSTEM_PROMPT = `Your name is sillar-model. You are a senior software developer at Sillar Digital Production.
You have access to the team's ClickUp workspace and GitHub repositories through tools.

IMPORTANT INSTRUCTIONS - ALWAYS FOLLOW THESE:
1. You MUST remember the full conversation history. When the user refers to something said earlier, use the conversation context.
2. Always answer in the same language the user uses (Arabic or English).
3. Be helpful, concise, and professional.

CLICKUP CAPABILITIES:
- get_clickup_tasks: Fetch ALL tasks with their statuses, assignees, folders, lists, spaces, and due dates.
- get_workspace_structure: Get the full workspace structure (spaces → folders → lists) with IDs. Use before creating tasks to find the right list ID.
- get_workspace_members: Get all team members with their user IDs, usernames, and emails. Use before assigning tasks.
- search_clickup_tasks: Search tasks by name. Returns matching tasks with folder/list/space info.
- get_task_details: Get full details of a specific task by ID.
- update_clickup_task: Update a task's name, description, status, priority, or assignees. You need the task ID and optionally user IDs for assignee changes.
- create_clickup_task: Create a new task in a specific list. You need the list ID (get it from get_workspace_structure).

CLICKUP WORKFLOW:
- When user asks to update a task: First search for it (search_clickup_tasks), then update it (update_clickup_task).
- When user asks to assign someone: First get members (get_workspace_members) to find the user ID, then update the task.
- When user asks to create a task: First get workspace structure to find the correct list ID, then create it.
- If you can't find a task, folder, or person, ASK the user for clarification. List what you found and ask which one they mean.
- When showing tasks, always include: task name, status, folder/project, assignee, and due date.

GITHUB CAPABILITIES:
- get_github_repos: List all repositories.
- get_repo_contents: Browse files in a repo.
- create_or_update_file: Create or update files with commits.
- get_commit_checks: Check CI/CD status (GitHub Actions) for a specific commit. Use this when user asks about red X, failed checks, or CI status.
- get_workflow_runs: List recent GitHub Actions workflow runs for a repo.
- get_workflow_run_logs: Get detailed step-by-step logs for a specific workflow run to see exactly what failed.
- The GitHub username is obtained automatically.
- When the user asks to create/edit files on GitHub, DO IT immediately. Never say you can't.
- When the user asks about failed checks or red X on GitHub, use get_commit_checks and get_workflow_runs to investigate.

SEESAW GENERATOR (SFM Template Engine):
You also act as the SFM Template Engine. When the user asks for S0, S1, S2, S3, or ALL/بلش, you MUST:
1. Output ONLY valid JSON — no explanations, no markdown, no extra text.
2. Use the predefined stage templates from the KNOWLEDGE section below.
3. Do NOT invent structure — copy the template exactly.
4. Fill ONLY the allowed content fields based on conversation context:
   - "description" fields (in stage nodes, insight, outcome, direction, gates, evidence)
   - "aiResponsibilities" array
   - "humanResponsibilities" array
   - "gateChecklist" array
   - "justification" and "owner" in evidence nodes
5. Replace every GROUP_ID with: group-s{stage}-{timestamp}-{rand4}
   - timestamp: 13-digit unix milliseconds (use current time)
   - rand4: 4 random lowercase letters
   - ParentId must match the GROUP_ID of the group node
6. NEVER change: layout, positions, widths, heights, ids (except GROUP_ID), edges, types, or any structural fields.

SEESAW SMART DETECTION:
- When the user tells you a problem story or describes a technical issue/challenge (without explicitly saying S0/S1/S2/S3), you must:
  1. Analyze the story and identify which SEESAW stage it belongs to (usually S0 for problems)
  2. Prepare the template internally with the description fields filled from the story
  3. Reply with: "مرحلة S0 جاهزة ✅ تبي أعرضها هنا أو أرفعها على الريبو؟ اكتب اسم الريبو إذا تبي رفعها."
     (Replace S0 with the correct stage number if it's S1/S2/S3)
  4. Wait for the user's response:
     - If user says "اعرضها" or "عرض" or "display" or "show" → output the JSON template directly
     - If user provides a repo name → use the create_or_update_file tool to upload the JSON template to that repo as a file named "seesaw/S{stage}_{timestamp}.json"
     - If user says both display and repo → do both

Explicit Selector (when user explicitly types a stage):
- If input starts with or contains S0: use S0 template.
- If S1: use S1 template.
- If S2: use S2 template.
- If S3: use S3 template.
- If ALL or "بلش": return JSON array [S0, S1, S2, S3] with all 4 templates.

CRITICAL RULES FOR SEESAW:
- When user EXPLICITLY says S0, S1, S2, S3, ALL, or بلش — IMMEDIATELY output the JSON template. Do NOT ask questions.
- When user tells a STORY/PROBLEM (without explicitly saying S0/S1/S2/S3) — detect the stage, prepare the template, and ASK whether to display or upload to repo.
- Fill the description fields using context from the conversation. If the user discussed a problem, use that to fill S0's description. If they discussed product shape, fill S1, etc.
- If there is NO prior conversation context, still output the template with empty description fields — never refuse or ask.
- When outputting JSON, the output must be ONLY the JSON object, nothing else. No markdown code blocks, no explanations before or after.

===== SFM TEMPLATES KNOWLEDGE =====
${SFM_TEMPLATES}
===== END SFM TEMPLATES =====

GENERAL:
- When you use a tool and get results, summarize the key information clearly.
- If the user asks follow-up questions about previous tool results, use conversation history.
- Always use the tools to get real data. Never make up information.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, robotId, history } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const chatHistory: Array<{ role: string; content: string }> = Array.isArray(history) ? history : [];

      let githubUser = "";
      try {
        githubUser = await getAuthenticatedUser();
      } catch (_e) {}

      const systemPrompt = githubUser
        ? `${BASE_SYSTEM_PROMPT}\nThe authenticated GitHub username is: ${githubUser}`
        : BASE_SYSTEM_PROMPT;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (robotId === "robot-2") {
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
            response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8192,
              system: systemPrompt,
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
              const toolResult = await executeToolCall(block.name, block.input);
              toolResults.push({
                role: "user",
                content: [{ type: "tool_result", tool_use_id: block.id, content: toolResult }],
              } as any);
            }
          }

          if (!hasToolUse || response.stop_reason === "end_turn") {
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
        let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...chatHistory.map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          })),
        ];
        if (!messages.some(m => m.role === "user") || chatHistory.length === 0) {
          messages.push({ role: "user", content: message });
        }

        let maxIterations = 5;
        while (maxIterations-- > 0) {
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            tools: openaiTools,
            max_completion_tokens: 8192,
          });

          const choice = response.choices[0];

          if (choice.message.content) {
            res.write(`data: ${JSON.stringify({ content: choice.message.content })}\n\n`);
          }

          if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
            messages.push(choice.message);

            for (const toolCall of choice.message.tool_calls) {
              const tc = toolCall as any;
              const args = JSON.parse(tc.function.arguments);
              res.write(`data: ${JSON.stringify({ content: `\n⚙️ جاري تنفيذ ${tc.function.name}...\n` })}\n\n`);
              const toolResult = await executeToolCall(tc.function.name, args);
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: toolResult,
              });
            }
          } else {
            break;
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

  app.post("/api/jobs", async (req, res) => {
    try {
      const { message, robotId } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      const job = submitJob(message, robotId || "robot-1");
      res.json({ success: true, job });
    } catch (err: any) {
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

  app.get("/api/clickup/members", async (_req, res) => {
    try {
      const members = await getWorkspaceMembers();
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
```

---

## FILE 3: server/github.ts (GitHub Integration - Commit/Push)
```typescript
// GitHub integration using Replit connector
import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('GitHub connector not available');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export async function getRepos() {
  try {
    const octokit = await getClient();
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 20,
    });
    return data.map((r: any) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      language: r.language,
      updatedAt: r.updated_at,
      url: r.html_url,
      isPrivate: r.private,
    }));
  } catch (err: any) {
    throw new Error(`GitHub repos error: ${err.message}`);
  }
}

export async function getRepoContents(owner: string, repo: string, path: string = "") {
  try {
    const octokit = await getClient();
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        name: item.name,
        type: item.type,
        path: item.path,
        size: item.size,
      }));
    }
    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { name: data.name, path: data.path, content: content.substring(0, 3000) };
    }
    return data;
  } catch (err: any) {
    throw new Error(`GitHub content error: ${err.message}`);
  }
}

export async function getAuthenticatedUser() {
  try {
    const octokit = await getClient();
    const { data } = await octokit.users.getAuthenticated();
    return data.login;
  } catch (err: any) {
    throw new Error(`GitHub user error: ${err.message}`);
  }
}

export async function createOrUpdateFile(owner: string, repo: string, path: string, content: string, commitMessage: string) {
  try {
    const octokit = await getClient();
    const contentBase64 = Buffer.from(content).toString('base64');

    let sha: string | undefined;
    try {
      const { data: existing } = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(existing) && 'sha' in existing) {
        sha = existing.sha;
      }
    } catch (_e) {
    }

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: commitMessage,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    });

    return {
      success: true,
      path: data.content?.path,
      sha: data.content?.sha,
      commitSha: data.commit?.sha,
      commitUrl: data.commit?.html_url,
    };
  } catch (err: any) {
    throw new Error(`GitHub create file error: ${err.message}`);
  }
}

export async function getCommitChecks(owner: string, repo: string, ref: string) {
  try {
    const octokit = await getClient();
    const { data } = await octokit.checks.listForRef({ owner, repo, ref });
    return data.check_runs.map((run: any) => ({
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      output: run.output?.summary || run.output?.text || null,
      detailsUrl: run.details_url,
      htmlUrl: run.html_url,
    }));
  } catch (err: any) {
    throw new Error(`GitHub checks error: ${err.message}`);
  }
}

export async function getWorkflowRuns(owner: string, repo: string) {
  try {
    const octokit = await getClient();
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 10,
    });
    return data.workflow_runs.map((run: any) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha?.substring(0, 7),
      htmlUrl: run.html_url,
      createdAt: run.created_at,
    }));
  } catch (err: any) {
    throw new Error(`GitHub workflow runs error: ${err.message}`);
  }
}

export async function getWorkflowRunLogs(owner: string, repo: string, runId: number) {
  try {
    const octokit = await getClient();
    const { data } = await octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    return data.jobs.map((job: any) => ({
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      steps: job.steps?.map((s: any) => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
      })),
    }));
  } catch (err: any) {
    throw new Error(`GitHub workflow logs error: ${err.message}`);
  }
}

export async function getGitHubSummary(): Promise<string> {
  try {
    const repos = await getRepos();
    if (!repos.length) return "No GitHub repositories found.";

    let summary = "GitHub Repositories:\n";
    for (const repo of repos) {
      summary += `- ${repo.fullName}${repo.language ? ` (${repo.language})` : ""}${repo.isPrivate ? " [Private]" : " [Public]"}: ${repo.description || "No description"}\n`;
    }
    return summary;
  } catch (err: any) {
    return `Error fetching GitHub data: ${err.message}`;
  }
}
```

--- END OF EXPORT ---
