import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty, Button } from "../components/ui";

interface UserRow {
  id: number; username: string; roomId: string;
  role: string; status: string; tier: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: "نشط",   cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  suspended: { label: "موقوف", cls: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  cancelled: { label: "ملغى",  cls: "border-red-400/30 bg-red-400/10 text-red-300" },
};

export function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", tier: "free", role: "user", status: "active" });
  const [pwFor, setPwFor] = useState<UserRow | null>(null);
  const [pw, setPw] = useState("");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/admin/users");
      const d = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(d)) { flash("✕ تعذّر التحميل"); setUsers([]); }
      else setUsers(d);
    } catch { flash("✕ خطأ في الاتصال"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = async (u: UserRow, body: Record<string, string>, ok: string) => {
    try {
      const r = await apiFetch(`/api/admin/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) { flash(ok); load(); } else flash("✕ فشل التعديل");
    } catch { flash("✕ خطأ"); }
  };

  const setStatus = (u: UserRow, status: string) => {
    if (status !== "active" && !confirm(`تغيير حالة "${u.username}" إلى ${STATUS_META[status].label}؟ لن يستطيع الدخول.`)) return;
    patch(u, { status }, `✓ ${STATUS_META[status].label}`);
  };

  const create = async () => {
    if (!form.username.trim() || form.password.length < 6) { flash("✕ الاسم مطلوب وكلمة السر 6 أحرف"); return; }
    try {
      const r = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        flash("✓ تم الإنشاء");
        setAdding(false);
        setForm({ username: "", password: "", tier: "free", role: "user", status: "active" });
        load();
      } else flash("✕ " + (d.error || "فشل"));
    } catch { flash("✕ خطأ"); }
  };

  const changePw = async () => {
    if (!pwFor || pw.length < 6) { flash("✕ كلمة السر 6 أحرف على الأقل"); return; }
    try {
      const r = await apiFetch(`/api/admin/users/${pwFor.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) { flash("✓ تم التغيير"); setPwFor(null); setPw(""); }
      else flash("✕ فشل");
    } catch { flash("✕ خطأ"); }
  };

  const field = "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-slate-200 outline-none focus:border-cyan-400/50";
  const pill = "rounded border bg-white/5 border-white/10 px-2 py-1 text-[11px] text-slate-300 outline-none cursor-pointer";

  return (
    <>
      <PageTitle
        title="المستخدمون"
        subtitle="الحالة تُطبَّق فوراً — الموقوف لا يستطيع الدخول"
        action={
          <div className="flex items-center gap-3">
            {msg && <span className={`text-[12px] ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</span>}
            <Button variant="primary" onClick={() => setAdding(true)}>+ مستخدم</Button>
          </div>
        }
      />

      <Card>
        {loading && <Empty>جارٍ التحميل…</Empty>}
        {!loading && users.length === 0 && <Empty>لا يوجد مستخدمون</Empty>}

        {!loading && users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2.5 border-b border-white/5 px-5 py-3.5 last:border-0">
            <span className="text-[13px] font-semibold text-slate-200">{u.username}</span>
            {u.role === "admin" && (
              <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-300">مدير</span>
            )}
            <span className="font-mono text-[10px] text-slate-600">{u.roomId.slice(0, 18)}…</span>

            <div className="mr-auto flex items-center gap-2">
              <select
                value={u.status || "active"}
                onChange={(e) => setStatus(u, e.target.value)}
                className={`${STATUS_META[u.status]?.cls || STATUS_META.active.cls} rounded border px-2 py-1 text-[11px] outline-none cursor-pointer`}
              >
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#0a0f1a] text-slate-200">{v.label}</option>
                ))}
              </select>

              <select
                value={u.tier || "free"}
                onChange={(e) => patch(u, { tier: e.target.value }, `✓ ${e.target.value}`)}
                className={pill}
              >
                {["free", "pro", "enterprise"].map((t) => (
                  <option key={t} value={t} className="bg-[#0a0f1a]">{t}</option>
                ))}
              </select>

              <button
                onClick={() => { setPwFor(u); setPw(""); }}
                title="تغيير كلمة السر"
                className="rounded border border-blue-400/35 bg-blue-400/10 px-2 py-1 text-[11px] text-blue-300 hover:bg-blue-400/20"
              >
                🔑
              </button>
            </div>
          </div>
        ))}
      </Card>

      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
             onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}>
          <div dir="rtl" className="w-full max-w-sm rounded-2xl border border-emerald-400/25 bg-[#0a0f1a] p-7 shadow-2xl">
            <h2 className="mb-5 text-[14px] font-extrabold text-emerald-300">مستخدم جديد</h2>
            <div className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-[12px] text-slate-400">اسم المستخدم</label>
                <input autoFocus value={form.username} dir="ltr"
                  onChange={(e) => setForm({ ...form, username: e.target.value })} className={`${field} text-left`} />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] text-slate-400">كلمة السر (6 أحرف على الأقل)</label>
                <input type="password" value={form.password} dir="ltr"
                  onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${field} text-left`} />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {([["role", ["user", "admin"]], ["tier", ["free", "pro", "enterprise"]]] as const).map(([k, opts]) => (
                  <div key={k} className={k === "tier" ? "col-span-2" : ""}>
                    <label className="mb-1.5 block text-[12px] text-slate-400">{k === "role" ? "الدور" : "التايرز"}</label>
                    <select value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={field}>
                      {opts.map((o) => <option key={o} value={o} className="bg-[#0a0f1a]">{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex gap-2.5">
              <Button variant="primary" onClick={create}>إنشاء</Button>
              <Button onClick={() => setAdding(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {pwFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
             onClick={(e) => { if (e.target === e.currentTarget) setPwFor(null); }}>
          <div dir="rtl" className="w-full max-w-sm rounded-2xl border border-blue-400/25 bg-[#0a0f1a] p-7 shadow-2xl">
            <h2 className="text-[14px] font-extrabold text-blue-300">تغيير كلمة السر</h2>
            <p className="mb-5 mt-1 text-[12px] text-slate-500">{pwFor.username}</p>
            <input type="password" autoFocus value={pw} dir="ltr"
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") changePw(); }}
              className={`${field} text-left`} />
            <div className="mt-6 flex gap-2.5">
              <Button variant="primary" onClick={changePw}>تغيير</Button>
              <Button onClick={() => setPwFor(null)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
