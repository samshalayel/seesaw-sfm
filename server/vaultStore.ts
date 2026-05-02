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

export interface HumanMember {
  id:             string;  // auto-generated
  name:           string;
  role:           string;
  joinCode:       string;  // 6-char alphanumeric, auto-generated
  roomAssignment: string;  // الغرفة التي ينتقل إليها عند الدخول
}

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
  loginBg?:     string;
  doors: {
    mainCode: string; managerCode: string;
    stage0Code: string; stage1Code: string;
    hallCode: string;  hall2Code: string;
    brACode: string;   brBCode: string; brCCode: string;
  };
  github:       { token: string; owner: string; repo: string };
  clickup:      { token: string; listId: string; assignee: string };
  sfm:          { apiKey: string };
  huggingface?: { token: string };
  apidog?:      { token: string };
  figma?:       { token: string };
  vps?: { host: string; port: string; user: string; password: string; webRoot: string };
  humans:       HumanMember[];
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

  let stageCodes: Record<string, string> = {};
  try {
    stageCodes = JSON.parse((room as any).stageDoorCodesJson || "{}") || {};
  } catch { /* ignore */ }

  return {
    company: { name: room.companyName, logo: room.companyLogo },
    loginBg: room.loginBg || "",
    doors: {
      mainCode:    room.mainDoorCode,
      managerCode: room.managerDoorCode,
      stage0Code:  stageCodes.stage0  || "0000",
      stage1Code:  stageCodes.stage1  || "0000",
      hallCode:    stageCodes.hall    || "0000",
      hall2Code:   stageCodes.hall2   || "0000",
      brACode:     stageCodes.brA     || "0000",
      brBCode:     stageCodes.brB     || "0000",
      brCCode:     stageCodes.brC     || "0000",
    },
    github:  { token: room.githubToken, owner: room.githubOwner, repo: room.githubRepo },
    clickup: { token: room.clickupToken, listId: room.clickupListId, assignee: room.clickupAssignee },
    sfm:         { apiKey: room.sfmApiKey || "" },
    huggingface: { token: (room as any).huggingfaceToken || "" },
    apidog:      { token: (room as any).apidogToken || "" },
    figma:       { token: (room as any).figmaToken  || "" },
    vps: {
      host:     (room as any).vpsHost     || "",
      port:     (room as any).vpsPort     || "22",
      user:     (room as any).vpsUser     || "root",
      password: (room as any).vpsPassword || "",
      webRoot:  (room as any).vpsWebRoot  || "/var/www",
    },
    humans:      (() => { try { return JSON.parse((room as any).humansJson || "[]"); } catch { return []; } })(),
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
  if (settings.loginBg !== undefined) {
    update.loginBg = settings.loginBg;
  }
  if (settings.doors) {
    update.mainDoorCode    = settings.doors.mainCode    || "1977";
    update.managerDoorCode = settings.doors.managerCode || "0000";
    (update as any).stageDoorCodesJson = JSON.stringify({
      stage0: settings.doors.stage0Code || "0000",
      stage1: settings.doors.stage1Code || "0000",
      hall:   settings.doors.hallCode   || "0000",
      hall2:  settings.doors.hall2Code  || "0000",
      brA:    settings.doors.brACode    || "0000",
      brB:    settings.doors.brBCode    || "0000",
      brC:    settings.doors.brCCode    || "0000",
    });
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
  if (settings.sfm) {
    // لا تحفظ القيمة المُقنَّعة "••••••••" — فقط المفتاح الحقيقي
    if (settings.sfm.apiKey && settings.sfm.apiKey !== "••••••••") {
      update.sfmApiKey = settings.sfm.apiKey;
    }
  }
  if (settings.huggingface) {
    if (settings.huggingface.token && settings.huggingface.token !== "••••••••") {
      (update as any).huggingfaceToken = settings.huggingface.token;
    }
  }
  if (settings.apidog) {
    if (settings.apidog.token && settings.apidog.token !== "••••••••") {
      (update as any).apidogToken = settings.apidog.token;
    }
  }
  if (settings.figma) {
    if (settings.figma.token && settings.figma.token !== "••••••••") {
      (update as any).figmaToken = settings.figma.token;
    }
  }
  if (settings.vps) {
    if (settings.vps.host     !== undefined) (update as any).vpsHost     = settings.vps.host;
    if (settings.vps.port     !== undefined) (update as any).vpsPort     = settings.vps.port;
    if (settings.vps.user     !== undefined) (update as any).vpsUser     = settings.vps.user;
    if (settings.vps.webRoot  !== undefined) (update as any).vpsWebRoot  = settings.vps.webRoot;
    if (settings.vps.password && settings.vps.password !== "••••••••") {
      (update as any).vpsPassword = settings.vps.password;
    }
  }
  if (settings.systemPrompt !== undefined) {
    update.systemPrompt = settings.systemPrompt;
  }
  if (settings.hallWorkers !== undefined) {
    update.hallWorkersJson = JSON.stringify(settings.hallWorkers);
  }
  if (settings.humans !== undefined) {
    (update as any).humansJson = JSON.stringify(settings.humans);
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

export async function getVpsConfig(roomId?: string): Promise<{ host: string; port: number; user: string; password: string; webRoot: string }> {
  const room = await storage.getRoom(roomId || "default");
  return {
    host:     (room as any)?.vpsHost     || process.env.VPS_HOST     || "",
    port:     Number((room as any)?.vpsPort || process.env.VPS_PORT || 22),
    user:     (room as any)?.vpsUser     || process.env.VPS_USER     || "root",
    password: (room as any)?.vpsPassword || process.env.VPS_PASSWORD || "",
    webRoot:  (room as any)?.vpsWebRoot  || process.env.VPS_WEB_ROOT || "/var/www",
  };
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
