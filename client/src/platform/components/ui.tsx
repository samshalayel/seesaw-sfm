import type { ReactNode } from "react";

export const STAGES = [
  { id: "PD", label: "تعريف المشكلة", en: "Problem Definition" },
  { id: "S0", label: "النية والاكتشاف", en: "Intent & Discovery" },
  { id: "S1", label: "تشكيل المنتج", en: "Product Shaping" },
  { id: "S2", label: "المعمارية", en: "Architecture" },
  { id: "S3", label: "التطوير", en: "Development" },
  { id: "S4", label: "الاختبار والمراقبة", en: "Observability" },
  { id: "S5", label: "أنماط إعادة الاستخدام", en: "Reproducibility" },
  { id: "S6", label: "النشر", en: "Production Ready" },
] as const;

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, tone = "cyan" }: { label: string; value: ReactNode; tone?: "cyan" | "green" | "amber" }) {
  const tones = {
    cyan:  "text-cyan-700 border-cyan-200 bg-cyan-50",
    green: "text-emerald-700 border-emerald-200 bg-emerald-50",
    amber: "text-amber-700 border-amber-200 bg-amber-50",
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${tones[tone]}`}>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-slate-500">{label}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-6 py-12 text-center text-[13px] text-slate-500">{children}</div>;
}

export function Button({
  children, onClick, variant = "ghost", disabled, type = "button",
}: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger"; disabled?: boolean; type?: "button" | "submit";
}) {
  const v = {
    primary: "border-cyan-400 bg-cyan-100 text-cyan-700 hover:bg-cyan-100",
    ghost:   "border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    danger:  "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3.5 py-2 text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${v}`}
    >
      {children}
    </button>
  );
}

/** شريط مراحل S0–S6 — الحالة تُشتق من وجود ملف في الخانة */
export function StageRail({ filled, current }: { filled: Set<string>; current?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STAGES.map((s) => {
        const done = filled.has(s.id);
        const isCurrent = current === s.id;
        return (
          <div
            key={s.id}
            title={s.en}
            className={`flex min-w-[104px] flex-1 flex-col gap-1 rounded-lg border px-3 py-2.5 transition-colors ${
              isCurrent
                ? "border-cyan-500 bg-cyan-50"
                : done
                ? "border-emerald-300 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span
              className={`text-[11px] font-extrabold tabular-nums ${
                isCurrent ? "text-cyan-700" : done ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              {s.id} {done && "✓"}
            </span>
            <span className={`text-[11px] leading-tight ${done || isCurrent ? "text-slate-700" : "text-slate-400"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
