# Seesaw — دليل المشروع الشامل (Context File)
> آخر تحديث: 2026-04-30 | اقرأ هذا الملف أولاً قبل أي تعديل

---

## 🗺️ نظرة عامة

لعبة مكتب ثلاثية الأبعاد (React Three Fiber) تعمل كـ **منصة إنتاج رقمية**. الموظفون يتجولون في مكتب 3D ويتفاعلون مع روبوتات AI. المشروع يعمل كـ SaaS: كل "غرفة" (room) لها إعداداتها الخاصة في قاعدة البيانات.

**الميزة المميزة:** نظام **CI/CD تلقائي** — الروبوت يراقب ClickUp ويُنفّذ المهام تلقائياً (GitHub + VPS).

---

## 🛠️ التقنيات

| Layer | Stack |
|-------|-------|
| Frontend | React + React Three Fiber v8.18 + Three.js v0.170 + Vite |
| Backend | Express.js + TypeScript (ESM) |
| Database | PostgreSQL 18 — localhost:5432 — db: `seesaw` — user: `postgres` — pass: `123456` |
| ORM | Drizzle ORM |
| State | Zustand |
| 3D Models | GLB format في `/client/public/models/` |

---

## 📁 هيكل الملفات المهمة

```
client/src/
  App.tsx                               # Canvas + Lights + Scene
  components/game/
    Player.tsx                          # اللاعب + كاميرا + animations
    Room.tsx                            # الصالة الرئيسية
    TopRightPanel.tsx                   # شريط أدوات UI (خزنة + مراقب + عتال)
    VaultSettingsDialog.tsx             # إعدادات الخزنة (9 تبويبات)
    ManagerKeypadOverlay.tsx            # لوحة مفاتيح غرفة المدير
    DoorEntry.tsx                       # شاشة الدخول
    LogoutDoor.tsx                      # باب الخروج (Z=7.92)

server/
  autoTrigger.ts                        # ⭐ نظام CI/CD التلقائي
  routes.ts                             # API endpoints (3244 سطر)
  vaultStore.ts                         # قراءة/كتابة إعدادات الغرف من DB
  storage.ts                            # PostgreSQL operations (Drizzle)
  clickup.ts                            # ClickUp API wrapper
  github.ts                             # GitHub API wrapper
  atalWorker.ts                         # رفع الملفات التلقائي
  backgroundJobs.ts                     # مهام خلفية

shared/
  schema.ts                             # Drizzle schema (جداول DB)
```

---

## ⚙️ إعدادات Canvas (App.tsx)

```tsx
<Canvas flat shadows camera={{ position: [0, 5, 7], fov: 60 }}
  gl={{ antialias: true, powerPreference: "high-performance" }}>
  <ambientLight intensity={2.5} />
  <hemisphereLight intensity={1.2} />
  <directionalLight position={[5, 12, 5]} intensity={1.5} castShadow />
  <pointLight position={[0, 6, 0]} intensity={40} />
// flat prop مهم: يوقف ACESFilmic Tone Mapping
```

---

## 🗄️ قاعدة البيانات

```bash
# اتصال مباشر
PGPASSWORD=123456 "C:/Program Files/PostgreSQL/18/bin/psql.exe" -h localhost -U postgres -d seesaw

# أهم الجداول
rooms        # إعدادات كل غرفة (API keys, GitHub, ClickUp, VPS, ...)
users        # roomId, managerCode, ...
room_models  # موديلات AI لكل غرفة
```

### أعمدة جدول rooms المهمة
```sql
-- GitHub
github_token, github_owner, github_repo

-- ClickUp
clickup_token, clickup_list_id, clickup_assignee

-- VPS/SSH (مضاف 2026-04-30)
vps_host, vps_port, vps_user, vps_password, vps_web_root

-- AI
default_model, system_prompt, hall_workers_json

-- Figma, HuggingFace, APIdog, SFM
figma_token, huggingface_token, apidog_token, sfm_api_key
```

---

## 🤖 نظام CI/CD التلقائي (`server/autoTrigger.ts`)

### الفكرة
الروبوت يراقب ClickUp كل X دقائق، يلتقط المهام المعيّنة لمستخدم معين، ويُنفّذها تلقائياً.

### Pipeline كامل
```
ClickUp Task (to do)
        ↓
  updateTask → "in progress"       ← يُعلم الفريق
        ↓
  processTaskWithAI()
    ├── robot-1: GPT-4o            ← OpenAI API (key من الخزنة)
    ├── robot-2: Claude API        ← Anthropic API (key من الخزنة)
    └── robot-3: Claude CLI 🆓     ← claude.ai subscription (مجاني)
              ↓ إذا انتهى الليمت
        auto-fallback → robot-2
        ↓
  attachFileToTask()               ← يرفق result.txt على المهمة
        ↓
  updateTask → config.doneStatus   ← يغلق المهمة
```

### أدوات الروبوت (Tools)
| الأداة | الوظيفة |
|--------|---------|
| `get_clickup_tasks` | جلب كل مهام ClickUp |
| `get_workspace_structure` | هيكل الـ workspace |
| `get_workspace_members` | أعضاء الفريق مع IDs |
| `update_clickup_task` | تحديث مهمة |
| `create_clickup_task` | إنشاء مهمة |
| `get_repo_contents` | استعراض ملفات GitHub |
| `create_or_update_file` | كتابة ملف في GitHub |
| `run_on_vps` | **تشغيل أوامر bash على الـ VPS مباشرةً** |

### قاعدة تحديد الأداة (Decision Guide)
```
إذا المهمة تحتاج → composer/npm/php/git/mkdir   → run_on_vps
إذا المهمة تحتاج → إضافة/تعديل كود في repo     → create_or_update_file
إذا المهمة كاملة CI/CD → اثنتين معاً
```

### robot-3 (Claude CLI) — تفاصيل تقنية
- يستخدم `claude.exe` أو `claude.cmd` من npm global
- يكتب الـ prompt في temp file ويمرره عبر stdin (تفادياً لحد 8191 حرف Windows)
- يزيل `ANTHROPIC_API_KEY` من env ليستخدم OAuth subscription لا API credits
- يستخدم `--model claude-haiku-4-5-20251001` لتوفير الكوتا
- `cwd: process.env.TEMP` — لا يرى مشروع seesaw

### قراءة API Keys — القاعدة الذهبية
```typescript
// ✅ الصحيح — من الخزنة (DB) per-room
await refreshClients(); // يجدد openai + anthropic من DB قبل كل مهمة

// ❌ الخاطئ — من process.env (مشترك لكل الغرف)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

### تحديد الـ GitHub Repo — القاعدة الذهبية
```typescript
// ✅ دائماً من الخزنة
const owner = await getGitHubOwner(triggerRoomId);
const repo  = await getGitHubRepo(triggerRoomId);

// ❌ لا تستخدم get_github_repos — يجيب repos عشوائية
```

---

## 🔐 إعدادات الخزنة (vaultStore.ts)

كل إعداد مخزّن في PostgreSQL per-room. getters:

```typescript
getGitHubToken(roomId)    getGitHubOwner(roomId)    getGitHubRepo(roomId)
getClickUpToken(roomId)   getClickUpListId(roomId)
getModelByName(name, roomId)   // "GPT" | "Claude" | "Groq" | ...
getVpsConfig(roomId)      // { host, port, user, password, webRoot }
```

---

## 🖥️ VPS السيرفر

```
IP:       144.172.102.6
User:     root
Password: 21vU9xtxSVyFt3
SSH:      Python paramiko (sshpass غير متوفر، لا SSH key)
```

### مسارات المشاريع
| المسار | PM2 Process | الحالة |
|--------|-------------|--------|
| `/var/www/seesaw` | `seesaw` (id: 0) | 🟢 online |
| `/var/www/sillar` | `sillar` (id: 3) | 🟢 online |
| `/var/www/sfm` | — | بدون PM2 |
| `/var/www/sillar` | `sillar-local` (id: 2) | 🟢 dev mode |

### Deploy عبر Python paramiko
```python
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)
cmd = '''
for dir in /var/www/seesaw /var/www/sillar /var/www/sfm; do
  cd $dir && git fetch origin master && git reset --hard origin/master && echo "OK: $dir"
done
pm2 restart seesaw sillar sillar-local
'''
_, out, err = c.exec_command(cmd, timeout=120)
print(out.read().decode())
c.close()
```

---

## 📊 GitHub Repository

```
Repo:   https://github.com/samshalayel/seesaw-sfm
Branch: master
```

الثلاثة مشاريع على VPS متصلة بنفس الـ repo.

---

## 🎮 حدود الغرف

```typescript
ROOM_BOUNDS_X = 7
ROOM_BOUNDS_Z = [-7, 7]
MANAGER_ROOM_X = [8, 15.5]  |  MANAGER_ROOM_Z = [-6.5, 0.5]
MANAGER_DOOR_POSITION = Vector3(7.92, 0, -3)
VAULT_POSITION = Vector3(15.2, 0, -6)
DOOR_POSITION = [0, 2.7, 7.92]
```

---

## 🧩 API Endpoints المهمة

```
POST /api/auth/verify-manager-code   { code }

GET  /api/vault-settings
POST /api/vault-settings

POST /api/chat

GET  /api/auto-trigger/config
GET  /api/auto-trigger/logs
POST /api/auto-trigger/start        { userId, intervalMinutes, robotId }
POST /api/auto-trigger/stop
POST /api/auto-trigger/scan
POST /api/auto-trigger/clear-cache

GET  /api/clickup/members
GET  /api/github/repos
GET  /api/door-codes
```

---

## 🎨 UI — TopRightPanel.tsx

| الزر | الوظيفة |
|------|---------|
| ⚙️ خزنة | VaultSettingsDialog (9 تبويبات) |
| 🏢 مكتب | محادثة جماعية + Webex |
| 🏭 عتال | مراقب رفع الملفات |
| ⚡/🤖 مراقب | Auto-Trigger CI/CD |

**Auto-Trigger UI:**
- "فحص الآن" → feedback: ⏳ → ✅ تم الفحص (1.8s)
- "🔄 إعادة فحص" (ذهبي) → feedback: ⏳ → ✅ تم المسح (1.8s)
- سجل: single click توسيع، double click modal كامل الشاشة
- Modal: copy 📋 + export TXT 💾

---

## 🔧 قواعد التطوير الصارمة

### ESM — ضروري
```typescript
// ✅ فقط ESM imports
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
// ❌ const fs = require("fs"); — يفشل دائماً
```

### Preview Server
```bash
# preview_start معطوب دائماً على هذا الجهاز (spawn EINVAL)
# تحقق هكذا:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# يجب أن يرجع 200
```

---

## ⚡ أوامر مهمة

```bash
# تشغيل
npm run dev

# TypeScript check (الأخطاء في client/src طبيعية — ركّز على server/)
npx tsc --noEmit 2>&1 | grep "server/"

# DB migration مباشر
PGPASSWORD=123456 "C:/Program Files/PostgreSQL/18/bin/psql.exe" -h localhost -U postgres -d seesaw -c "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS ..."

# Git
git add <files> && git commit -m "type: description" && git push origin master
```

---

## 🐛 مشاكل محلولة (لا تعد إليها)

| المشكلة | الحل |
|---------|------|
| autoTrigger يستخدم مفتاح خاطئ | `refreshClients()` من DB قبل كل مهمة |
| robot يكتب في repo عشوائي | inject owner/repo في system prompt، لا `get_github_repos` |
| robot-3 يرى مشروع seesaw | `cwd: process.env.TEMP` |
| Windows 8191 char limit | temp file + stdin pipe |
| `require is not defined` | ESM `import` لا `require()` |
| Claude يرد بالعربي فقط | prompt إنجليزي + `-p` flag |
| ANTHROPIC_API_KEY يستهلك credits | حذفه من env الـ subprocess |
| WebGL Context Lost | `flat` prop + حذف أضواء زائدة |

---

## 🏗️ WIP — قيد التطوير

- [ ] تبويب VPS في VaultSettingsDialog (schema + DB migration جاهزَين، UI لم يكتمل)
