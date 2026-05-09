import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { registerRoutes } from "./routes.js";
import { setupGeminiLive } from "./geminiLive.js";
import { setupVoiceRooms } from "./voiceRooms.js";

// ── تحميل .env يدوياً (بدون مكتبة خارجية) ───────────────────────────────────
const __envDir = path.dirname(fileURLToPath(import.meta.url));
const envFile  = path.join(__envDir, "../.env");
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === "production";

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: "10mb" }));

if (isProd) {
  const clientDist = path.join(__dirname, "../dist/client");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) =>
    res.sendFile(path.join(clientDist, "index.html"))
  );
}

// ── WebSocket servers (noServer: true) لتفادي تعارض المسارات ────────────────
const geminiWss    = new WebSocketServer({ noServer: true });
const voiceRoomWss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url || "/", "http://x").pathname;
  if (pathname === "/ws/gemini-live") {
    geminiWss.handleUpgrade(req, socket, head, (ws) =>
      geminiWss.emit("connection", ws, req)
    );
  } else if (pathname === "/ws/voice-room") {
    voiceRoomWss.handleUpgrade(req, socket, head, (ws) =>
      voiceRoomWss.emit("connection", ws, req)
    );
  } else {
    socket.destroy();
  }
});

registerRoutes(app, httpServer);
setupGeminiLive(httpServer, geminiWss);
setupVoiceRooms(httpServer, app, voiceRoomWss);

httpServer.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🌐 Network:  http://192.168.1.149:${PORT}`);
});
