import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty, Button, Stat } from "../components/ui";

interface TriggerLog {
  id: string; taskId: string; taskName: string;
  status: string; startedAt?: string; error?: string;
}
interface Config {
  enabled: boolean; watchUserId: number | null; intervalMinutes: number;
  robotId: string; robotIds?: string[];
  watchStatuses: string[]; doneStatus: string;
}
interface Member { id: number; username: string; email?: string }

const ROBOTS = [
  { id: "robot-1", label: "GPT-4o" },
  { id: "robot-2", label: "Claude API" },
  { id: "robot-3", label: "Claude CLI 🆓" },
  { id: "robot-4", label: "Gemini ⚡" },
  { id: "robot-5", label: "Devin 🤖" },
  { id: "robot-6", label: "AgentRouter 🔀" },
];

const STATUS_TONE: Record<string, string> = {
  done:    "border-emerald-300 bg-emerald-50 text-emerald-700",
  success: "border-emerald-300 bg-emerald-50 text-emerald-700",
  running: "border-cyan-300 bg-cyan-50 text-cyan-700",
  failed:  "border-red-300 bg-red-50 text-red-700",
  error:   "border-red-300 bg-red-50 text-red-700",
};

const field =
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-slate-700 " +
  "outline-none transition-colors focus:border-cyan-500";

export function Monitor() {
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [selUser, setSelUser] = useState<number | null>(null);
  const [interval, setIntervalMin] = useState(5);
  const [robot, setRobot] = useState("robot-1");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const loadData = async (withMembers = false) => {
    try {
      const [c, l] = await Promise.all([
        apiFetch("/api/auto-trigger/config").then((r) => r.json()).catch(() => null),
        apiFetch("/api/auto-trigger/logs").then((r) => r.json()).catch(() => []),
      ]);
      if (c && typeof c === "object" && !c.error) {
        setConfig(c);
        if (c.watchUserId) setSelUser(c.watchUserId);
        if (c.intervalMinutes) setIntervalMin(c.intervalMinutes);
        if (c.robotId) setRobot(c.robotId);
      }
      setLogs(Array.isArray(l) ? l : []);
    } catch { }

    if (withMembers) {
      try {
        const r = await apiFetch("/api/clickup/members");
        const d = await r.json().catch(() => null);
        if (Array.isArray(d)) setMembers(d);
        else flash("✕ تعذّر جلب أعضاء ClickUp — تحقق من التوكن");
      } catch { flash("✕ تعذّر الاتصال بـ ClickUp"); }
    }
  };

  useEffect(() => { (async () => { await loadData(true); setLoading(false); })(); }, []);

  const start = async () => {
    if (!selUser) { flash("✕ اختر عضو الفريق أولاً"); return; }
    setBusy(true);
    try {
      const r = await apiFetch("/api/auto-trigger/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selUser, intervalMinutes: interval, robotId: robot, robotIds: [robot] }),
      });
      if (r.ok) flash("✓ المراقب يعمل"); else flash("✕ فشل التشغيل");
      await loadData();
    } catch (e: any) { flash("✕ " + e.message); }
    setBusy(false);
  };

  const stop = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/auto-trigger/stop", { method: "POST" });
      if (r.ok) flash("✓ تم الإيقاف"); else flash("✕ فشل الإيقاف");
      await loadData();
    } catch (e: any) { flash("✕ " + e.message); }
    setBusy(false);
  };

  const scanNow = async () => {
    setBusy(true);
    flash("⏳ جارٍ الفحص…");
    try {
      const r = await apiFetch("/api/auto-trigger/scan", { method: "POST" });
      if (r.ok) flash("✓ تم الفحص"); else flash("✕ فشل الفحص");
      await loadData();
    } catch (e: any) { flash("✕ " + e.message); }
    setBusy(false);
  };

  const running = !!config?.enabled;
  const failed = logs.filter((l) => /fail|error/i.test(l.status)).length;

  return (
    <>
      <PageTitle
        title="المراقب"
        subtitle="ينفّذ مهام ClickUp تلقائياً عبر الوكلاء"
        action={
          <div className="flex items-center gap-3">
            {msg && (
              <span className={`text-[12px] ${msg.startsWith("✓") ? "text-emerald-600" : msg.startsWith("⏳") ? "text-cyan-400" : "text-red-600"}`}>
                {msg}
              </span>
            )}
            <Button onClick={() => loadData()} disabled={busy}>تحديث</Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="الحالة" value={running ? "يعمل" : "متوقف"} tone={running ? "green" : "amber"} />
        <Stat label="الفاصل (دقيقة)" value={config?.intervalMinutes ?? "—"} />
        <Stat label="سجلات" value={logs.length} />
        <Stat label="فشل" value={failed} tone={failed ? "amber" : "cyan"} />
      </div>

      {/* ── التحكم ── */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-[13px] font-bold text-slate-700">التشغيل</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-slate-500">راقب مهام</label>
            <select
              value={selUser ?? ""}
              onChange={(e) => setSelUser(Number(e.target.value) || null)}
              disabled={running}
              className={`${field} w-full cursor-pointer disabled:opacity-50`}
            >
              <option value="" className="bg-white">اختر عضو الفريق</option>
              {members.map((m) => (
                <option key={m.id} value={m.id} className="bg-white">{m.username || m.email}</option>
              ))}
            </select>
            {members.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-700">لا يوجد أعضاء — تحقق من توكن ClickUp</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-slate-500">فحص كل (دقيقة)</label>
            <input
              type="number" min={1} max={60} value={interval}
              onChange={(e) => setIntervalMin(Number(e.target.value) || 1)}
              disabled={running}
              className={`${field} w-full disabled:opacity-50`}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-slate-500">الموديل</label>
            <select
              value={robot}
              onChange={(e) => setRobot(e.target.value)}
              disabled={running}
              className={`${field} w-full cursor-pointer disabled:opacity-50`}
            >
              {ROBOTS.map((r) => (
                <option key={r.id} value={r.id} className="bg-white">{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {running ? (
            <Button variant="danger" onClick={stop} disabled={busy}>■ إيقاف</Button>
          ) : (
            <Button variant="primary" onClick={start} disabled={busy || !selUser}>▶ تشغيل</Button>
          )}
          <Button onClick={scanNow} disabled={busy}>⟳ فحص الآن</Button>
        </div>

        {running && (
          <p className="mt-4 text-[11px] text-slate-500">
            يراقب الحالات: {config?.watchStatuses?.join("، ")} · عند الانتهاء: {config?.doneStatus}
            {config?.watchUserId && <> · المسؤول: {config.watchUserId}</>}
          </p>
        )}
      </Card>

      {/* ── السجل ── */}
      <Card>
        <div className="border-b border-slate-200 px-5 py-3.5 text-[13px] font-bold text-slate-700">
          سجل التنفيذ
        </div>

        {loading && <Empty>جارٍ التحميل…</Empty>}
        {!loading && logs.length === 0 && <Empty>لا توجد سجلات</Empty>}

        {!loading && logs.map((l) => (
          <div key={l.id} className="border-b border-slate-200 px-5 py-3.5 last:border-0">
            <div className="flex items-center gap-3">
              <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${
                STATUS_TONE[l.status?.toLowerCase()] || "border-slate-300 bg-slate-100 text-slate-500"
              }`}>
                {l.status}
              </span>
              <span className="truncate text-[12px] text-slate-700">{l.taskName}</span>
              {l.startedAt && (
                <span className="mr-auto shrink-0 text-[11px] text-slate-400">
                  {new Date(l.startedAt).toLocaleTimeString("ar")}
                </span>
              )}
            </div>
            {l.error && <p className="mt-1.5 text-[11px] text-red-600">{l.error}</p>}
          </div>
        ))}
      </Card>
    </>
  );
}
