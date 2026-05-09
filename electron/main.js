/**
 * electron/main.js
 * نقطة دخول Electron — يُشغّل السيرفر Express داخلياً ثم يفتح النافذة
 */

const { app, BrowserWindow, shell, Menu } = require("electron");
const path   = require("path");
const { spawn } = require("child_process");
const http   = require("http");
const fs     = require("fs");

const PORT        = 3001;
const SERVER_WAIT = 6000; // مهلة انتظار السيرفر (ms)

let mainWindow = null;
let serverProc = null;

// ── تشغيل السيرفر Express ────────────────────────────────────────────────────
function startServer() {
  // مسار tsx
  const tsxPath = path.join(__dirname, "../node_modules/tsx/dist/cli.mjs");
  const serverEntry = path.join(__dirname, "../server/index.ts");

  // قراءة .env يدوياً وحقنه في البيئة
  const envFile = path.join(__dirname, "../.env");
  const envVars = { ...process.env };
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, "utf-8").split("\n").forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      const idx = t.indexOf("=");
      if (idx < 0) return;
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim();
      if (k && !envVars[k]) envVars[k] = v;
    });
  }

  serverProc = spawn(
    process.execPath, // node
    [tsxPath, serverEntry],
    {
      env: { ...envVars, NODE_ENV: "production", PORT: String(PORT) },
      cwd: path.join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  serverProc.stdout.on("data", d => console.log("[server]", d.toString().trim()));
  serverProc.stderr.on("data", d => console.warn("[server]", d.toString().trim()));
  serverProc.on("close", code => console.log("[server] exited:", code));
}

// ── انتظر حتى يستجيب السيرفر ─────────────────────────────────────────────────
function waitForServer(url, maxMs = SERVER_WAIT) {
  return new Promise((resolve, reject) => {
    const start    = Date.now();
    const interval = setInterval(() => {
      http.get(url, res => {
        clearInterval(interval);
        resolve(res.statusCode);
      }).on("error", () => {
        if (Date.now() - start > maxMs) {
          clearInterval(interval);
          reject(new Error("Server timeout"));
        }
      });
    }, 300);
  });
}

// ── إنشاء النافذة ─────────────────────────────────────────────────────────────
async function createWindow() {
  startServer();

  try {
    await waitForServer(`http://localhost:${PORT}/`);
  } catch {
    console.warn("Server not ready — opening anyway...");
  }

  mainWindow = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth:  900,
    minHeight: 600,
    title: "المكتب الذكي",
    // أيقونة — ضعها في electron/icon.png
    ...(fs.existsSync(path.join(__dirname, "icon.png"))
      ? { icon: path.join(__dirname, "icon.png") }
      : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: "#f5f2ee",
    show: false, // لا تُظهر قبل تحميل الصفحة
  });

  mainWindow.loadURL(`http://localhost:${PORT}/`);

  // أظهر النافذة عند اكتمال التحميل
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // افتح الروابط الخارجية في المتصفح الافتراضي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // قائمة مبسطة
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "ملف",
      submenu: [
        { label: "الإعدادات", click: () => mainWindow?.loadURL(`http://localhost:${PORT}/settings`) },
        { type: "separator" },
        { label: "خروج", role: "quit" },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { label: "تكبير", role: "zoomIn" },
        { label: "تصغير", role: "zoomOut" },
        { label: "الحجم الافتراضي", role: "resetZoom" },
        { type: "separator" },
        { label: "ملء الشاشة", role: "togglefullscreen" },
        { type: "separator" },
        { label: "أدوات المطور", role: "toggleDevTools" },
      ],
    },
  ]));
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (serverProc) { serverProc.kill(); serverProc = null; }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (serverProc) { serverProc.kill(); serverProc = null; }
});
