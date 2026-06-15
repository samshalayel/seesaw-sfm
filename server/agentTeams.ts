/**
 * agentTeams.ts — Multi-agent pipeline for seesaw autoTrigger
 *
 * Pipeline: Lead → Coder → Reviewer
 * Each agent is a Claude CLI subprocess. Output of each feeds the next.
 */

import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
const CLAUDE_TIMEOUT_MS = 8 * 60 * 1000; // 8 min per agent

// ── Find claude binary ────────────────────────────────────────────────────────
function findClaude(): string {
  const candidates = [
    path.join(os.homedir(), "AppData", "Roaming", "npm", "claude.cmd"),
    path.join(os.homedir(), "AppData", "Roaming", "npm", "claude.exe"),
    "claude.cmd",
    "claude",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch { /* */ }
  }
  return "claude.cmd";
}

// ── Run one Claude CLI agent ──────────────────────────────────────────────────
function runAgent(
  role: string,
  prompt: string,
  onLog: (msg: string) => void,
): Promise<string> {
  const claudeCmd = findClaude();
  const tmpFile = path.join(os.tmpdir(), `seesaw-agent-${role}-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, "utf8");

  // Filter env: remove ANTHROPIC_API_KEY + drop undefined/null values (Windows spawn EINVAL guard)
  const { ANTHROPIC_API_KEY: _removed, ...baseEnv } = process.env as Record<string, string>;
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(baseEnv).filter(([, v]) => v != null)
  );

  // Use shell: true + pipe via type/cat — same approach as robot-3 (avoids spawn EINVAL on Windows)
  const isWin = process.platform === "win32";
  const isRoot = process.getuid ? process.getuid() === 0 : false;
  const skipPerms = isRoot ? "" : " --dangerously-skip-permissions";
  const shellCmd = isWin
    ? `type "${tmpFile}" | "${claudeCmd}" -p${skipPerms} --model claude-haiku-4-5-20251001 --max-turns 1`
    : `cat "${tmpFile}" | "${claudeCmd}" -p${skipPerms} --model claude-haiku-4-5-20251001 --max-turns 1`;

  onLog(`[${role}] running via claude CLI...`);

  return new Promise((resolve, reject) => {
    const proc = spawn(shellCmd, [], { shell: true, env, cwd: os.tmpdir() });

    const killTimer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`[${role}] timeout after 8 min`));
    }, CLAUDE_TIMEOUT_MS);

    let output = "";
    let errOutput = "";

    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => {
      errOutput += d.toString();
      const lines = errOutput.split("\n");
      errOutput = lines.pop() || "";
      lines.forEach(l => { if (l.trim()) onLog(`[${role}] ${l.trim()}`); });
    });

    proc.on("close", (code) => {
      clearTimeout(killTimer);
      try { fs.unlinkSync(tmpFile); } catch { /* */ }
      if (output.trim()) resolve(output.trim());
      else reject(new Error(`[${role}] exited ${code} with no output. stderr: ${errOutput}`));
    });

    proc.on("error", (err) => {
      clearTimeout(killTimer);
      reject(new Error(`[${role}] spawn error: ${err.message}`));
    });
  });
}

// ── Main multi-agent pipeline ─────────────────────────────────────────────────
export async function runMultiAgentPipeline(opts: {
  taskName:    string;
  taskDesc:    string;
  systemInfo:  string; // github owner/repo, vps path, etc.
  onLog:       (msg: string) => void;
}): Promise<string> {
  const { taskName, taskDesc, systemInfo, onLog } = opts;

  onLog("🎯 [Lead] Starting planning phase...");

  // ── Phase 1: Lead ─────────────────────────────────────────────────────────
  const leadPrompt = `You are a Lead Engineer planning a software task.

TASK: ${taskName}
DESCRIPTION: ${taskDesc}

SYSTEM CONTEXT:
${systemInfo}

Your job:
1. Analyze the task carefully
2. Write a clear, structured PLAN with specific steps
3. Specify exactly what files need to be created/modified and how
4. Be precise — another engineer will implement based ONLY on your plan

Output a structured plan in markdown. Be specific about file paths, function names, and logic.`;

  const plan = await runAgent("Lead", leadPrompt, onLog);
  onLog(`✅ [Lead] Plan complete (${plan.length} chars)`);

  // ── Phase 2: Coder ────────────────────────────────────────────────────────
  onLog("💻 [Coder] Starting implementation phase...");

  const coderPrompt = `You are a Senior Developer implementing a task based on a Lead Engineer's plan.

ORIGINAL TASK: ${taskName}
DESCRIPTION: ${taskDesc}

SYSTEM CONTEXT:
${systemInfo}

LEAD ENGINEER'S PLAN:
${plan}

Your job:
1. Implement exactly what the plan specifies
2. Write complete, production-ready code
3. For each file: output the full file content
4. Format your output as:

=== FILE: path/to/file.ext ===
<full file content here>

=== FILE: another/file.ext ===
<full file content here>

Do not skip any file. Do not truncate code. Write the complete implementation.`;

  const implementation = await runAgent("Coder", coderPrompt, onLog);
  onLog(`✅ [Coder] Implementation complete (${implementation.length} chars)`);

  // ── Phase 3: Reviewer ─────────────────────────────────────────────────────
  onLog("👁 [Reviewer] Starting review phase...");

  const reviewerPrompt = `You are a Senior Code Reviewer. Review the implementation below and either APPROVE it or request specific fixes.

ORIGINAL TASK: ${taskName}

PLAN:
${plan}

IMPLEMENTATION:
${implementation}

Your job:
1. Check if the implementation matches the plan
2. Check for bugs, security issues, or missing logic
3. If APPROVED: output "APPROVED" followed by a brief summary
4. If NEEDS FIX: output "NEEDS FIX" followed by specific corrections, then provide the CORRECTED implementation in the same === FILE: === format

Be decisive. Output the final ready-to-deploy code.`;

  const review = await runAgent("Reviewer", reviewerPrompt, onLog);
  onLog(`✅ [Reviewer] Review complete`);

  // ── Combine final result ───────────────────────────────────────────────────
  const finalResult = `# Multi-Agent Pipeline Result

## Task: ${taskName}

## Lead's Plan
${plan}

## Implementation
${implementation}

## Reviewer's Decision
${review}`;

  return finalResult;
}

// ── Parse === FILE: === blocks from coder/reviewer output ─────────────────────
export function parseFileBlocks(text: string): Array<{ path: string; content: string }> {
  const blocks: Array<{ path: string; content: string }> = [];
  const regex = /=== FILE: (.+?) ===\n([\s\S]*?)(?==== FILE:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();
    if (filePath && content) {
      blocks.push({ path: filePath, content });
    }
  }
  return blocks;
}
