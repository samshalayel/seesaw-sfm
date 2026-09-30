import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Stat, Empty, StageRail, STAGES } from "../components/ui";

interface Project { projectKey: string; name: string }
interface Slot { slot: string; filename: string }

export function Dashboard() {
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [slotsByKey, setSlotsByKey] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/projects");
        const list = await r.json();
        const arr: Project[] = Array.isArray(list) ? list : [];
        setProjects(arr);

        const entries = await Promise.all(
          arr.map(async (p) => {
            try {
              const sr = await apiFetch(`/api/projects/${p.projectKey}/slots`);
              const d = await sr.json();
              const filled = new Set<string>(
                (Array.isArray(d?.slots) ? d.slots : []).filter((s: Slot) => s.filename).map((s: Slot) => s.slot),
              );
              return [p.projectKey, filled] as const;
            } catch {
              return [p.projectKey, new Set<string>()] as const;
            }
          }),
        );
        setSlotsByKey(Object.fromEntries(entries));
      } catch { }
      setLoading(false);
    })();
  }, []);

  const totalSlots = projects.length * STAGES.length;
  const doneSlots = Object.values(slotsByKey).reduce((n, s) => n + s.size, 0);

  return (
    <>
      <PageTitle title="لوحة القيادة" subtitle="حالة المشاريع عبر مراحل المنهجية" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="مشروع" value={projects.length} />
        <Stat label="مرحلة مكتملة" value={doneSlots} tone="green" />
        <Stat
          label="نسبة الإنجاز"
          value={totalSlots ? `${Math.round((doneSlots / totalSlots) * 100)}%` : "—"}
          tone="amber"
        />
        <Stat label="مراحل لكل مشروع" value={STAGES.length} />
      </div>

      <Card>
        <div className="border-b border-white/5 px-5 py-3.5 text-[13px] font-bold text-slate-300">
          خط الإنتاج
        </div>

        {loading && <Empty>جارٍ التحميل…</Empty>}
        {!loading && projects.length === 0 && <Empty>لا توجد مشاريع بعد</Empty>}

        {!loading &&
          projects.map((p) => (
            <button
              key={p.projectKey}
              onClick={() => nav(`/projects/${p.projectKey}`)}
              className="block w-full border-b border-white/5 px-5 py-4 text-right last:border-0 hover:bg-white/[0.02]"
            >
              <div className="mb-3 flex items-baseline gap-2.5">
                <span className="rounded border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                  {p.projectKey}
                </span>
                <span className="text-[13px] text-slate-300">{p.name || "بلا اسم"}</span>
                <span className="mr-auto text-[11px] text-slate-600">
                  {(slotsByKey[p.projectKey]?.size ?? 0)}/{STAGES.length}
                </span>
              </div>
              <StageRail filled={slotsByKey[p.projectKey] ?? new Set()} />
            </button>
          ))}
      </Card>
    </>
  );
}
