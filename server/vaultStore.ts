/**
 * vaultStore.ts — DB-backed (PostgreSQL via Drizzle)
 * كل الإعدادات مخزّنة في قاعدة البيانات.
 * عند أول وصول لغرفة غير موجودة يتم إنشاؤها تلقائياً مع ترحيل
 * أي بيانات قديمة من ملفات JSON إن وُجدت.
 */

import fs from "fs";
import path from "path";
import { storage } from "./storage";
import type { Room } from "@shared/schema";

export interface ModelConfig {
  id: string;
  name: string;
  alias?: string;
  apiKey: string;
  modelId?: string;
  systemPrompt?: string;
  roomAssignment?: string;
}

export interface VaultSettings {
  company:      { name: string; logo: string };
  doors:        { mainCode: string; managerCode: string };
  github:       { token: string; owner: string; repo: string };
  clickup:      { token: string; listId: string; assignee: string };
  models:       ModelConfig[];
  hallWorkers:  ModelConfig[];
  defaultModel: string;
  systemPrompt?: string;
}

const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || "";

export { DEFAULT_GROQ_KEY };

// ── helpers ───────────────────────────────────────────────────────────────────

function roomToVault(room: Room, models: ModelConfig[]): VaultSettings {
  let hallWorkers: ModelConfig[] = [];
  try {
    const parsed = JSON.parse(room.hallWorkersJson || "[]");
    if (Array.isArray(parsed)) hallWorkers = parsed;
  } catch { /* ignore */ }

  return {
    company: { name: room.companyName, logo: room.companyLogo },
    doors:   { mainCode: room.mainDoorCode, managerCode: room.managerDoorCode },
    github:  { token: room.githubToken, owner: room.githubOwner, repo: room.githubRepo },
    clickup: { token: room.clickupToken, listId: room.clickupListId, assignee: room.clickupAssignee },
    models:  models.length > 0
      ? models
      : [{ id: "model-default-1", name: "Groq", apiKey: DEFAULT_GROQ_KEY }],
    hallWorkers,
    defaultModel: room.defaultModel || "Groq",
    systemPrompt: room.systemPrompt || "",
  };
}

/** ينشئ الغرفة في DB ويرحّل بيانات JSON القديمة إن وُجدت */
async function ensureRoom(roomId: string): Promise<Room> {
  let room = await storage.getRoom(roomId);
  if (room) return room;

  const vaultFile = path.join(process.cwd(), ".vaults", `${roomId}.json`);
  if (fs.existsSync(vaultFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(vaultFile, "utf-8"));
      room = await storage.createRoom(roomId);
      await storage.updateRoom(roomId, {
        companyName:     data.company?.name      || "",
        companyLogo:     data.company?.logo      || "",
        mainDoorCode:    data.doors?.mainCode    || "1977",
        managerDoorCode: data.doors?.managerCode || "0000",
        githubToken:     data.github?.token      || "",
        githubOwner:     data.github?.owner      || "",
        githubRepo:      data.github?.repo       || "",
        clickupToken:    data.clickup?.token     || "",
        clickupListId:   data.clickup?.listId    || "",
        clickupAssignee: data.clickup?.assignee  || "",
        defaultModel:    data.defaultModel       || "",
        systemPrompt:    data.systemPrompt       || "",
      });
      if (Array.isArray(data.models) && data.models.length > 0) {
        await storage.setRoomModels(roomId, data.models.map((m: any) => ({
          name:         m.name         || "",
          apiKey:       m.apiKey       || "",
          modelId:      m.modelId      || "",
          systemPrompt: m.systemPrompt || "",
        })));
      }
      console.log(`[Vault] Migrated ${roomId} from JSON → DB`);
      return (await storage.getRoom(roomId))!;
    } catch (e: any) {
      console.error(`[Vault] Migration failed for ${roomId}:`, e.message);
    }
  }

  room = await storage.createRoom(roomId);
  return room;
}

// ── Public API (all async) ────────────────────────────────────────────────────

export async function getVaultSettings(roomId?: string): Promise<VaultSettings> {
  const id       = roomId || "default";
  const room     = await ensureRoom(id);
  const dbModels = await storage.getRoomModels(id);
  const models: ModelConfig[] = dbModels.map((m) => ({
    id:             `model-${m.id}`,
    name:           m.name,
    alias:          m.alias          || undefined,
    apiKey:         m.apiKey,
    modelId:        m.modelId        || undefined,
    systemPrompt:   m.systemPrompt   || undefined,
    roomAssignment: m.roomAssignment || "main",
  }));
  return roomToVault(room, models);
}

export async function setVaultSettings(
  settings: Partial<VaultSettings>,
  roomId?: string,
): Promise<void> {
  const id = roomId || "default";
  await ensureRoom(id);

  const update: Partial<Omit<Room, "id" | "roomId" | "createdAt">> = {};

  if (settings.company) {
    update.companyName = settings.company.name || "";
    update.companyLogo = settings.company.logo || "";
  }
  if (settings.doors) {
    update.mainDoorCode    = settings.doors.mainCode    || "1977";
    update.managerDoorCode = settings.doors.managerCode || "0000";
  }
  if (settings.github) {
    update.githubToken = settings.github.token || "";
    update.githubOwner = settings.github.owner || "";
    update.githubRepo  = settings.github.repo  || "";
  }
  if (settings.clickup) {
    update.clickupToken    = settings.clickup.token    || "";
    update.clickupListId   = settings.clickup.listId   || "";
    update.clickupAssignee = settings.clickup.assignee || "";
  }
  if (settings.systemPrompt !== undefined) {
    update.systemPrompt = settings.systemPrompt;
  }
  if (settings.hallWorkers !== undefined) {
    update.hallWorkersJson = JSON.stringify(settings.hallWorkers);
  }

  if (Object.keys(update).length > 0) {
    await storage.updateRoom(id, update);
  }

  if (settings.models) {
    await storage.setRoomModels(id, settings.models.map((m) => ({
      name:           m.name,
      alias:          m.alias,
      apiKey:         m.apiKey,
      modelId:        m.modelId,
      systemPrompt:   m.systemPrompt,
      roomAssignment: m.roomAssignment || "main",
    })));
  }
}

export async function getHallWorkers(roomId?: string): Promise<ModelConfig[]> {
  return (await getVaultSettings(roomId)).hallWorkers;
}

export async function getModels(roomId?: string): Promise<ModelConfig[]> {
  return (await getVaultSettings(roomId)).models;
}

export async function getModelByName(name: string, roomId?: string): Promise<ModelConfig | undefined> {
  const models = await getModels(roomId);
  return models.find((m) => m.name.toLowerCase() === name.toLowerCase());
}

export async function getGitHubToken(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.githubToken || process.env.GITHUB_TOKEN || "";
}

export async function getGitHubOwner(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.githubOwner || process.env.GITHUB_OWNER || "";
}

export async function getGitHubRepo(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.githubRepo || process.env.GITHUB_REPO || "";
}

export async function getClickUpToken(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.clickupToken || process.env.CLICKUP_API_TOKEN || "";
}

export async function getClickUpListId(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.clickupListId || process.env.CLICKUP_LIST_ID || "";
}

export async function getClickUpAssignee(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.clickupAssignee || process.env.CLICKUP_ASSIGNEE || "";
}

export async function getMainDoorCode(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.mainDoorCode || "1977";
}

export async function getManagerDoorCode(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.managerDoorCode || "0000";
}

export async function getDefaultModel(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.defaultModel || "Groq";
}

export async function setDefaultModel(modelName: string, roomId?: string): Promise<void> {
  const id = roomId || "default";
  await ensureRoom(id);
  await storage.updateRoom(id, { defaultModel: modelName });
}

export async function getSystemPrompt(roomId?: string): Promise<string> {
  const room = await storage.getRoom(roomId || "default");
  return room?.systemPrompt || "";
}
