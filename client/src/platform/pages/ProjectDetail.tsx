import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty, Button, StageRail, STAGES } from "../components/ui";

interface Slot { slot: string; filename: string; githubPath?: string; updatedAt?: string }

/** بوابات بشرية إلزامية حسب المنهجية — القسم 5 */
const HUMAN_GATES: Record<string, string> = {
  S0: "بوابة المشكلة — بشري فقط",
  S1: "بوابة المنتج — بشري فقط",
  S2: "بوابة المعمارية — بشري فقط",
  S6: "بوابة الإصدار — بشري فقط",
};

export function ProjectDetail() {
  const { key = "" } = useParams();
  const nav = useNavigate();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await apiFetch(`/api/projects/${key}/slots`);
        const d = await r.json();
        setSlots(Array.isArray(d?.slots) ? d.slots : []);
      } catch { }
      setLoading(false);
    })();
  }, [key]);

  const byStage = Object.fromEntries(slots.map((s) => [s.slot, s]));
  const filled = new Set(slots.filter((s) => s.filename).map((s) => s.slot));

  return (
    <>
      <button onClick={() => nav("/projects")} className="mb-3 text-[12px] text-slate-500 hover:text-slate-300">
        › المشاريع
      </button>

      <PageTitle
        title={key}
        subtitle={`${filled.size} من ${STAGES.length} مراحل مكتملة`}
      />

      <div className="mb-6">
        <StageRail filled={filled} />
      </div>

      <Card>
        <div className="border-b border-white/5 px-5 py-3.5 text-[13px] font-bold text-slate-300">
          المراحل
        </div>

        {loading && <Empty>جارٍ التحميل…</Empty>}

        {!loading && STAGES.map((s) => {
          const slot = byStage[s.id];
          const done = !!slot?.filename;
          const gate = HUMAN_GATES[s.id];
          const isOpen = open === s.id;

          return (
            <div key={s.id} className="border-b border-white/5 last:border-0">
              <button
                onClick={() => setOpen(isOpen ? null : s.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-right hover:bg-white/[0.02]"
              >
                <span
                  className={`grid h-7 w-9 shrink-0 place-items-center rounded font-mono text-[11px] font-extrabold ${
                    done ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-slate-600"
                  }`}
                >
                  {s.id}
                </span>

                <div className="min-w-0">
                  <div className="text-[13px] text-slate-300">{s.label}</div>
                  <div className="text-[11px] text-slate-600">{s.en}</div>
                </div>

                {gate && (
                  <span className="hidden rounded border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300 sm:inline">
                    ⚿ {gate}
                  </span>
                )}

                <span className={`mr-auto text-[11px] ${done ? "text-emerald-400" : "text-slate-600"}`}>
                  {done ? "مكتملة" : "—"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/5 bg-black/20 px-5 py-4 text-[12px]">
                  {done ? (
                    <div className="space-y-1.5">
                      <div className="text-slate-400">
                        الملف: <span className="font-mono text-slate-300">{slot.filename}</span>
                      </div>
                      {slot.githubPath && (
                        <div className="text-slate-400">
                          المسار: <span className="font-mono text-slate-300">{slot.githubPath}</span>
                        </div>
                      )}
                      {slot.updatedAt && (
                        <div className="text-slate-500">
                          آخر تحديث: {new Date(slot.updatedAt).toLocaleString("ar")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500">لا يوجد ناتج محفوظ لهذه المرحلة بعد.</p>
                  )}

                  {gate && (
                    <p className="mt-3 text-[11px] text-amber-300/80">
                      لا يمكن اعتماد هذه المرحلة آلياً — تتطلب توقيعاً بشرياً.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}
