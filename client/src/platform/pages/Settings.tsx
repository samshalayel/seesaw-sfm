import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty, Button } from "../components/ui";

const MASK = "••••••••";

const PROVIDERS = [
  "Groq", "GPT", "Claude", "Mirai", "Gemini", "GLM",
  "Grok", "Mistral", "OpenRouter", "OpenCode", "HuggingFace", "Other",
];

interface ModelConfig {
  id: string; name: string; alias?: string;
  apiKey: string; modelId?: string; systemPrompt?: string;
}

interface Vault {
  company: { name: string; logo: string };
  github: { token: string; owner: string; repo: string };
  clickup: { token: string; listId: string; assignee: string };
  vps?: { host: string; port: string; user: string; password: string; webRoot: string };
  models: ModelConfig[];
  defaultModel: string;
  [k: string]: any;
}

const SECTIONS = [
  { id: "company", label: "الشركة" },
  { id: "github",  label: "GitHub" },
  { id: "clickup", label: "ClickUp" },
  { id: "vps",     label: "VPS" },
  { id: "models",  label: "الموديلات" },
] as const;

const field =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-slate-200 " +
  "outline-none transition-colors focus:border-cyan-400/50 focus:bg-cyan-400/[0.06] placeholder:text-slate-600";

function Field({
  label, value, onChange, type = "text", ltr = true, hint, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; ltr?: boolean; hint?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        dir={ltr ? "ltr" : "rtl"}
        className={`${field} ${ltr ? "text-left font-mono" : ""}`}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

export function Settings() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [section, setSection] = useState<string>("company");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/vault-settings");
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || typeof d !== "object") flash("✕ تعذّر تحميل الإعدادات");
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

  const patchModel = (i: number, f: keyof ModelConfig, val: string) =>
    setVault((v) => {
      if (!v) return v;
      const models = [...v.models];
      models[i] = { ...models[i], [f]: val };
      return { ...v, models };
    });

  if (loading) return <><PageTitle title="الإعدادات" /><Card><Empty>جارٍ التحميل…</Empty></Card></>;
  if (!vault) return <><PageTitle title="الإعدادات" /><Card><Empty>تعذّر تحميل الإعدادات</Empty></Card></>;

  const vps = vault.vps ?? { host: "", port: "22", user: "root", password: "", webRoot: "/var/www" };

  return (
    <>
      <PageTitle
        title="الإعدادات"
        subtitle="المفاتيح محفوظة لكل غرفة على حدة"
        action={
          <div className="flex items-center gap-3">
            {msg && (
              <span className={`text-[12px] ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</span>
            )}
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "…" : "حفظ"}
            </Button>
          </div>
        }
      />

      {/* section tabs */}
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
            <Field
              label="اسم الشركة" ltr={false}
              value={vault.company?.name ?? ""}
              onChange={(v) => patch({ company: { ...vault.company, name: v } })}
            />
            <Field
              label="رابط الشعار" placeholder="https://… أو data:image/…"
              value={vault.company?.logo ?? ""}
              onChange={(v) => patch({ company: { ...vault.company, logo: v } })}
            />
            {vault.company?.logo && (
              <img
                src={vault.company.logo}
                alt=""
                className="h-20 w-auto self-start rounded-lg border border-white/10 bg-white/5 p-2 object-contain"
              />
            )}
          </div>
        )}

        {section === "github" && (
          <div className="grid max-w-lg gap-4">
            <Field
              label="التوكن" type="password"
              value={vault.github?.token ?? ""}
              hint={vault.github?.token === MASK ? "محفوظ — اتركه كما هو للإبقاء عليه" : undefined}
              onChange={(v) => patch({ github: { ...vault.github, token: v } })}
            />
            <Field label="المالك (owner)" value={vault.github?.owner ?? ""}
              onChange={(v) => patch({ github: { ...vault.github, owner: v } })} />
            <Field label="المستودع (repo)" value={vault.github?.repo ?? ""}
              onChange={(v) => patch({ github: { ...vault.github, repo: v } })} />
          </div>
        )}

        {section === "clickup" && (
          <div className="grid max-w-lg gap-4">
            <Field
              label="التوكن" type="password"
              value={vault.clickup?.token ?? ""}
              hint={vault.clickup?.token === MASK ? "محفوظ — اتركه كما هو للإبقاء عليه" : undefined}
              onChange={(v) => patch({ clickup: { ...vault.clickup, token: v } })}
            />
            <Field label="معرّف القائمة (List ID)" value={vault.clickup?.listId ?? ""}
              onChange={(v) => patch({ clickup: { ...vault.clickup, listId: v } })} />
            <Field label="المسؤول (Assignee ID)" value={vault.clickup?.assignee ?? ""}
              hint="المراقب ينفّذ المهام المعيّنة لهذا المستخدم فقط"
              onChange={(v) => patch({ clickup: { ...vault.clickup, assignee: v } })} />
          </div>
        )}

        {section === "vps" && (
          <div className="grid max-w-lg gap-4">
            <Field label="المضيف (Host)" value={vps.host}
              onChange={(v) => patch({ vps: { ...vps, host: v } })} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="المنفذ" value={vps.port}
                onChange={(v) => patch({ vps: { ...vps, port: v } })} />
              <Field label="المستخدم" value={vps.user}
                onChange={(v) => patch({ vps: { ...vps, user: v } })} />
            </div>
            <Field
              label="كلمة السر" type="password" value={vps.password}
              hint={vps.password === MASK ? "محفوظة — اتركها كما هي للإبقاء عليها" : undefined}
              onChange={(v) => patch({ vps: { ...vps, password: v } })}
            />
            <Field label="جذر الويب" value={vps.webRoot}
              onChange={(v) => patch({ vps: { ...vps, webRoot: v } })} />
          </div>
        )}

        {section === "models" && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-500">
                {vault.models?.length ?? 0} موديل · الافتراضي:{" "}
                <span className="text-cyan-300">{vault.defaultModel || "—"}</span>
              </span>
            </div>

            {(vault.models ?? []).length === 0 && (
              <p className="py-6 text-center text-[13px] text-slate-500">لا توجد موديلات</p>
            )}

            {(vault.models ?? []).map((m, i) => (
              <div key={m.id ?? i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <select
                    value={PROVIDERS.includes(m.name) ? m.name : "Other"}
                    onChange={(e) => patchModel(i, "name", e.target.value)}
                    className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-slate-200 outline-none"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p} className="bg-[#0a0f1a]">{p}</option>
                    ))}
                  </select>

                  {vault.defaultModel === m.name ? (
                    <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-300">
                      ★ افتراضي
                    </span>
                  ) : (
                    <button
                      onClick={() => patch({ defaultModel: m.name })}
                      className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300"
                    >
                      اجعله افتراضياً
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="الاسم الظاهر" ltr={false}
                    value={m.alias ?? ""}
                    onChange={(v) => patchModel(i, "alias", v)}
                  />
                  <Field
                    label="معرّف الموديل"
                    value={m.modelId ?? ""}
                    placeholder="claude-opus-5"
                    onChange={(v) => patchModel(i, "modelId", v)}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="المفتاح" type="password"
                      value={m.apiKey ?? ""}
                      hint={m.apiKey === MASK ? "محفوظ — اتركه كما هو للإبقاء عليه" : undefined}
                      onChange={(v) => patchModel(i, "apiKey", v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-4 text-[11px] text-slate-600">
        الحقول التي تظهر فيها {MASK} محفوظة مسبقاً — لا تُرسل مجدداً ما لم تُغيّرها.
      </p>
    </>
  );
}
