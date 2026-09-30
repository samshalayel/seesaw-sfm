import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty, Button, Stat } from "../components/ui";

interface TriggerLog {
  id: string; taskId: string; taskName: string;
  status: string; startedAt?: string; error?: string;
}
interface Config {
  enabled: boolean; intervalMinutes: number; robotId: string;
  watchStatuses: string[]; doneStatus: string;
}

const STATUS_TONE: Record<string, string> = {
  done:    "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  running: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  failed:  "border-red-400/30 bg-red-400/10 text-red-300",
  error:   "border-red-400/30 bg-red-400/10 text-red-300",
};

export function Monitor() {
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        apiFetch("/api/auto-trigger/config").then((r) => r.json()).catch(() => null),
        apiFetch("/api/auto-trigger/logs").then((r) => r.json()).catch(() => []),
      ]);
      setConfig(c && typeof c === "object" && !c.error ? c : null);
      setLogs(Array.isArray(l) ? l : []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const failed = logs.filter((l) => /fail|error/i.test(l.status)).length;

  return (
    <>
      <PageTitle
        title="المراقب"
        subtitle="ينفّذ مهام ClickUp تلقائياً عبر الوكلاء"
        action={<Button onClick={load} disabled={loading}>{loading ? "…" : "تحديث"}</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="الحالة"
          value={config?.enabled ? "يعمل" : "متوقف"}
          tone={config?.enabled ? "green" : "amber"}
        />
        <Stat label="الفاصل (دقيقة)" value={config?.intervalMinutes ?? "—"} />
        <Stat label="سجلات" value={logs.length} />
        <Stat label="فشل" value={failed} tone={failed ? "amber" : "cyan"} />
      </div>

      {config && (
        <Card className="mb-6 p-5">
          <div className="grid gap-3 text-[12px] sm:grid-cols-3">
            <div>
              <div className="text-slate-500">الروبوت</div>
              <div className="mt-1 font-mono text-slate-300">{config.robotId}</div>
            </div>
            <div>
              <div className="text-slate-500">حالات المراقبة</div>
              <div className="mt-1 text-slate-300">{config.watchStatuses?.join("، ") || "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">حالة الإنجاز</div>
              <div className="mt-1 text-slate-300">{config.doneStatus}</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="border-b border-white/5 px-5 py-3.5 text-[13px] font-bold text-slate-300">
          سجل التنفيذ
        </div>

        {loading && <Empty>جارٍ التحميل…</Empty>}
        {!loading && logs.length === 0 && <Empty>لا توجد سجلات</Empty>}

        {!loading && logs.map((l) => (
          <div key={l.id} className="border-b border-white/5 px-5 py-3.5 last:border-0">
            <div className="flex items-center gap-3">
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${
                  STATUS_TONE[l.status?.toLowerCase()] || "border-white/10 bg-white/5 text-slate-400"
                }`}
              >
                {l.status}
              </span>
              <span className="truncate text-[12px] text-slate-300">{l.taskName}</span>
              {l.startedAt && (
                <span className="mr-auto shrink-0 text-[11px] text-slate-600">
                  {new Date(l.startedAt).toLocaleTimeString("ar")}
                </span>
              )}
            </div>
            {l.error && <p className="mt-1.5 text-[11px] text-red-400/90">{l.error}</p>}
          </div>
        ))}
      </Card>
    </>
  );
}
