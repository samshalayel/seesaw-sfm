/**
 * defaultModel.ts — الموديل الافتراضي للمستخدمين الجدد، لكل تاير على حدة
 * المزوّد والموديل والمفتاح يحددها المدير من لوحة الإدارة وتُحفظ في app_settings،
 * لا شيء منها مكتوب في الكود.
 */
import { db } from "./db";
import { storage } from "./storage";
import { roomModels, rooms } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface DefaultModelConfig {
  enabled:  boolean;
  provider: string;   // اسم المزوّد كما في الخزنة: OpenRouter | Groq | Gemini | GLM | Mirai ...
  modelId:  string;
  alias:    string;
  apiKey:   string;
}

export const TIERS = ["free", "pro", "enterprise"] as const;
export const MASK = "••••••••";

const keyFor = (tier: string) => `default_model_${tier}`;
const EMPTY: DefaultModelConfig = { enabled: false, provider: "OpenRouter", modelId: "", alias: "", apiKey: "" };

export async function getDefaultModelConfig(tier: string): Promise<DefaultModelConfig> {
  try {
    const raw = await storage.getSetting(keyFor(tier));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveDefaultModelConfig(tier: string, input: Partial<DefaultModelConfig>): Promise<DefaultModelConfig> {
  const current = await getDefaultModelConfig(tier);
  const next: DefaultModelConfig = {
    enabled:  !!input.enabled,
    provider: (input.provider ?? current.provider).trim(),
    modelId:  (input.modelId ?? current.modelId).trim(),
    alias:    (input.alias ?? current.alias).trim(),
    // القناع أو الفراغ يعني "أبقِ المفتاح المحفوظ"
    apiKey:   !input.apiKey || input.apiKey === MASK ? current.apiKey : input.apiKey.trim(),
  };
  await storage.setSetting(keyFor(tier), JSON.stringify(next));

  // سماح التاير بهذا المزوّد، وإلا ترفض الخزنة حفظ الغرفة (403 على تايرز لا يشمل المزوّد)
  if (next.enabled && next.provider) {
    const map = await storage.getTierModels();
    const list = map[tier] ?? [];
    if (!list.some((m) => m.toLowerCase() === next.provider.toLowerCase())) {
      await storage.setTierModels({ ...map, [tier]: [...list, next.provider] });
    }
  }
  return next;
}

/** نسخة آمنة للعرض: المفتاح مقنّع */
export async function getAllDefaultModelsMasked(): Promise<Record<string, DefaultModelConfig & { hasKey: boolean }>> {
  const out: Record<string, DefaultModelConfig & { hasKey: boolean }> = {};
  for (const t of TIERS) {
    const c = await getDefaultModelConfig(t);
    out[t] = { ...c, apiKey: c.apiKey ? MASK : "", hasKey: !!c.apiKey };
  }
  return out;
}

/** يزرع موديل التاير الافتراضي في غرفة جديدة. لا يلمس غرفة فيها موديلات أصلاً. */
export async function seedDefaultModel(roomId: string, tier: string): Promise<boolean> {
  const cfg = await getDefaultModelConfig(tier);
  if (!cfg.enabled || !cfg.provider || !cfg.apiKey) return false;

  const existing = await db.select().from(roomModels).where(eq(roomModels.roomId, roomId));
  if (existing.length > 0) return false;

  await db.insert(roomModels).values({
    roomId,
    name: cfg.provider,
    alias: cfg.alias || cfg.modelId || cfg.provider,
    apiKey: cfg.apiKey,
    modelId: cfg.modelId,
    orderIndex: 0,
    roomAssignment: "main",
  });
  await db.update(rooms).set({ defaultModel: cfg.provider }).where(eq(rooms.roomId, roomId));
  console.log(`[DefaultModel] ${tier}: seeded ${cfg.provider}/${cfg.modelId} into ${roomId}`);
  return true;
}
