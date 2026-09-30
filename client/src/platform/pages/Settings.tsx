import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty, Button } from "../components/ui";

const MASK = "••••••••";

const PROVIDERS = [
  "Groq", "GPT", "Claude", "Mirai", "Gemini", "GLM",
  "Grok", "Mistral", "OpenRouter", "OpenCode", "HuggingFace", "v0", "Devin", "Other",
];

const ROOM_ASSIGNMENTS = [
  { v: "main",   l: "الصالة الرئيسية" },
  { v: "stage0", l: "S0 — المشكلة" },
  { v: "stage1", l: "S1 — المنتج" },
  { v: "hall",   l: "القاعة" },
  { v: "hall2",  l: "القاعة 2" },
];

const DOORS: Array<[string, string]> = [
  ["mainCode",    "الباب الرئيسي"],
  ["managerCode", "غرفة المدير"],
  ["stage0Code",  "المرحلة 0"],
  ["stage1Code",  "المرحلة 1"],
  ["hallCode",    "القاعة"],
  ["hall2Code",   "القاعة 2"],
  ["brACode",     "غرفة اجتماعات A"],
  ["brBCode",     "غرفة اجتماعات B"],
  ["brCCode",     "غرفة اجتماعات C"],
];

interface ModelConfig {
  id: string; name: string; alias?: string; apiKey: string;
  modelId?: string; systemPrompt?: string; roomAssignment?: string;
  isVoice?: boolean; isHidden?: boolean;
}
interface HumanMember {
  id: string; name: string; role: string;
  joinCode: string; roomAssignment: string;
}
interface Vault {
  company: { name: string; logo: string };
  loginBg?: string;
  doors: Record<string, string>;
  github: { token: string; owner: string; repo: string };
  clickup: { token: string; listId: string; assignee: string };
  sfm: { apiKey: string };
  huggingface?: { token: string };
  apidog?: { token: string };
  figma?: { token: string };
  vps?: { host: string; port: string; user: string; password: string; webRoot: string };
  whatsapp?: { instanceId: string; token: string; phone: string };
  agora?: { appId: string; appCertificate: string };
  agentRouter?: { key: string };
  humans: HumanMember[];
  models: ModelConfig[];
  hallWorkers: ModelConfig[];
  defaultModel: string;
  systemPrompt?: string;
  [k: string]: any;
}

const SECTIONS = [
  { id: "company",      label: "الشركة" },
  { id: "doors",        label: "الأبواب" },
  { id: "github",       label: "GitHub" },
  { id: "clickup",      label: "ClickUp" },
  { id: "vps",          label: "VPS" },
  { id: "models",       label: "الموديلات" },
  { id: "hallWorkers",  label: "عتّال المكتب" },
  { id: "instructions", label: "التعليمات" },
  { id: "humans",       label: "الفريق" },
  { id: "integrations", label: "تكاملات" },
  { id: "comms",        label: "الاتصال" },
] as const;

const field =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-slate-200 " +
  "outline-none transition-colors focus:border-cyan-400/50 focus:bg-cyan-400/[0.06] placeholder:text-slate-600";

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
const genId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function Field({
  label, value, onChange, type = "text", ltr = true, hint, placeholder, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; ltr?: boolean; hint?: string; placeholder?: string; maxLength?: number;
}) {
  const saved = value === MASK;
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-slate-400">{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        dir={ltr ? "ltr" : "rtl"}
        className={`${field} ${ltr ? "text-left font-mono" : ""}`}
      />
      {(hint || saved) && (
        <p className="mt-1 text-[11px] text-slate-600">
          {saved ? "محفوظ — اتركه كما هو للإبقاء عليه" : hint}
        </p>
      )}
    </div>
  );
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[12px] leading-relaxed text-slate-500">{children}</p>;
}

/** بطاقة موديل — تُستخدم للموديلات وعتّال المكتب */
function ModelCard({
  m, isDefault, onPatch, onRemove, onMakeDefault,
}: {
  m: ModelConfig; isDefault?: boolean;
  onPatch: (f: keyof ModelConfig, v: string) => void;
  onRemove: () => void; onMakeDefault?: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={PROVIDERS.includes(m.name) ? m.name : "Other"}
          onChange={(e) => onPatch("name", e.target.value)}
          className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-slate-200 outline-none"
        >
          {PROVIDERS.map((p) => <option key={p} value={p} className="bg-[#0a0f1a]">{p}</option>)}
        </select>

        {onMakeDefault && (isDefault ? (
          <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-300">★ افتراضي</span>
        ) : (
          <button onClick={onMakeDefault}
            className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300">
            اجعله افتراضياً
          </button>
        ))}

        <button onClick={onRemove}
          className="mr-auto rounded border border-red-400/35 bg-red-400/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-400/20">
          حذف
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الاسم الظاهر" ltr={false} value={m.alias ?? ""} onChange={(v) => onPatch("alias", v)} />
        <Field label="معرّف الموديل" value={m.modelId ?? ""} placeholder="claude-opus-5" onChange={(v) => onPatch("modelId", v)} />
        <div className="sm:col-span-2">
          <Field label="المفتاح" type="password" value={m.apiKey ?? ""} onChange={(v) => onPatch("apiKey", v)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[12px] font-semibold text-slate-400">تعليمات خاصة</label>
          <textarea
            value={m.systemPrompt ?? ""} rows={3} dir="rtl"
            onChange={(e) => onPatch("systemPrompt", e.target.value)}
            className={`${field} resize-y`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-slate-400">الغرفة</label>
          <select
            value={m.roomAssignment ?? "main"}
            onChange={(e) => onPatch("roomAssignment", e.target.value)}
            className={`${field} cursor-pointer`}
          >
            {ROOM_ASSIGNMENTS.map((r) => <option key={r.v} value={r.v} className="bg-[#0a0f1a]">{r.l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [section, setSection] = useState<string>("company");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/vault-settings");
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || typeof d !== "object" || d.error) flash("✕ تعذّر تحميل الإعدادات");
      else setVault(d);
    } catch { flash("✕ خطأ في الاتصال"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!vault) return;
    setSaving(true);
    try {
      const r = await apiFetch("/api/vault-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vault),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { flash("✓ تم الحفظ"); load(); }
      else flash("✕ " + (d.error || "فشل الحفظ"));
    } catch (e: any) { flash("✕ " + e.message); }
    setSaving(false);
  };

  const patch = (part: Partial<Vault>) => setVault((v) => (v ? { ...v, ...part } : v));

  const patchList = (key: "models" | "hallWorkers", i: number, f: keyof ModelConfig, val: string) =>
    setVault((v) => {
      if (!v) return v;
      const list = [...(v[key] ?? [])];
      list[i] = { ...list[i], [f]: val };
      return { ...v, [key]: list };
    });

  const removeFrom = (key: "models" | "hallWorkers", i: number) =>
    setVault((v) => (v ? { ...v, [key]: (v[key] ?? []).filter((_, n) => n !== i) } : v));

  const addTo = (key: "models" | "hallWorkers") =>
    setVault((v) =>
      v ? { ...v, [key]: [...(v[key] ?? []), { id: genId(key === "models" ? "model" : "hw"), name: "Groq", apiKey: "" }] } : v,
    );

  const patchHuman = (id: string, f: keyof HumanMember, val: string) =>
    setVault((v) => (v ? { ...v, humans: v.humans.map((h) => (h.id === id ? { ...h, [f]: val } : h)) } : v));

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}?humanCode=${code}`);
    setCopied(code);
    setTimeout(() => setCopied(""), 2000);
  };

  if (loading) return <><PageTitle title="الإعدادات" /><Card><Empty>جارٍ التحميل…</Empty></Card></>;
  if (!vault) return <><PageTitle title="الإعدادات" /><Card><Empty>تعذّر تحميل الإعدادات</Empty></Card></>;

  const vps = vault.vps ?? { host: "", port: "22", user: "root", password: "", webRoot: "/var/www" };
  const wa = vault.whatsapp ?? { instanceId: "", token: "", phone: "" };
  const agora = vault.agora ?? { appId: "", appCertificate: "" };

  return (
    <>
      <PageTitle
        title="الإعدادات"
        subtitle="كل الإعدادات محفوظة لكل غرفة على حدة"
        action={
          <div className="flex items-center gap-3">
            {msg && <span className={`text-[12px] ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</span>}
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? "…" : "حفظ"}</Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-lg border px-3.5 py-2 text-[12px] font-bold transition-colors ${
              section === s.id
                ? "border-cyan-400/50 bg-cyan-400/12 text-cyan-300"
                : "border-white/8 text-slate-500 hover:bg-white/5 hover:text-slate-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {section === "company" && (
          <div className="grid max-w-lg gap-4">
            <Field label="اسم الشركة" ltr={false} value={vault.company?.name ?? ""}
              onChange={(v) => patch({ company: { ...vault.company, name: v } })} />
            <Field label="رابط الشعار" placeholder="https://… أو data:image/…" value={vault.company?.logo ?? ""}
              onChange={(v) => patch({ company: { ...vault.company, logo: v } })} />
            {vault.company?.logo && (
              <img src={vault.company.logo} alt=""
                className="h-20 w-auto self-start rounded-lg border border-white/10 bg-white/5 object-contain p-2" />
            )}
            <Field label="خلفية شاشة الدخول" placeholder="https://…" value={vault.loginBg ?? ""}
              onChange={(v) => patch({ loginBg: v })} />
          </div>
        )}

        {section === "doors" && (
          <>
            <SectionNote>أكواد الدخول للغرف داخل الوضع ثلاثي الأبعاد — 4 أرقام لكل باب.</SectionNote>
            <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
              {DOORS.map(([k, label]) => (
                <Field key={k} label={label} maxLength={4} value={vault.doors?.[k] ?? "0000"}
                  onChange={(v) => patch({ doors: { ...vault.doors, [k]: v.replace(/\D/g, "") } })} />
              ))}
            </div>
          </>
        )}

        {section === "github" && (
          <div className="grid max-w-lg gap-4">
            <Field label="التوكن" type="password" value={vault.github?.token ?? ""}
              onChange={(v) => patch({ github: { ...vault.github, token: v } })} />
            <Field label="المالك (owner)" value={vault.github?.owner ?? ""}
              onChange={(v) => patch({ github: { ...vault.github, owner: v } })} />
            <Field label="المستودع (repo)" value={vault.github?.repo ?? ""}
              onChange={(v) => patch({ github: { ...vault.github, repo: v } })} />
          </div>
        )}

        {section === "clickup" && (
          <div className="grid max-w-lg gap-4">
            <Field label="التوكن" type="password" value={vault.clickup?.token ?? ""}
              onChange={(v) => patch({ clickup: { ...vault.clickup, token: v } })} />
            <Field label="معرّف القائمة (List ID)" value={vault.clickup?.listId ?? ""}
              onChange={(v) => patch({ clickup: { ...vault.clickup, listId: v } })} />
            <Field label="المسؤول (Assignee ID)" value={vault.clickup?.assignee ?? ""}
              hint="المراقب ينفّذ المهام المعيّنة لهذا المستخدم فقط"
              onChange={(v) => patch({ clickup: { ...vault.clickup, assignee: v } })} />
          </div>
        )}

        {section === "vps" && (
          <div className="grid max-w-lg gap-4">
            <Field label="المضيف (Host)" value={vps.host} onChange={(v) => patch({ vps: { ...vps, host: v } })} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="المنفذ" value={vps.port} onChange={(v) => patch({ vps: { ...vps, port: v } })} />
              <Field label="المستخدم" value={vps.user} onChange={(v) => patch({ vps: { ...vps, user: v } })} />
            </div>
            <Field label="كلمة السر" type="password" value={vps.password}
              onChange={(v) => patch({ vps: { ...vps, password: v } })} />
            <Field label="جذر الويب" value={vps.webRoot} onChange={(v) => patch({ vps: { ...vps, webRoot: v } })} />
          </div>
        )}

        {(section === "models" || section === "hallWorkers") && (() => {
          const key = section as "models" | "hallWorkers";
          const list = vault[key] ?? [];
          return (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[12px] text-slate-500">
                  {list.length} عنصر
                  {key === "models" && (
                    <> · الافتراضي: <span className="text-cyan-300">{vault.defaultModel || "—"}</span></>
                  )}
                </span>
                <Button variant="primary" onClick={() => addTo(key)}>+ إضافة</Button>
              </div>

              {list.length === 0 && <p className="py-6 text-center text-[13px] text-slate-500">لا توجد عناصر</p>}

              <div className="grid gap-4">
                {list.map((m, i) => (
                  <ModelCard
                    key={m.id ?? i}
                    m={m}
                    isDefault={key === "models" && vault.defaultModel === m.name}
                    onPatch={(f, v) => patchList(key, i, f, v)}
                    onRemove={() => removeFrom(key, i)}
                    onMakeDefault={key === "models" ? () => patch({ defaultModel: m.name }) : undefined}
                  />
                ))}
              </div>
            </>
          );
        })()}

        {section === "instructions" && (
          <div className="max-w-3xl">
            <SectionNote>
              تُحقن هذه التعليمات في كل محادثة مع الروبوتات في هذه الغرفة، قبل تعليمات الموديل الخاصة.
            </SectionNote>
            <textarea
              value={vault.systemPrompt ?? ""} rows={16} dir="rtl"
              onChange={(e) => patch({ systemPrompt: e.target.value })}
              className={`${field} resize-y leading-relaxed`}
            />
          </div>
        )}

        {section === "humans" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[12px] text-slate-500">{vault.humans?.length ?? 0} عضو</span>
              <Button
                variant="primary"
                onClick={() => patch({
                  humans: [...(vault.humans ?? []), {
                    id: Date.now().toString(36), name: "", role: "",
                    joinCode: genCode(), roomAssignment: "main",
                  }],
                })}
              >+ عضو</Button>
            </div>

            {(vault.humans ?? []).length === 0 && (
              <p className="py-6 text-center text-[13px] text-slate-500">لا يوجد أعضاء</p>
            )}

            <div className="grid gap-3">
              {(vault.humans ?? []).map((h) => (
                <div key={h.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="الاسم" ltr={false} value={h.name} onChange={(v) => patchHuman(h.id, "name", v)} />
                    <Field label="الدور" ltr={false} value={h.role} onChange={(v) => patchHuman(h.id, "role", v)} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[12px] font-semibold text-slate-400">الغرفة</label>
                      <select
                        value={h.roomAssignment}
                        onChange={(e) => patchHuman(h.id, "roomAssignment", e.target.value)}
                        className={`${field} cursor-pointer`}
                      >
                        {ROOM_ASSIGNMENTS.map((r) => <option key={r.v} value={r.v} className="bg-[#0a0f1a]">{r.l}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-slate-400">كود الانضمام</label>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2.5 font-mono text-[13px] text-cyan-300">
                          {h.joinCode}
                        </span>
                        <button onClick={() => patchHuman(h.id, "joinCode", genCode())} title="توليد كود جديد"
                          className="rounded-lg border border-white/10 px-2.5 py-2.5 text-[12px] text-slate-400 hover:text-slate-200">↻</button>
                        <button onClick={() => copyLink(h.joinCode)} title="نسخ رابط الدعوة"
                          className="rounded-lg border border-white/10 px-2.5 py-2.5 text-[12px] text-slate-400 hover:text-slate-200">
                          {copied === h.joinCode ? "✓" : "⧉"}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => patch({ humans: vault.humans.filter((x) => x.id !== h.id) })}
                      className="rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2.5 text-[12px] text-red-300 hover:bg-red-400/20"
                    >حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {section === "integrations" && (
          <div className="grid max-w-lg gap-4">
            <Field label="SFM API Key" type="password" value={vault.sfm?.apiKey ?? ""}
              onChange={(v) => patch({ sfm: { ...vault.sfm, apiKey: v } })} />
            <Field label="HuggingFace Token" type="password" value={vault.huggingface?.token ?? ""}
              onChange={(v) => patch({ huggingface: { token: v } })} />
            <Field label="APIdog Token" type="password" value={vault.apidog?.token ?? ""}
              onChange={(v) => patch({ apidog: { token: v } })} />
            <Field label="Figma Token" type="password" value={vault.figma?.token ?? ""}
              onChange={(v) => patch({ figma: { token: v } })} />
            <Field label="Agent Router Key" type="password" value={vault.agentRouter?.key ?? ""}
              onChange={(v) => patch({ agentRouter: { key: v } })} />
          </div>
        )}

        {section === "comms" && (
          <div className="grid max-w-lg gap-6">
            <div className="grid gap-4">
              <h3 className="text-[13px] font-bold text-slate-300">واتساب</h3>
              <Field label="Instance ID" value={wa.instanceId}
                onChange={(v) => patch({ whatsapp: { ...wa, instanceId: v } })} />
              <Field label="التوكن" type="password" value={wa.token}
                onChange={(v) => patch({ whatsapp: { ...wa, token: v } })} />
              <Field label="رقم الهاتف" placeholder="+970…" value={wa.phone}
                onChange={(v) => patch({ whatsapp: { ...wa, phone: v } })} />
            </div>

            <div className="grid gap-4 border-t border-white/5 pt-6">
              <h3 className="text-[13px] font-bold text-slate-300">Agora — المحادثة الصوتية</h3>
              <Field label="App ID" type="password" value={agora.appId}
                onChange={(v) => patch({ agora: { ...agora, appId: v } })} />
              <Field label="App Certificate" type="password" value={agora.appCertificate}
                onChange={(v) => patch({ agora: { ...agora, appCertificate: v } })} />
            </div>
          </div>
        )}
      </Card>

      <p className="mt-4 text-[11px] text-slate-600">
        الحقول التي تظهر فيها {MASK} محفوظة مسبقاً — تُرسل كما هي ولا تُستبدل ما لم تُغيّرها.
      </p>
    </>
  );
}
