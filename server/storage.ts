import { db } from "./db";
import {
  users, rooms, roomModels, roomPlaylist,
  type User, type InsertUser, type Room, type RoomModel, type RoomPlaylistItem,
} from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByRoomId(roomId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { roomId: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Rooms
  createRoom(roomId: string): Promise<Room>;
  getRoom(roomId: string): Promise<Room | undefined>;
  updateRoom(roomId: string, settings: Partial<Omit<Room, "id" | "roomId" | "createdAt">>): Promise<void>;

  // Models
  getRoomModels(roomId: string): Promise<RoomModel[]>;
  setRoomModels(roomId: string, models: Array<{ name: string; alias?: string; apiKey: string; modelId?: string; systemPrompt?: string; roomAssignment?: string }>): Promise<void>;

  // Playlist
  getRoomPlaylist(roomId: string): Promise<RoomPlaylistItem[]>;
  setRoomPlaylist(roomId: string, items: Array<{ videoId: string; label: string }>): Promise<void>;
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

  // ── Rooms ────────────────────────────────────────────────────────────────────
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
    models: Array<{ name: string; alias?: string; apiKey: string; modelId?: string; systemPrompt?: string; roomAssignment?: string }>,
  ): Promise<void> {
    await db.delete(roomModels).where(eq(roomModels.roomId, roomId));
    if (models.length > 0) {
      await db.insert(roomModels).values(
        models.map((m, i) => ({
          roomId,
          name:           m.name,
          alias:          m.alias          || "",
          apiKey:         m.apiKey,
          modelId:        m.modelId        || "",
          systemPrompt:   m.systemPrompt   || "",
          orderIndex:     i,
          roomAssignment: m.roomAssignment || "main",
        })),
      );
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
}

export const storage = new DrizzleStorage();
