import { db } from "./db";
import {
  users, rooms, roomModels, roomPlaylist, tierModels, projects, projectPlaybooks,
  type User, type InsertUser, type Room, type RoomModel, type RoomPlaylistItem, type WorkspaceProject, type ProjectPlaybook,
} from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByRoomId(roomId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { roomId: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, fields: { tier?: string; role?: string; subscriptionEnd?: Date | null }): Promise<void>;
  deleteUser(id: number): Promise<void>;

  // Rooms
  createRoom(roomId: string): Promise<Room>;
  getRoom(roomId: string): Promise<Room | undefined>;
  getAllRooms(): Promise<Room[]>;
  updateRoom(roomId: string, settings: Partial<Omit<Room, "id" | "roomId" | "createdAt">>): Promise<void>;

  // Models
  getRoomModels(roomId: string): Promise<RoomModel[]>;
  setRoomModels(roomId: string, models: Array<{ name: string; alias?: string; apiKey: string; modelId?: string; systemPrompt?: string; roomAssignment?: string }>): Promise<void>;

  // Playlist
  getRoomPlaylist(roomId: string): Promise<RoomPlaylistItem[]>;
  setRoomPlaylist(roomId: string, items: Array<{ videoId: string; label: string }>): Promise<void>;

  // Tier Models
  getTierModels(): Promise<Record<string, string[]>>;
  setTierModels(data: Record<string, string[]>): Promise<void>;

  // Workspace Projects
  getWorkspaceProjects(roomId: string): Promise<WorkspaceProject[]>;
  getProjectByListId(roomId: string, clickupListId: string): Promise<WorkspaceProject | undefined>;
  upsertWorkspaceProject(roomId: string, data: {
    id?: number; projectKey: string; name: string;
    githubOwner: string; githubRepo: string;
    clickupListId: string; vpsPath: string; contextMd: string;
  }): Promise<WorkspaceProject>;
  deleteWorkspaceProject(id: number): Promise<void>;

  // Project Playbooks
  getProjectPlaybooks(roomId: string, projectKey: string): Promise<ProjectPlaybook[]>;
  upsertPlaybook(roomId: string, projectKey: string, data: {
    id?: number; name: string; keywords: string; content: string; orderIndex?: number;
  }): Promise<ProjectPlaybook>;
  deletePlaybook(id: number): Promise<void>;
  matchPlaybook(roomId: string, projectKey: string, taskText: string): Promise<ProjectPlaybook | undefined>;
}

export class DrizzleStorage implements IStorage {

  // ── Users ────────────────────────────────────────────────────────────────────
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByRoomId(roomId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.roomId, roomId));
    return result[0];
  }

  async createUser(user: InsertUser & { roomId: string }): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: number, fields: { tier?: string; role?: string; subscriptionEnd?: Date | null }): Promise<void> {
    const setFields: Partial<typeof users.$inferInsert> = {};
    if (fields.tier !== undefined) setFields.tier = fields.tier;
    if (fields.role !== undefined) setFields.role = fields.role;
    if (fields.subscriptionEnd !== undefined) setFields.subscriptionEnd = fields.subscriptionEnd;
    if (Object.keys(setFields).length === 0) return;
    await db.update(users).set(setFields).where(eq(users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ── Rooms ────────────────────────────────────────────────────────────────────
  async getAllRooms(): Promise<Room[]> {
    return db.select().from(rooms);
  }

  async createRoom(roomId: string): Promise<Room> {
    const result = await db.insert(rooms).values({ roomId }).returning();
    return result[0];
  }

  async getRoom(roomId: string): Promise<Room | undefined> {
    const result = await db.select().from(rooms).where(eq(rooms.roomId, roomId));
    return result[0];
  }

  async updateRoom(
    roomId: string,
    settings: Partial<Omit<Room, "id" | "roomId" | "createdAt">>,
  ): Promise<void> {
    await db.update(rooms).set(settings).where(eq(rooms.roomId, roomId));
  }

  // ── Models ───────────────────────────────────────────────────────────────────
  async getRoomModels(roomId: string): Promise<RoomModel[]> {
    return db.select().from(roomModels)
      .where(eq(roomModels.roomId, roomId))
      .orderBy(asc(roomModels.orderIndex));
  }

  async setRoomModels(
    roomId: string,
    models: Array<{ name: string; alias?: string; apiKey: string; modelId?: string; systemPrompt?: string; roomAssignment?: string; isVoice?: boolean; isHidden?: boolean }>,
  ): Promise<void> {
    // UPDATE existing rows in-place to preserve IDs (avoids React key changes → no 3D remount)
    const existing = await db.select().from(roomModels)
      .where(eq(roomModels.roomId, roomId))
      .orderBy(asc(roomModels.orderIndex));

    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const row = {
        name: m.name, alias: m.alias || "", apiKey: m.apiKey,
        modelId: m.modelId || "", systemPrompt: m.systemPrompt || "",
        orderIndex: i, roomAssignment: m.roomAssignment || "main",
        isVoice: m.isVoice ?? false, isHidden: m.isHidden ?? false,
      };
      if (i < existing.length) {
        await db.update(roomModels).set(row).where(eq(roomModels.id, existing[i].id));
      } else {
        await db.insert(roomModels).values({ roomId, ...row });
      }
    }
    // Delete extra rows if list shrank
    for (let i = models.length; i < existing.length; i++) {
      await db.delete(roomModels).where(eq(roomModels.id, existing[i].id));
    }
  }

  // ── Playlist ─────────────────────────────────────────────────────────────────
  async getRoomPlaylist(roomId: string): Promise<RoomPlaylistItem[]> {
    return db.select().from(roomPlaylist)
      .where(eq(roomPlaylist.roomId, roomId))
      .orderBy(asc(roomPlaylist.orderIndex));
  }

  async setRoomPlaylist(
    roomId: string,
    items: Array<{ videoId: string; label: string }>,
  ): Promise<void> {
    await db.delete(roomPlaylist).where(eq(roomPlaylist.roomId, roomId));
    if (items.length > 0) {
      await db.insert(roomPlaylist).values(
        items.map((item, i) => ({
          roomId,
          videoId:    item.videoId,
          label:      item.label,
          orderIndex: i,
        })),
      );
    }
  }

  // ── Tier Models ──────────────────────────────────────────────────────────────
  async getTierModels(): Promise<Record<string, string[]>> {
    const rows = await db.select().from(tierModels);
    const result: Record<string, string[]> = { free: [], pro: [], enterprise: [] };
    for (const row of rows) {
      if (!result[row.tier]) result[row.tier] = [];
      result[row.tier].push(row.modelName);
    }
    return result;
  }

  async setTierModels(data: Record<string, string[]>): Promise<void> {
    await db.delete(tierModels);
    const rows = Object.entries(data).flatMap(([tier, models]) =>
      models.map((modelName) => ({ tier, modelName }))
    );
    if (rows.length > 0) {
      await db.insert(tierModels).values(rows);
    }
  }

  // ── Workspace Projects ───────────────────────────────────────────────────────
  async getWorkspaceProjects(roomId: string): Promise<WorkspaceProject[]> {
    return db.select().from(projects)
      .where(eq(projects.roomId, roomId))
      .orderBy(asc(projects.createdAt));
  }

  async getProjectByListId(roomId: string, clickupListId: string): Promise<WorkspaceProject | undefined> {
    if (!clickupListId) return undefined;
    const result = await db.select().from(projects)
      .where(eq(projects.roomId, roomId));
    return result.find(p => p.clickupListId === clickupListId);
  }

  async upsertWorkspaceProject(roomId: string, data: {
    id?: number; projectKey: string; name: string;
    githubOwner: string; githubRepo: string;
    clickupListId: string; vpsPath: string; contextMd: string;
  }): Promise<WorkspaceProject> {
    const vals = {
      roomId,
      projectKey:    data.projectKey.toUpperCase().slice(0, 6),
      name:          data.name,
      githubOwner:   data.githubOwner,
      githubRepo:    data.githubRepo,
      clickupListId: data.clickupListId,
      vpsPath:       data.vpsPath,
      contextMd:     data.contextMd,
    };
    if (data.id) {
      await db.update(projects).set(vals).where(eq(projects.id, data.id));
      return (await db.select().from(projects).where(eq(projects.id, data.id)))[0];
    }
    const result = await db.insert(projects).values(vals).returning();
    return result[0];
  }

  async deleteWorkspaceProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // ── Project Playbooks ────────────────────────────────────────────────────────
  async getProjectPlaybooks(roomId: string, projectKey: string): Promise<ProjectPlaybook[]> {
    return db.select().from(projectPlaybooks)
      .where(eq(projectPlaybooks.roomId, roomId))
      .then(rows => rows.filter(r => r.projectKey === projectKey)
        .sort((a, b) => a.orderIndex - b.orderIndex));
  }

  async upsertPlaybook(roomId: string, projectKey: string, data: {
    id?: number; name: string; keywords: string; content: string; orderIndex?: number;
  }): Promise<ProjectPlaybook> {
    const vals = {
      roomId, projectKey,
      name:       data.name,
      keywords:   data.keywords,
      content:    data.content,
      orderIndex: data.orderIndex ?? 0,
    };
    if (data.id) {
      await db.update(projectPlaybooks).set(vals).where(eq(projectPlaybooks.id, data.id));
      return (await db.select().from(projectPlaybooks).where(eq(projectPlaybooks.id, data.id)))[0];
    }
    const result = await db.insert(projectPlaybooks).values(vals).returning();
    return result[0];
  }

  async deletePlaybook(id: number): Promise<void> {
    await db.delete(projectPlaybooks).where(eq(projectPlaybooks.id, id));
  }

  async matchPlaybook(roomId: string, projectKey: string, taskText: string): Promise<ProjectPlaybook | undefined> {
    const playbooks = await this.getProjectPlaybooks(roomId, projectKey);
    const text = taskText.toLowerCase();
    return playbooks.find(pb => {
      const keywords = pb.keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
      return keywords.some(kw => text.includes(kw));
    });
  }
}

export const storage = new DrizzleStorage();
