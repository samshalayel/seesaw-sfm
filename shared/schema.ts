import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:       serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  roomId:   text("room_id").notNull().unique(),
});

// ── rooms (1:1 مع users) ──────────────────────────────────────────────────────
export const rooms = pgTable("rooms", {
  id:              serial("id").primaryKey(),
  roomId:          text("room_id").notNull().unique().references(() => users.roomId),

  // Company
  companyName:     text("company_name").notNull().default(""),
  companyLogo:     text("company_logo").notNull().default(""),

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

  // AI
  defaultModel:    text("default_model").notNull().default(""),
  systemPrompt:    text("system_prompt").notNull().default(""),
  hallWorkersJson: text("hall_workers_json").notNull().default("[]"),

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

// ── Types ─────────────────────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser       = z.infer<typeof insertUserSchema>;
export type User             = typeof users.$inferSelect;
export type Room             = typeof rooms.$inferSelect;
export type RoomModel        = typeof roomModels.$inferSelect;
export type RoomPlaylistItem = typeof roomPlaylist.$inferSelect;
