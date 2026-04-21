/**
 * projectStore.ts — CRUD for projects & stage file versions
 */
import { db } from "./db";
import { projects, projectStageFiles } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";

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
