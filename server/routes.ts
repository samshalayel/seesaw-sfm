import express from "express";
import { createServer } from "http";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR    = path.join(__dirname, "../data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const TOKENS_FILE   = path.join(DATA_DIR, "google-tokens.json");
const WALL_IMAGE_META = path.join(DATA_DIR, "wall-image.json");

// ── إنشاء المجلدات تلقائياً ───────────────────────────────────────────────
for (const d of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ── Multer — رفع الملفات (حد أقصى 3) ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb)  => cb(null, Date.now() + "_" + file.originalname),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(txt|md|pdf|json|csv|docx)$/i.test(file.originalname);
    cb(null, ok);
  },
});

// ── Multer — رفع صورة الجدار ─────────────────────────────────────────────────
const wallStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DATA_DIR),
  filename:    (_req, file, cb)  => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, "wall-image" + ext);
  },
});
const wallUpload = multer({
  storage: wallStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.originalname);
    cb(null, ok);
  },
});

// ── قراءة الإعدادات ──────────────────────────────────────────────────────────
function loadSettings(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")); }
  catch { return {}; }
}
function saveSettings(data: Record<string, any>) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// ── قراءة توكنات Google ───────────────────────────────────────────────────────
function loadTokens(): Record<string, any> | null {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8")); }
  catch { return null; }
}
function saveTokens(tokens: Record<string, any>) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

// ── قراءة محتوى ملف ──────────────────────────────────────────────────────────
async function readFileContent(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(fs.readFileSync(filePath));
      return data.text.slice(0, 150000);
    } catch { return "[PDF: تعذّرت القراءة]"; }
  }
  return fs.readFileSync(filePath, "utf-8").slice(0, 150000);
}

// ── Google OAuth client — يقرأ من .env (مركزي للخدمة) ───────────────────────
function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID     || "",
    process.env.GOOGLE_CLIENT_SECRET || "",
    process.env.GOOGLE_REDIRECT_URI  || "http://localhost:3001/api/google/callback"
  );
}

// ── إرسال email تأكيد عبر Gmail API ──────────────────────────────────────────
async function sendConfirmationEmail(gmailTokens: any, userEmail: string, scope: string) {
  try {
    const oauth2 = makeOAuth2Client();
    oauth2.setCredentials(gmailTokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    const scopeLabel = scope === "gmail" ? "Gmail" : "Google Calendar";
    const subject    = `✅ تم ربط ${scopeLabel} بنجاح`;
    const body       = `مرحباً،\n\nتم ربط حسابك (${userEmail}) بـ ${scopeLabel} في المكتب الذكي بنجاح.\n\nإذا لم تطلب هذا الربط، يرجى التواصل معنا فوراً.\n\nفريق المكتب الذكي`;

    const message = [
      `To: ${userEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      body,
    ].join("\n");

    const encoded = Buffer.from(message).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
    console.log(`[Google] Confirmation email sent to ${userEmail}`);
  } catch (e: any) {
    console.warn("[Google] Could not send confirmation email:", e.message);
  }
}

export function registerRoutes(app: express.Application, _httpServer: ReturnType<typeof createServer>) {
  app.use(cors());

  // ── Settings ──────────────────────────────────────────────────────────────
  app.get("/api/settings", (_req, res) => {
    const s = loadSettings();
    // إخفاء المفاتيح الحساسة
    const safe = { ...s };
    if (safe.apiKey)              safe.apiKey             = safe.apiKey.slice(0,6) + "••••";
    if (safe.googleClientSecret)  safe.googleClientSecret = "••••";
    res.json(safe);
  });

  app.post("/api/settings", (req, res) => {
    const current = loadSettings();
    const body = req.body as Record<string, any>;
    // لا تكتب فوق المفاتيح لو جاء "••••"
    if (body.apiKey?.includes("••••"))            delete body.apiKey;
    if (body.googleClientSecret?.includes("••••")) delete body.googleClientSecret;
    saveSettings({ ...current, ...body });
    res.json({ ok: true });
  });

  // ── Files ─────────────────────────────────────────────────────────────────
  app.get("/api/files", (_req, res) => {
    const files = fs.readdirSync(UPLOADS_DIR).map(name => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, name));
      return { name, size: stat.size, mtime: stat.mtime };
    });
    res.json(files);
  });

  app.post("/api/files", (req, res, next) => {
    upload.array("files", 3)(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "الملف كبير جداً — الحد الأقصى 10 MB" });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, (req, res) => {
    // الحد الأقصى 3 ملفات في المجموع — احذف الأقدم لو تجاوز
    const all = fs.readdirSync(UPLOADS_DIR).map(n => ({
      name: n,
      mtime: fs.statSync(path.join(UPLOADS_DIR, n)).mtime.getTime(),
    })).sort((a, b) => a.mtime - b.mtime);

    while (all.length > 3) {
      const old = all.shift()!;
      fs.unlinkSync(path.join(UPLOADS_DIR, old.name));
    }

    const files = (req.files as Express.Multer.File[]) || [];
    res.json({ uploaded: files.map(f => f.filename) });
  });

  app.delete("/api/files/:name", (req, res) => {
    const filePath = path.join(UPLOADS_DIR, path.basename(req.params.name));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  });

  // ── Wall Image ───────────────────────────────────────────────────────────
  app.get("/api/wall-image", (_req, res) => {
    try {
      const meta = JSON.parse(fs.readFileSync(WALL_IMAGE_META, "utf-8"));
      res.json(meta);
    } catch {
      res.json({ exists: false });
    }
  });

  app.post("/api/wall-image", (req, res, next) => {
    wallUpload.single("image")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  }, (req, res) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: "لم يتم رفع صورة" });
    const ext  = path.extname(file.originalname).toLowerCase();
    const meta = { exists: true, filename: "wall-image" + ext, url: "/api/wall-image/file" };
    fs.writeFileSync(WALL_IMAGE_META, JSON.stringify(meta, null, 2));
    res.json(meta);
  });

  app.get("/api/wall-image/file", (_req, res) => {
    try {
      const meta = JSON.parse(fs.readFileSync(WALL_IMAGE_META, "utf-8"));
      if (!meta.exists) return res.status(404).json({ error: "لا توجد صورة" });
      const filePath = path.join(DATA_DIR, meta.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "الملف غير موجود" });
      res.sendFile(filePath);
    } catch {
      res.status(404).json({ error: "لا توجد صورة" });
    }
  });

  app.delete("/api/wall-image", (_req, res) => {
    try {
      const meta = JSON.parse(fs.readFileSync(WALL_IMAGE_META, "utf-8"));
      if (meta.exists && meta.filename) {
        const filePath = path.join(DATA_DIR, meta.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch { /* ignore */ }
    fs.writeFileSync(WALL_IMAGE_META, JSON.stringify({ exists: false }, null, 2));
    res.json({ ok: true });
  });

  // ── Google OAuth ──────────────────────────────────────────────────────────
  app.get("/api/google/status", (_req, res) => {
    const tokens = loadTokens();
    res.json({
      calendar: !!(tokens?.calendar),
      gmail:    !!(tokens?.gmail),
    });
  });

  app.get("/api/google/auth", (req, res) => {
    const scope  = req.query.scope as string; // "calendar" | "gmail"
    const oauth2 = makeOAuth2Client();

    const scopes = scope === "gmail"
      ? [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/userinfo.email",
        ]
      : [
          "https://www.googleapis.com/auth/calendar",       // قراءة + كتابة
          "https://www.googleapis.com/auth/userinfo.email",
        ];

    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: scope,
      prompt: "consent",
    });
    res.redirect(url);
  });

  app.get("/api/google/callback", async (req, res) => {
    const code  = req.query.code  as string;
    const scope = req.query.state as string;
    const oauth2 = makeOAuth2Client();

    try {
      const { tokens } = await oauth2.getToken(code);
      const current = loadTokens() || {};
      saveTokens({ ...current, [scope]: tokens });

      // جلب الإيميل وإرسال تأكيد
      try {
        oauth2.setCredentials(tokens);
        const oauth2Info = google.oauth2({ version: "v2", auth: oauth2 });
        const { data }   = await oauth2Info.userinfo.get();
        const userEmail  = data.email || "";

        // حفظ الإيميل مع التوكن
        const updated = loadTokens() || {};
        updated[scope] = { ...tokens, userEmail };
        saveTokens(updated);

        // إرسال email تأكيد (للـ Gmail فقط — لديه صلاحية الإرسال)
        if (scope === "gmail" && userEmail) {
          await sendConfirmationEmail(tokens, userEmail, scope);
        }

        res.send(`
          <html dir="rtl"><body style="font-family:system-ui;text-align:center;padding:60px;background:#f8f5f0">
            <div style="background:#fff;border-radius:16px;padding:40px;max-width:400px;margin:auto;box-shadow:0 4px 24px #0001">
              <div style="font-size:48px">✅</div>
              <h2 style="color:#1a1a1a">تم الربط بنجاح!</h2>
              <p style="color:#666">${userEmail}</p>
              ${scope === "gmail" ? "<p style='color:#888;font-size:13px'>📧 تم إرسال email تأكيد لحسابك</p>" : ""}
              <p style="color:#999;font-size:12px">يمكنك إغلاق هذه النافذة</p>
            </div>
            <script>window.opener && window.opener.postMessage('google_connected_${scope}','*'); setTimeout(()=>window.close(),2000);</script>
          </body></html>
        `);
      } catch {
        res.send(`<script>window.opener && window.opener.postMessage('google_connected_${scope}','*');window.close();</script><p>تم الربط ✅</p>`);
      }
    } catch (e: any) {
      res.status(400).send(`
        <html dir="rtl"><body style="font-family:system-ui;text-align:center;padding:60px">
          <h2>❌ فشل الربط</h2><p>${e.message}</p>
          <button onclick="window.close()">إغلاق</button>
        </body></html>
      `);
    }
  });

  app.post("/api/google/disconnect", (req, res) => {
    const { scope } = req.body as { scope: string };
    const current = loadTokens() || {};
    delete current[scope];
    saveTokens(current);
    res.json({ ok: true });
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  app.post("/api/chat", async (req, res) => {
    const { message, history } = req.body as {
      message: string;
      history?: { role: string; content: string }[];
    };

    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const settings = loadSettings();
    const apiKey   = settings.apiKey || "";
    const model    = settings.model  || "gpt-4o-mini";
    const sysBase  = settings.systemPrompt || "أنت مساعد ذكي ومفيد.";

    if (!apiKey) return res.status(400).json({ error: "API key غير مُعدّ — افتح الإعدادات" });

    // ── حقن محتوى الملفات ────────────────────────────────────────────────
    let fileContext = "";
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const fname of files) {
      const content = await readFileContent(path.join(UPLOADS_DIR, fname));
      fileContext += `\n\n[📄 ${fname}]\n${content}`;
    }

    // ── حقن Google Calendar ────────────────────────────────────────────────
    let calendarContext = "";
    const tokens = loadTokens();
    if (tokens?.calendar) {
      try {
        const oauth2 = makeOAuth2Client();
        oauth2.setCredentials(tokens.calendar);
        const cal = google.calendar({ version: "v3", auth: oauth2 });
        const now = new Date().toISOString();
        const events = await cal.events.list({
          calendarId: "primary",
          timeMin: now,
          maxResults: 5,
          singleEvents: true,
          orderBy: "startTime",
        });
        const items = events.data.items || [];
        if (items.length) {
          calendarContext = "\n\n[📅 أحداث التقويم القادمة]\n" +
            items.map(e =>
              `• ${e.summary || "بدون عنوان"} — ${e.start?.dateTime || e.start?.date || ""}`
            ).join("\n");
        }
      } catch { calendarContext = ""; }
    }

    // ── حقن Gmail ──────────────────────────────────────────────────────────
    let gmailContext = "";
    if (tokens?.gmail) {
      try {
        const oauth2 = makeOAuth2Client();
        oauth2.setCredentials(tokens.gmail);
        const gmail = google.gmail({ version: "v1", auth: oauth2 });
        const list  = await gmail.users.messages.list({ userId: "me", maxResults: 5, q: "is:inbox" });
        const msgs  = list.data.messages || [];
        const details = await Promise.all(
          msgs.map(m => gmail.users.messages.get({
            userId: "me", id: m.id!, format: "metadata",
            metadataHeaders: ["Subject", "From"],
          }))
        );
        if (details.length) {
          gmailContext = "\n\n[📧 آخر رسائل البريد]\n" +
            details.map(d => {
              const headers = d.data.payload?.headers || [];
              const subj = headers.find(h => h.name === "Subject")?.value || "(بدون موضوع)";
              const from = headers.find(h => h.name === "From")?.value || "";
              return `• من: ${from}\n  الموضوع: ${subj}`;
            }).join("\n");
        }
      } catch { gmailContext = ""; }
    }

    const systemPrompt = sysBase + fileContext + calendarContext + gmailContext;
    const chatHistory  = Array.isArray(history) ? history : [];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // ── Anthropic ────────────────────────────────────────────────────────────
    if (model.toLowerCase().includes("claude")) {
      try {
        const client = new Anthropic({ apiKey });
        const msgs: Anthropic.MessageParam[] = [
          ...chatHistory.map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: message },
        ];
        const response = await client.messages.create({
          model, max_tokens: 4096,
          system: systemPrompt,
          messages: msgs,
        });
        for (const block of response.content) {
          if (block.type === "text")
            res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
        }
      } catch (e: any) {
        res.write(`data: ${JSON.stringify({ content: `خطأ: ${e.message}` })}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    // ── OpenAI ────────────────────────────────────────────────────────────────
    try {
      const client = new OpenAI({ apiKey });
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory.map(m => ({ role: m.role as any, content: m.content })),
          { role: "user", content: message },
        ],
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ content: `خطأ: ${e.message}` })}\n\n`);
    }
    res.write(`data: [DONE]\n\n`);
    return res.end();
  });
}
