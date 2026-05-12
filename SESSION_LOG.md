# Session Log — 2026-05-03
> سجل جلسة العمل الكاملة

---

## ✅ المهام المنجزة

### 1. إصلاح Gemini Live API
**المشكلة:** "فشل الاتصال بالسيرفر" عند فتح المحادثة الصوتية  
**السبب:** systemPrompt كان يُرسل في URL params → يتجاوز حد 8191 حرف → WebSocket يفشل  
**الحل:** نقل systemPrompt من URL params إلى `init` message عبر WebSocket

```typescript
// قبل (خاطئ)
params.set("system", systemPrompt) // URL طويل جداً

// بعد (صحيح)
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "init", systemPrompt, messages }));
};
```

**مشكلة ثانية (Race Condition):** الـ init message يصل قبل تسجيل الـ handler  
**الحل:** تسجيل handler قبل أي `await`، استخدام Promise

```typescript
// سجّل handler فوراً قبل أي async
let initResolve!: (data: Buffer) => void;
const initPromise = new Promise<Buffer>(resolve => { initResolve = resolve; });
clientWs.once("message", (data: Buffer) => initResolve(data));
// ثم await
const rawData = await initPromise;
```

**الموديل الصحيح:** `models/gemini-3.1-flash-live-preview` (الوحيد الداعم لـ bidiGenerateContent)

---

### 2. Room Max Restrictions (VaultSettingsDialog)
**المطلوب:** حد أقصى للروبوتات لكل غرفة  
**التنفيذ:**

```typescript
const ROOM_MAX: Record<string, number> = {
  main:    3,
  stage0:  2,
  stage1:  2,
  manager: 2,
  brA:     2,
  brB:     2,
  brC:     2,
};
```

- منع اختيار غرفة ممتلئة في المنسدل
- عرض العداد `(2/3)` بجانب كل غرفة

---

### 3. إضافة تبويب VPS في إعدادات الخزنة
**الحقول:**
- عنوان السيرفر (IP أو Domain)
- Port + اسم المستخدم (جنب بعض)
- كلمة المرور (مخفية)
- Web Root

**إصلاح الـ API:** كان `vps` و `huggingface` و `apidog` و `figma` مُتجاهَلَة في GET وPOST  
→ أُضيفت للـ `routes.ts`

---

### 4. أدوات VPS/SSH للروبوت الصوتي
أُضيفت ثلاث أدوات جديدة في `geminiLive.ts`:

| الأداة | الوظيفة |
|--------|---------|
| `vps_exec` | تنفيذ أي أمر shell عبر SSH |
| `vps_deploy` | git pull + npm build + pm2 restart |
| `vps_status` | PM2 + RAM + Disk + Uptime |

```typescript
function sshExec(host, port, username, password, command): Promise<string> {
  // ssh2 Client مع hostVerifier: () => true
}
```

---

### 5. إصلاح 502 Bad Gateway على sillar.uk
**السبب:** `dist/index.cjs` قديم — خطأ `createRequire(import.meta.url)` في CJS  
**الحل:**
```bash
cd /var/www/sillar
git pull origin master
npm run build
pm2 restart sillar
```

---

### 6. إصلاح nginx لخدمة ملفات HTML مباشرة
**المشكلة:** أي ملف `.html` يحوّل للـ React app  
**الحل:** إضافة location في nginx يخدم الملفات مباشرة من filesystem:

```nginx
location ~* \.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|glb|mp3|wav|pdf)$ {
  root /var/www/sillar/dist/public;
  try_files $uri @nodejs;
  expires 7d;
}

location @nodejs {
  proxy_pass http://127.0.0.1:3000;
  ...
}
```

---

### 7. ClickUp Lists Dropdown في الخزنة
**المطلوب:** بعد إدخال الـ API Token، زر "جلب القوائم" يجيب كل Lists في منسدل  
**التنفيذ:**
- زر 🔍 يستدعي `/api/clickup/lists?token=...`
- النتيجة تظهر في `<select>` مع اسم الـ Folder
- إذا ما جلب يبقى input يدوي

**اكتشاف:** كان List ID مخزون خاطئاً — كان Team ID (`9018764624`) بدل List ID

---

## 📁 الملفات المُعدَّلة

| الملف | التغيير |
|-------|---------|
| `server/geminiLive.ts` | Gemini Live proxy + VPS SSH tools |
| `server/routes.ts` | إضافة vps/huggingface/apidog/figma في GET/POST |
| `client/src/components/game/VaultSettingsDialog.tsx` | تبويب VPS + ClickUp dropdown + ROOM_MAX |
| `client/src/components/game/GeminiLiveChat.tsx` | init message pattern |
| `/etc/nginx/sites-enabled/seesaw` | static files location |

---

## 🖥️ VPS Info

| | |
|--|--|
| IP | `144.172.102.6` |
| User | `root` |
| Pass | `21vU9xtxSVyFt3` |
| Host key | `SHA256:/acz8bkcZBAa+sQE70qDmkCkoz5Lx3h/NECADpqR3aE` |
| Project | `/var/www/sillar` |
| PM2 | `sillar` (id: 3) |

---

## 🗄️ ClickUp

| | |
|--|--|
| Token | `pk_95405745_C434ICPN2VWOFDMXTOWN3X1OLKG1ORHW` |
| Team ID | `9018764624` |
| List: التالي | `901816814648` |
| List: مكتمل | `901816814642` |
| List: SFM-PRO001 | `901817789873` |

---

## ⏳ مهام ناقصة

- [ ] إضافة `/api/clickup/lists` endpoint في `routes.ts`
- [ ] تأكيد حفظ VPS في الخزنة يعمل صح
- [ ] اختبار `vps_exec` من الروبوت الصوتي بعد حفظ البيانات
