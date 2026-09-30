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
    <div className={`rounded-xl border border-white/8 bg-white/[0.025] ${className}`}>{children}</div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, tone = "cyan" }: { label: string; value: ReactNode; tone?: "cyan" | "green" | "amber" }) {
  const tones = {
    cyan:  "text-cyan-300 border-cyan-400/20 bg-cyan-400/[0.06]",
    green: "text-emerald-300 border-emerald-400/20 bg-emerald-400/[0.06]",
    amber: "text-amber-300 border-amber-400/20 bg-amber-400/[0.06]",
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${tones[tone]}`}>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-slate-400">{label}</div>
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
    primary: "border-cyan-400/50 bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/25",
    ghost:   "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200",
    danger:  "border-red-400/40 bg-red-400/10 text-red-300 hover:bg-red-400/20",
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
                ? "border-cyan-400/60 bg-cyan-400/10"
                : done
                ? "border-emerald-400/30 bg-emerald-400/[0.07]"
                : "border-white/8 bg-white/[0.02]"
            }`}
          >
            <span
              className={`text-[11px] font-extrabold tabular-nums ${
                isCurrent ? "text-cyan-300" : done ? "text-emerald-300" : "text-slate-600"
              }`}
            >
              {s.id} {done && "✓"}
            </span>
            <span className={`text-[11px] leading-tight ${done || isCurrent ? "text-slate-300" : "text-slate-600"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
