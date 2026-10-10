# ── build: يحتاج أدوات C++ لوحدات bcrypt و ssh2 الأصلية ──────────────────────
FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# المشروع يعتمد على vite 5 وبعض الإضافات تطلب vite 6+ كـ peer؛ التنصيب القديم كان متساهلاً بهالنقطة
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# ── أدوات الصيانة (drizzle-kit) — تُستخدم فقط عبر: docker compose --profile tools run migrate
FROM build AS tools

# ── runtime: بلا أدوات بناء ولا devDependencies ───────────────────────────────
FROM build AS prune
RUN npm prune --omit=dev --legacy-peer-deps

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=prune /app/node_modules ./node_modules
COPY --from=prune /app/package.json ./package.json
COPY --from=prune /app/dist ./dist
# يُقرأ وقت التشغيل نسبةً لمجلد العمل (server/routes.ts)
COPY --from=prune /app/server/sfm_templates.json ./server/sfm_templates.json
RUN mkdir -p data .vaults client/public/museum-uploads && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "dist/index.cjs"]
