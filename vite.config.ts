import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import glsl from "vite-plugin-glsl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    glsl(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Three.js + R3F — ثقيل جداً، chunk منفصل
          if (id.includes("three") || id.includes("@react-three") || id.includes("postprocessing") || id.includes("meshline") || id.includes("r3f-perf")) {
            return "vendor-three";
          }
          // Agora — يُحمَّل lazy عند الحاجة فقط
          if (id.includes("agora")) {
            return "vendor-agora";
          }
          // Radix UI + framer-motion + animations
          if (id.includes("@radix-ui") || id.includes("framer-motion") || id.includes("gsap") || id.includes("react-useanimations")) {
            return "vendor-ui";
          }
          // مكتبات عامة
          if (id.includes("node_modules")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],
});
