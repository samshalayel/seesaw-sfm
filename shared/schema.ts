import { pgTable, text, serial, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:                serial("id").primaryKey(),
  username:          text("username").notNull().unique(),
  password:          text("password").notNull(),
  roomId:            text("room_id").notNull().unique(),
  role:              text("role").notNull().default("user"),
  tier:              text("tier").notNull().default("free"),
  subscriptionStart: timestamp("subscription_start"),
  subscriptionEnd:   timestamp("subscription_end"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
});

// ── rooms (1:1 مع users) ──────────────────────────────────────────────────────
export const rooms = pgTable("rooms", {
  id:              serial("id").primaryKey(),
  roomId:          text("room_id").notNull().unique().references(() => users.roomId),

  // Company
  companyName:     text("company_name").notNull().default(""),
  companyLogo:     text("company_logo").notNull().default(""),
  loginBg:         text("login_bg").notNull().default(""),

  // Door codes
  mainDoorCode:    text("main_door_code").notNull().default("1977"),
  managerDoorCode: text("manager_door_code").notNull().default("0000"),

  // GitHub
  githubToken:     text("github_token").notNull().default(""),
  githubOwner:     text("github_owner").notNull().default(""),
  githubRepo:      text("github_repo").notNull().default(""),

  // ClickUp
  clickupToken:    text("clickup_token").notNull().default(""),
  clickupListId:   text("clickup_list_id").notNull().default(""),
  clickupAssignee: text("clickup_assignee").notNull().default(""),

  // Sillar SFM
  sfmApiKey:       text("sfm_api_key").notNull().default(""),
  sfmProject:      text("sfm_project").notNull().default(""),

  // HuggingFace (embeddings / RAG)
  huggingfaceToken: text("huggingface_token").notNull().default(""),

  // APIdog
  apidogToken: text("apidog_token").notNull().default(""),

  // Figma
  figmaToken: text("figma_token").notNull().default(""),

  // VPS / SSH
  vpsHost:     text("vps_host").notNull().default(""),
  vpsPort:     text("vps_port").notNull().default("22"),
  vpsUser:     text("vps_user").notNull().default("root"),
  vpsPassword: text("vps_password").notNull().default(""),
  vpsWebRoot:  text("vps_web_root").notNull().default("/var/www"),

  // WhatsApp — UltraMsg
  ultramsguInstanceId: text("ultramsg_instance_id").notNull().default(""),
  ultramsgunToken:     text("ultramsg_token").notNull().default(""),
  ultramsguPhone:      text("ultramsg_phone").notNull().default(""),
  contactsJson:        text("contacts_json").notNull().default("[]"),

  // Agora — Live Meeting
  agoraAppId:          text("agora_app_id").notNull().default(""),
  agoraAppCertificate: text("agora_app_certificate").notNull().default(""),

  // Google (Gmail + Calendar + Drive) — OAuth2
  googleClientId:      text("google_client_id").notNull().default(""),
  googleClientSecret:  text("google_client_secret").notNull().default(""),
  googleRefreshToken:  text("google_refresh_token").notNull().default(""),
  googleEmail:         text("google_email").notNull().default(""),
  googleCalendarId:    text("google_calendar_id").notNull().default("primary"),
  googleDriveFolderId: text("google_drive_folder_id").notNull().default(""),

  // AI
  defaultModel:    text("default_model").notNull().default(""),
  systemPrompt:    text("system_prompt").notNull().default(""),
  hallWorkersJson:      text("hall_workers_json").notNull().default("[]"),
  stageDoorCodesJson:   text("stage_door_codes_json").notNull().default("{}"),
  humansJson:           text("humans_json").notNull().default("[]"),

  createdAt:       timestamp("created_at").notNull().defaultNow(),
});

// ── room_models (many per room) ───────────────────────────────────────────────
export const roomModels = pgTable("room_models", {
  id:           serial("id").primaryKey(),
  roomId:       text("room_id").notNull().references(() => rooms.roomId),
  name:         text("name").notNull(),
  alias:        text("alias").notNull().default(""),
  apiKey:       text("api_key").notNull().default(""),
  modelId:      text("model_id").notNull().default(""),
  systemPrompt:    text("system_prompt").notNull().default(""),
  orderIndex:      integer("order_index").notNull().default(0),
  roomAssignment:  text("room_assignment").notNull().default("main"),
  isVoice:         boolean("is_voice").notNull().default(false),
  isHidden:        boolean("is_hidden").notNull().default(false),
});

// ── room_playlist (YouTube, many per room) ────────────────────────────────────
export const roomPlaylist = pgTable("room_playlist", {
  id:         serial("id").primaryKey(),
  roomId:     text("room_id").notNull().references(() => rooms.roomId),
  videoId:    text("video_id").notNull(),
  label:      text("label").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
});

// ── Relations ─────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one }) => ({
  room: one(rooms, { fields: [users.roomId], references: [rooms.roomId] }),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  models:   many(roomModels),
  playlist: many(roomPlaylist),
}));

export const roomModelsRelations = relations(roomModels, ({ one }) => ({
  room: one(rooms, { fields: [roomModels.roomId], references: [rooms.roomId] }),
}));

export const roomPlaylistRelations = relations(roomPlaylist, ({ one }) => ({
  room: one(rooms, { fields: [roomPlaylist.roomId], references: [rooms.roomId] }),
}));

// ── projects (per room / workspace) ──────────────────────────────────────────
export const projects = pgTable("projects", {
  id:            serial("id").primaryKey(),
  roomId:        text("room_id").notNull().references(() => rooms.roomId),
  projectKey:    text("project_key").notNull(),   // max 6 chars uppercase e.g. "SUPRT"
  name:          text("name").notNull().default(""),

  // Workspace project config (used by AutoTrigger)
  githubOwner:   text("github_owner").notNull().default(""),
  githubRepo:    text("github_repo").notNull().default(""),
  clickupListId: text("clickup_list_id").notNull().default(""),
  vpsPath:       text("vps_path").notNull().default(""),
  contextMd:     text("context_md").notNull().default(""),  // injected into every robot prompt

  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

// ── project_stage_files ───────────────────────────────────────────────────────
export const projectStageFiles = pgTable("project_stage_files", {
  id:           serial("id").primaryKey(),
  roomId:       text("room_id").notNull(),
  projectKey:   text("project_key").notNull(),
  stage:        text("stage").notNull(),         // "PD" | "S0" | ...
  versionMinor: integer("version_minor").notNull().default(0),
  filePath:     text("file_path").notNull(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

// ── pipeline_slots (8 fixed slots per project: PD, S0‑S6) ────────────────────
// Each slot holds the LATEST filename pushed to GitHub for that stage.
// Upsert on (room_id, project_key, slot) — only one row per slot.
export const pipelineSlots = pgTable("pipeline_slots", {
  id:          serial("id").primaryKey(),
  roomId:      text("room_id").notNull(),
  projectKey:  text("project_key").notNull(),
  slot:        text("slot").notNull(),       // "PD"|"S0"|"S1"|"S2"|"S3"|"S4"|"S5"|"S6"
  filename:    text("filename").notNull(),   // e.g. "PRO_pd_2026-04-29T....json"
  githubPath:  text("github_path").notNull().default(""), // full path in repo
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

// ── project_playbooks (per project — matched by keywords) ────────────────────
export const projectPlaybooks = pgTable("project_playbooks", {
  id:          serial("id").primaryKey(),
  roomId:      text("room_id").notNull().references(() => rooms.roomId),
  projectKey:  text("project_key").notNull(),
  name:        text("name").notNull().default(""),
  keywords:    text("keywords").notNull().default(""),  // comma-separated, e.g. "deploy,رفع,نشر"
  content:     text("content").notNull().default(""),   // markdown steps
  orderIndex:  integer("order_index").notNull().default(0),
});

// ── tier_models (allowed AI models per subscription tier) ─────────────────────
export const tierModels = pgTable("tier_models", {
  id:        serial("id").primaryKey(),
  tier:      text("tier").notNull(),       // "free" | "pro" | "enterprise"
  modelName: text("model_name").notNull(), // e.g. "GPT-4o", "Groq Llama"
});

// ── Types ─────────────────────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser        = z.infer<typeof insertUserSchema>;
export type User              = typeof users.$inferSelect;
export type Room              = typeof rooms.$inferSelect;
export type RoomModel         = typeof roomModels.$inferSelect;
export type RoomPlaylistItem  = typeof roomPlaylist.$inferSelect;
export type WorkspaceProject  = typeof projects.$inferSelect;
export type ProjectPlaybook   = typeof projectPlaybooks.$inferSelect;
