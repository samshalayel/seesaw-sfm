/**
 * taskPlanner.ts — محرك انتقاء المهام
 *
 * ثلاث طبقات:
 *  1) حتمية: أولوية ClickUp، بادئة رقمية في الاسم، orderindex، ثم الاسم
 *  2) AI: يقرأ كل مهام القائمة (المكتملة أيضاً) ويستنتج الاعتماديات غير المكتوبة
 *  3) قيود صلبة: اعتمادية ClickUp الصريحة لا يكسرها الـAI، ومهمة لا تُنفَّذ قبل متطلّباتها
 *
 * إن فشل الـAI يبقى الترتيب الحتمي — المحرك لا يوقف المراقب أبداً.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getModels } from "./vaultStore";
import { getListTasksForPlanning } from "./clickup";

export interface PlanInput {
  id: string;
  name: string;
  priority?: string | null;
  orderindex?: any;
  order_index?: any;
}

export interface PlanResult {
  ordered: string[];                  // معرّفات المهام بالترتيب النهائي
  blocked: Record<string, string>;    // مهام مؤجلة + السبب
  reasons: Record<string, string>;    // سبب موقع كل مهمة
  names: Record<string, string>;      // أسماء للعرض
  source: "ai" | "deterministic";
  model?: string;
  at: string;
}

const PRIORITY_RANK: Record<string, number> = { urgent: 1, high: 2, normal: 3, low: 4 };
const DONE = new Set(["complete", "completed", "closed", "done"]);

const planCache = new Map<string, PlanResult>();
let lastPlan: PlanResult | null = null;
export const getLastPlan = () => lastPlan;

/** الطبقة 1 — ترتيب حتمي */
export function deterministicSort<T extends PlanInput>(tasks: T[]): T[] {
  const prefix = (t: T) => {
    const m = /^\s*(\d+)([a-z]?)/i.exec(t.name ?? "");
    return m ? ([parseInt(m[1], 10), m[2].toLowerCase()] as const) : null;
  };
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_RANK[(a.priority || "").toLowerCase()] ?? 5;
    const pb = PRIORITY_RANK[(b.priority || "").toLowerCase()] ?? 5;
    const ka = prefix(a), kb = prefix(b);
    if (ka && kb) {
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
    } else if (ka || kb) return ka ? -1 : 1;
    if (pa !== pb) return pa - pb;
    const oa = parseFloat(a.orderindex ?? a.order_index ?? "0") || 0;
    const ob = parseFloat(b.orderindex ?? b.order_index ?? "0") || 0;
    if (oa !== ob) return oa - ob;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

/** يسأل أول موديل شغّال في الغرفة — يفضّل المجاني/الوسيط */
async function askModel(roomId: string | undefined, system: string, user: string): Promise<{ text: string; model: string }> {
  const models = (await getModels(roomId)).filter((m) => m.apiKey && m.apiKey !== "••••••••");
  const rank = (n: string) => {
    const x = n.toLowerCase();
    return x.includes("openrouter") ? 0 : x.includes("smartcloud") ? 1 : x.includes("groq") ? 2 : x.includes("mirai") ? 3 : x.includes("gemini") ? 4 : 9;
  };
  const candidates = models.filter((m) => rank(m.name) < 9).sort((a, b) => rank(a.name) - rank(b.name));
  let lastErr = "no usable model";

  for (const m of candidates) {
    const n = m.name.toLowerCase();
    try {
      if (n.includes("smartcloud")) {
        const cl = new Anthropic({ apiKey: m.apiKey, baseURL: "https://api.mwapi.dev" });
        const r = await cl.messages.create({
          model: m.modelId || "claude-sonnet-4-20250514", max_tokens: 1500, system,
          messages: [{ role: "user", content: user }],
        });
        const text = r.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
        return { text, model: `${m.name}:${m.modelId || ""}` };
      }
      const base = n.includes("openrouter") ? "https://openrouter.ai/api/v1"
        : n.includes("groq") ? "https://api.groq.com/openai/v1"
        : n.includes("mirai") ? "https://api.miraiapi.com/v1"
        : "https://generativelanguage.googleapis.com/v1beta/openai/";
      const cl = new OpenAI({ apiKey: m.apiKey, baseURL: base });
      const r = await cl.chat.completions.create({
        model: m.modelId || "gemini-2.0-flash", max_tokens: 1500,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      });
      return { text: r.choices[0]?.message?.content || "", model: `${m.name}:${m.modelId || ""}` };
    } catch (e: any) {
      lastErr = `${m.name}: ${(e.message || "").slice(0, 80)}`;
    }
  }
  throw new Error(lastErr);
}

const SYSTEM = `You are a delivery planner for a software project. You get a list of tasks (some already done, some pending).
Decide the best execution order for the PENDING tasks only, so that every task comes after the work it needs
(infrastructure/setup before features, data layer before API, API before UI, UI before end-to-end tests).
Respect priority only when it does not break a dependency. Reply with JSON ONLY:
{"order":[{"id":"<task id>","why":"<max 12 words>"}],"blocked":[{"id":"<task id>","needs":"<what is missing>"}]}
Put in "blocked" only tasks whose prerequisite is neither done nor in the pending list. Use every pending id exactly once across both arrays.`;

/**
 * يبني خطة التنفيذ. candidates = المهام المؤهلة للتشغيل الآن.
 */
export async function planTasks(
  candidates: PlanInput[],
  opts: { roomId?: string; listId?: string },
): Promise<PlanResult> {
  const base = deterministicSort(candidates);
  const names = Object.fromEntries(candidates.map((c) => [c.id, c.name]));
  const finish = (r: PlanResult) => { r.names = names; lastPlan = r; return r; };
  const deterministic = (why: string): PlanResult => finish({
    ordered: base.map((t) => t.id),
    blocked: {},
    names,
    reasons: Object.fromEntries(base.map((t, i) => [t.id, i === 0 ? why : ""])),
    source: "deterministic",
    at: new Date().toISOString(),
  });

  if (candidates.length <= 1) return deterministic("مهمة وحيدة");

  try {
    const all = opts.listId ? await getListTasksForPlanning(opts.listId, opts.roomId) : [];
    // المفتاح يشمل عدد المنجَز: اكتمال متطلّب يفتح المهام المؤجلة فتُخطَّط من جديد
    const key = [...candidates.map((c) => c.id)].sort().join(",") + "|" + all.filter((t) => DONE.has(t.status)).length;
    const cached = planCache.get(key);
    if (cached) return finish(cached);

    const byId = new Map(all.map((t) => [t.id, t]));
    const pendingIds = new Set(candidates.map((c) => c.id));

    const doneList = all.filter((t) => DONE.has(t.status)).map((t) => `- [DONE] ${t.name}`);
    const pendList = base.map((c) => {
      const full = byId.get(c.id);
      const deps = (full?.dependsOn || []).map((d: string) => byId.get(d)?.name || d).join("; ");
      return `- id=${c.id} | ${c.name} | priority=${c.priority || "none"}${deps ? ` | depends_on: ${deps}` : ""}` +
        (full?.description ? `\n    desc: ${full.description.replace(/\s+/g, " ").slice(0, 220)}` : "");
    });

    const { text, model } = await askModel(
      opts.roomId, SYSTEM,
      `DONE TASKS:\n${doneList.join("\n") || "(none)"}\n\nPENDING TASKS:\n${pendList.join("\n")}`,
    );

    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const aiOrder: string[] = [];
    const reasons: Record<string, string> = {};
    for (const o of json.order || []) {
      if (pendingIds.has(o.id) && !aiOrder.includes(o.id)) { aiOrder.push(o.id); reasons[o.id] = o.why || ""; }
    }
    // أي مهمة أغفلها الـAI تُلحق بترتيبها الحتمي — لا تضيع مهمة
    for (const t of base) if (!aiOrder.includes(t.id)) aiOrder.push(t.id);

    // الطبقة 3 — اعتمادية ClickUp الصريحة قيد صلب: المتطلّب المعلّق أولاً
    const blocked: Record<string, string> = {};
    for (const b of json.blocked || []) if (pendingIds.has(b.id)) blocked[b.id] = String(b.needs || "").slice(0, 120);

    const placed: string[] = [];
    const visit = (id: string, stack = new Set<string>()) => {
      if (placed.includes(id) || stack.has(id)) return;
      stack.add(id);
      for (const dep of byId.get(id)?.dependsOn || []) if (pendingIds.has(dep)) visit(dep, stack);
      placed.push(id);
    };
    for (const id of aiOrder) visit(id);

    const ordered = placed.filter((id) => !blocked[id]);
    const result: PlanResult = { ordered, blocked, reasons, names, source: "ai", model, at: new Date().toISOString() };
    planCache.set(key, result);
    if (planCache.size > 20) planCache.delete(planCache.keys().next().value as string);
    return finish(result);
  } catch (e: any) {
    console.error("[TaskPlanner] AI planning failed, using deterministic order:", e.message);
    return deterministic("ترتيب حتمي — تعذّر تخطيط الـAI");
  }
}

export function clearPlanCache() { planCache.clear(); lastPlan = null; }
