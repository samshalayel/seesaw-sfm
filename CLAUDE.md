# Seesaw — مشروع لعبة 3D بيئة عمل

## نظرة عامة
لعبة ثلاثية الأبعاد مبنية بـ React Three Fiber تحاكي بيئة مكتب. اللاعب يتجول في الصالة ويتفاعل مع روبوتات AI ويدخل غرفة المدير.

## التقنيات
- **Frontend**: React + React Three Fiber (R3F) v8.18 + Three.js v0.170 + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (localhost:5432, db: seesaw, user: postgres, pass: 123456)
- **3D Models**: GLB format في `/client/public/models/`
- **Blender**: مثبّت في `C:/Program Files/Blender Foundation/Blender 5.0/blender.exe`

## هيكل الملفات المهمة
```
client/src/
  App.tsx                          # Canvas + Lights + Scene setup
  components/game/
    Player.tsx                     # اللاعب + كاميرا + animations
    Room.tsx                       # الصالة الرئيسية
    VaultSettingsDialog.tsx        # إعدادات الخزنة (5 تبويبات)
    ManagerKeypadOverlay.tsx       # لوحة مفاتيح غرفة المدير
    DoorEntry.tsx                  # شاشة الدخول (كود الباب)
    LogoutDoor.tsx                 # باب الخروج (Z=7.92)

server/
  routes.ts                        # API endpoints
  vaultStore.ts                    # إعدادات الخزنة (JSON files)
  storage.ts                       # PostgreSQL operations

.vaults/                           # إعدادات كل غرفة (JSON)
```

## إعدادات Canvas (App.tsx)
```tsx
<Canvas flat shadows camera={{ position: [0, 5, 7], fov: 60 }}
  gl={{ antialias: true, powerPreference: "high-performance" }}>
  <ambientLight intensity={2.5} />
  <hemisphereLight intensity={1.2} />
  <directionalLight position={[5, 12, 5]} intensity={1.5} castShadow />
  <pointLight position={[0, 6, 0]} intensity={40} />
  <!-- flat prop مهم: يوقف ACESFilmic Tone Mapping -->
```

## إعدادات الأفاتار (Player.tsx)
```ts
const AVATAR_SCALE      = 1.4;     // حجم اللاعب
const AVATAR_Y_OFFSET   = 0;
const AVATAR_ROTATION_Y = 0;       // 0 = وجهه للأمام (Mixamo)
const AVATAR_MODEL      = "/models/avatar.glb"
// spawn position: [0, 0, 8.5] = خارج الباب الرئيسي (Z=7.92)
// initial rotation: Math.PI = وجهه للداخل عند البداية
// منطق الحركة: isOutside (Z > 7) → يُسمح بالدخول فقط، لا رجوع للخارج
```

### الأفاتار الحالي
- **الملف**: `avatar.glb` (1.97 MB) — شخصية Mixamo ببدلة رسمية
- **Animations**: `Idle` + `Walk`
- **الملفات الاحتياطية**:
  - `avatar_old_military.glb` — الأفاتار العسكري القديم
  - `avatar_suit_walk.glb` — نسخة Walk فقط
  - `avatar_idle_temp.glb` — نسخة Idle مؤقتة

### طريقة تحديث الأفاتار (Mixamo → GLB)
1. حمّل `Idle.fbx` + `Walking.fbx` من mixamo.com (With Skin, FBX Binary, 30fps)
2. شغّل سكريبت Blender:
```bash
"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background --python D:/blend_merge2.py
```
3. السكريبت يدمج الـ animations ويصدر `avatar.glb`

## حدود الغرف
```ts
// الصالة الرئيسية
ROOM_BOUNDS_X = 7
ROOM_BOUNDS_Z = [-7, 7]

// غرفة المدير
MANAGER_ROOM_X = [8, 15.5]
MANAGER_ROOM_Z = [-6.5, 0.5]
MANAGER_DOOR_POSITION = Vector3(7.92, 0, -3)

// الخزنة
VAULT_POSITION = Vector3(15.2, 0, -6)

// الباب الرئيسي (LogoutDoor)
DOOR_POSITION = [0, 2.7, 7.92]
```

## الأكواد
| الباب | الكود الافتراضي | مصدر التحقق |
|-------|----------------|-------------|
| الباب الرئيسي | `1977` | API `/api/door-codes` |
| غرفة المدير | `0000` (4 أرقام فقط) | PostgreSQL `users.manager_code` |

## API Endpoints المهمة
```
GET  /api/vault-settings          # إعدادات الخزنة
POST /api/vault-settings          # حفظ الإعدادات
GET  /api/default-model           # الموديل الافتراضي
POST /api/default-model           # { modelName: string }
POST /api/auth/verify-manager-code  # { code: string }
GET  /api/door-codes              # { mainCode: string }
POST /api/chat                    # المحادثة مع الـ AI
```

## الموديلات المدعومة (VaultSettingsDialog)
- **مجانية**: Groq (Llama) · Gemini (Flash) · GLM (Flash)
- **مدفوعة**: GPT · Claude · Grok · Mistral
- **الحد الأقصى**: 3 موديلات لكل غرفة

## مشاكل محلولة
| المشكلة | الحل |
|---------|------|
| WebGL Context Lost | حذف أضواء زائدة + `flat` prop |
| صالة مظلمة | `flat` prop يوقف ACESFilmic |
| أفاتار بظهره | `AVATAR_ROTATION_Y = 0` (مش Math.PI) |
| animations مكسورة (تمثال) | استخدام Blender بدل fbx2gltf |
| كاميرا لا تتبع في غرفة المدير | `state.camera.position.set()` مع OrbitControls |

## قاعدة البيانات
```bash
# الاتصال
PGPASSWORD=123456 "C:/Program Files/PostgreSQL/18/bin/psql.exe" -h localhost -U postgres -d seesaw

# أهم الجداول
users: roomId, managerCode, ...
```

## أوامر مهمة
```bash
# تشغيل المشروع
cd D:/seesaw-main/seesaw-main
npm run dev

# بناء
npm run build

# فحص GLB
node D:/check_final.cjs

# تحويل FBX → GLB (Blender)
"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background --python D:/blend_merge2.py
```
