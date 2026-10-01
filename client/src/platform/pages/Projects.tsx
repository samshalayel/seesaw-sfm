import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty, Button } from "../components/ui";

interface Project { projectKey: string; name: string }

export function Projects() {
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ projectKey: "", name: "" });
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/projects");
      const d = await r.json();
      setProjects(Array.isArray(d) ? d : []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const key = form.projectKey.trim().toUpperCase();
    if (!key) { setErr("رمز المشروع مطلوب"); return; }
    if (key.length > 6) { setErr("الرمز 6 أحرف كحد أقصى"); return; }
    setErr("");
    try {
      const r = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectKey: key, name: form.name.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d?.error || "تعذّر الإنشاء"); return; }
      setAdding(false);
      setForm({ projectKey: "", name: "" });
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none focus:border-cyan-500 focus:bg-cyan-50";

  return (
    <>
      <PageTitle
        title="المشاريع"
        subtitle="كل مشروع يمر بمراحل المنهجية الثماني"
        action={<Button variant="primary" onClick={() => setAdding(true)}>+ مشروع</Button>}
      />

      <Card>
        {loading && <Empty>جارٍ التحميل…</Empty>}
        {!loading && projects.length === 0 && <Empty>لا توجد مشاريع — أنشئ أول مشروع</Empty>}

        {!loading && projects.map((p) => (
          <button
            key={p.projectKey}
            onClick={() => nav(`/projects/${p.projectKey}`)}
            className="flex w-full items-center gap-3 border-b border-slate-200 px-5 py-4 text-right last:border-0 hover:bg-slate-50"
          >
            <span className="rounded border border-cyan-300 bg-cyan-50 px-2 py-0.5 font-mono text-[11px] text-cyan-700">
              {p.projectKey}
            </span>
            <span className="text-[13px] text-slate-700">{p.name || "بلا اسم"}</span>
            <span className="mr-auto text-slate-400">‹</span>
          </button>
        ))}
      </Card>

      {adding && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}
        >
          <div dir="rtl" className="w-full max-w-sm rounded-2xl border border-cyan-300 bg-white p-7 shadow-2xl">
            <h2 className="mb-5 text-[14px] font-extrabold text-cyan-700">مشروع جديد</h2>

            <label className="mb-1.5 block text-[12px] font-semibold text-slate-500">
              الرمز (حتى 6 أحرف)
            </label>
            <input
              value={form.projectKey}
              autoFocus
              onChange={(e) => setForm({ ...form, projectKey: e.target.value.toUpperCase() })}
              className={`${field} mb-4 text-left font-mono`}
              dir="ltr"
            />

            <label className="mb-1.5 block text-[12px] font-semibold text-slate-500">الاسم</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              className={field}
            />

            {err && <p className="mt-3 text-[12px] text-red-600">{err}</p>}

            <div className="mt-6 flex gap-2.5">
              <Button variant="primary" onClick={create}>إنشاء</Button>
              <Button onClick={() => setAdding(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
