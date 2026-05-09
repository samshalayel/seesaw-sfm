import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // ── HTTPS تلقائي بشهادة self-signed ──────────────────────────────────────
    // يتيح استخدام الميكروفون (getUserMedia) من أي جهاز على الشبكة
    https: true,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      "/ws":  { target: "ws://localhost:3001",   ws: true },
    },
  },
  build: { outDir: "dist/client" },
});
