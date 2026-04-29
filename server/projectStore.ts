/**
 * projectStore.ts — CRUD for projects & stage file versions & pipeline slots
 */
import { db } from "./db";
import { projects, projectStageFiles, pipelineSlots } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";

// ── Pipeline slot helpers ───────────────────────────────────────────────────────
export const PIPELINE_SLOTS = ["PD", "S0", "S1", "S2", "S3", "S4", "S5", "S6"] as const;
export type PipelineSlot = typeof PIPELINE_SLOTS[number];

/** Detect which slot a filename belongs to (case-insensitive) */
export function detectSlotFromPath(filePath: string): PipelineSlot | null {
  const name = filePath.toLowerCase();
  // e.g. "PRO_pd_2026..." or "pd.workflow.json" or "PD.json"
  if (/_pd[_.\-/]|[/\\]pd\.|^pd\./.test(name)) return "PD";
  if (/_s0[_.\-/]|[/\\]s0\.|^s0\.|s0\.workflow/.test(name)) return "S0";
  if (/_s1[_.\-/]|[/\\]s1\.|^s1\.|s1\.workflow/.test(name)) return "S1";
  if (/_s2[_.\-/]|[/\\]s2\.|^s2\.|s2\.workflow/.test(name)) return "S2";
  if (/_s3[_.\-/]|[/\\]s3\.|^s3\.|s3\.workflow/.test(name)) return "S3";
  if (/_s4[_.\-/]|[/\\]s4\.|^s4\.|s4\.workflow/.test(name)) return "S4";
  if (/_s5[_.\-/]|[/\\]s5\.|^s5\.|s5\.workflow/.test(name)) return "S5";
  if (/_s6[_.\-/]|[/\\]s6\.|^s6\.|s6\.workflow/.test(name)) return "S6";
  return null;
}

/** Upsert a slot with the latest filename (one row per room+project+slot) */
export async function setPipelineSlot(
  roomId: string,
  projectKey: string,
  slot: PipelineSlot,
  filename: string,
  githubPath: string = "",
) {
  const key = projectKey.toUpperCase();
  // Try update first
  const existing = await db.select().from(pipelineSlots).where(
    and(
      eq(pipelineSlots.roomId, roomId),
      eq(pipelineSlots.projectKey, key),
      eq(pipelineSlots.slot, slot),
    )
  );
  if (existing.length > 0) {
    await db.update(pipelineSlots)
      .set({ filename, githubPath, updatedAt: new Date() })
      .where(
        and(
          eq(pipelineSlots.roomId, roomId),
          eq(pipelineSlots.projectKey, key),
          eq(pipelineSlots.slot, slot),
        )
      );
  } else {
    await db.insert(pipelineSlots).values({ roomId, projectKey: key, slot, filename, githubPath });
  }
}

/** Get all 8 slots for a project (missing slots come back as null) */
export async function getPipelineSlots(
  roomId: string,
  projectKey: string,
): Promise<Record<PipelineSlot, { filename: string; githubPath: string; updatedAt: Date } | null>> {
  const key = projectKey.toUpperCase();
  const rows = await db.select().from(pipelineSlots).where(
    and(eq(pipelineSlots.roomId, roomId), eq(pipelineSlots.projectKey, key))
  );
  const result = {} as Record<PipelineSlot, { filename: string; githubPath: string; updatedAt: Date } | null>;
  for (const s of PIPELINE_SLOTS) result[s] = null;
  for (const r of rows) {
    result[r.slot as PipelineSlot] = { filename: r.filename, githubPath: r.githubPath, updatedAt: r.updatedAt };
  }
  return result;
}

// ── Create project ─────────────────────────────────────────────────────────
export async function createProject(roomId: string, projectKey: string, name: string) {
  const key = projectKey.toUpperCase().slice(0, 6);
  const [row] = await db.insert(projects).values({ roomId, projectKey: key, name }).returning();
  return row;
}

// ── List projects for room ─────────────────────────────────────────────────
export async function getProjects(roomId: string) {
  return db.select().from(projects)
    .where(eq(projects.roomId, roomId))
    .orderBy(desc(projects.createdAt));
}

// ── Get next version string for a stage ────────────────────────────────────
// Returns "v0.0", "v0.1", "v0.2", ...
export async function getNextVersion(roomId: string, projectKey: string, stage: string): Promise<string> {
  const rows = await db.select().from(projectStageFiles)
    .where(and(
      eq(projectStageFiles.roomId, roomId),
      eq(projectStageFiles.projectKey, projectKey.toUpperCase()),
      eq(projectStageFiles.stage, stage.toUpperCase()),
    ));
  const minor = rows.length; // 0 → v0.0, 1 → v0.1, ...
  return `v0.${minor}`;
}

// ── Record a file upload ───────────────────────────────────────────────────
export async function recordStageFile(
  roomId: string,
  projectKey: string,
  stage: string,
  filePath: string,
) {
  const key = projectKey.toUpperCase();
  const stg = stage.toUpperCase();
  const rows = await db.select().from(projectStageFiles)
    .where(and(
      eq(projectStageFiles.roomId, roomId),
      eq(projectStageFiles.projectKey, key),
      eq(projectStageFiles.stage, stg),
    ));
  const minor = rows.length;
  const [row] = await db.insert(projectStageFiles)
    .values({ roomId, projectKey: key, stage: stg, versionMinor: minor, filePath })
    .returning();
  return row;
}

// ── Get stage file history for a project ──────────────────────────────────
export async function getStageFiles(roomId: string, projectKey: string) {
  return db.select().from(projectStageFiles)
    .where(and(
      eq(projectStageFiles.roomId, roomId),
      eq(projectStageFiles.projectKey, projectKey.toUpperCase()),
    ))
    .orderBy(desc(projectStageFiles.createdAt));
}
