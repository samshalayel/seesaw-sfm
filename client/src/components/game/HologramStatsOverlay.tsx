import { useEffect, useState } from "react";
import { useGame } from "@/lib/stores/useGame";

interface Stats {
  userCount: number;
  modelCount: number;
  instructionExcerpt: string;
  openrouterFreeCount: number;
  openrouterPaidCount: number;
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ free, paid }: { free: number; paid: number }) {
  const total = free + paid || 1;
  const r = 40; const cx = 60; const cy = 60;
  const circ = 2 * Math.PI * r;
  const freeDash = (free / total) * circ;
  return (
    <svg width={120} height={120} style={{ filter: "drop-shadow(0 0 8px #00e5ff)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(196,164,74,0.2)" strokeWidth={15} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00e5ff" strokeWidth={15}
        strokeDasharray={`${freeDash} ${circ - freeDash}`}
        strokeDashoffset={circ / 4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#c4a44a" strokeWidth={15}
        strokeDasharray={`${circ - freeDash} ${freeDash}`}
        strokeDashoffset={circ / 4 - freeDash} strokeLinecap="round" />
      <text x={cx} y={cy - 5} textAnchor="middle" fill="#00e5ff"
        fontSize="14" fontWeight="bold" fontFamily="monospace">
        {Math.round((free / total) * 100)}%
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill="rgba(0,229,255,0.5)"
        fontSize="9" fontFamily="monospace">مجاني</text>
    </svg>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ values, labels, colors }: {
  values: number[]; labels: string[]; colors: string[];
}) {
  const w = 178; const h = 90;
  const max = Math.max(...values, 1);
  const bw = (w - 20) / values.length - 10;
  return (
    <svg width={w} height={h}>
      {values.map((v, i) => {
        const bh = Math.max(5, (v / max) * (h - 28));
        const x = 10 + i * (bw + 10);
        const y = h - 22 - bh;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[i]} stopOpacity="1" />
                <stop offset="100%" stopColor={colors[i]} stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <rect x={x + 1} y={y + 1} width={bw} height={bh} fill={colors[i]} rx={3} opacity={0.18} />
            <rect x={x} y={y} width={bw} height={bh} fill={`url(#bg${i})`} rx={3} />
            <text x={x + bw / 2} y={h - 7} textAnchor="middle"
              fill="rgba(0,229,255,0.5)" fontSize="9" fontFamily="monospace">{labels[i]}</text>
            <text x={x + bw / 2} y={y - 4} textAnchor="middle"
              fill={colors[i]} fontSize="10" fontFamily="monospace" fontWeight="bold">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Radial Gauge ─────────────────────────────────────────────────────────────
function RadialGauge({ value, max, label, color }: {
  value: number; max: number; label: string; color: string;
}) {
  const s = 88; const r = 32; const cx = s / 2; const cy = s / 2;
  const ratio = Math.min(value / Math.max(max, 1), 1);
  const circ = 2 * Math.PI * r;
  const arc = 0.75 * circ;
  const filled = ratio * arc;
  return (
    <svg width={s} height={s} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)"
        strokeWidth={10} strokeDasharray={`${arc} ${circ - arc}`}
        strokeDashoffset={-circ * 0.375} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
        strokeWidth={10} strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={-circ * 0.375} strokeLinecap="round" />
      <text x={cx} y={cy + 5} textAnchor="middle" fill={color}
        fontSize="14" fontWeight="bold" fontFamily="monospace">{value}</text>
      <text x={cx} y={s - 5} textAnchor="middle" fill="rgba(255,255,255,0.35)"
        fontSize="7" fontFamily="monospace">{label}</text>
    </svg>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ color }: { color: string }) {
  const pts = [8, 14, 11, 20, 17, 27, 24, 33, 29, 38, 34, 42];
  const max = Math.max(...pts);
  const w = 96; const h = 28;
  const step = w / (pts.length - 1);
  const points = pts.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`).join(" ");
  const id = `sg${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────
function Panel({ title, color, children, style }: {
  title: string; color: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(0,6,20,.95) 0%,rgba(0,14,38,.92) 100%)",
      border: `1px solid ${color}44`,
      borderRadius: 12, padding: "14px 16px",
      boxShadow: `0 0 24px ${color}18,0 4px 20px rgba(0,0,0,.5)`,
      backdropFilter: "blur(10px)",
      position: "relative", overflow: "hidden",
      ...style,
    }}>
      <div style={{ position:"absolute",top:0,left:"20%",right:"20%",
        height:1,background:`linear-gradient(90deg,transparent,${color}bb,transparent)` }} />
      <div style={{ position:"absolute",top:0,right:0,width:20,height:20,
        borderTop:`2px solid ${color}88`,borderRight:`2px solid ${color}88`,borderRadius:"0 12px 0 0" }} />
      <div style={{ fontSize:9,letterSpacing:"2.5px",color:`${color}99`,
        fontFamily:"monospace",marginBottom:10,textTransform:"uppercase" }}>
        ◈ {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main Overlay ─────────────────────────────────────────────────────────────
export function HologramStatsOverlay() {
  const isOpen        = useGame((s) => s.hologramOpen);
  const closeHologram = useGame((s) => s.closeHologram);
  const phase         = useGame((s) => s.phase);
  const [stats, setStats] = useState<Stats | null>(null);

  // ESC / F closes overlay
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHologram();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeHologram]);

  // Fetch stats when opening
  useEffect(() => {
    if (!isOpen || phase !== "playing") return;
    fetch("/api/stats", {
      headers: { "x-room-id": localStorage.getItem("roomId") || "default" },
    }).then((r) => r.json()).then(setStats).catch(() => {});
  }, [isOpen, phase]);

  if (!isOpen) return null;

  const cyan   = "#00e5ff";
  const green  = "#00ff88";
  const gold   = "#c4a44a";
  const purple = "#b06aff";
  const total  = (stats?.openrouterFreeCount ?? 0) + (stats?.openrouterPaidCount ?? 0);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 40%,rgba(0,20,55,.88) 0%,rgba(0,2,12,.97) 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace",
      animation: "holo-enter 0.55s cubic-bezier(0.16,1,0.3,1) both",
    }}>
      <style>{`
        @keyframes holo-enter {
          0%   { opacity:0; transform: scale(0.88); filter: brightness(3) blur(8px); }
          40%  { opacity:1; filter: brightness(1.4) blur(0px); }
          100% { opacity:1; transform: scale(1);    filter: brightness(1) blur(0px); }
        }
        @keyframes holo-scan {
          0%   { top: -4px; opacity: 0.9; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes panel-in {
          0%   { opacity:0; transform: translateY(18px) scaleY(0.92); }
          100% { opacity:1; transform: translateY(0)   scaleY(1); }
        }
      `}</style>
      {/* خط مسح يجتاح الشاشة مرة واحدة عند الفتح */}
      <div style={{
        position:"absolute", left:0, right:0, height:3,
        background:`linear-gradient(90deg,transparent,${cyan},transparent)`,
        animation:"holo-scan 0.7s ease-out 0.1s both",
        pointerEvents:"none", zIndex:1,
      }} />
      {/* scan lines */}
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,.015) 3px,rgba(0,229,255,.015) 6px)" }} />
      {/* vignette */}
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",
        background:"radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.6) 100%)" }} />

      {/* Header */}
      <div style={{ textAlign:"center",marginBottom:20,position:"relative",
        animation:"panel-in 0.5s ease-out 0.15s both" }}>
        <div style={{ fontSize:10,letterSpacing:"6px",color:`${cyan}55`,marginBottom:6 }}>
          SILLAR WORKSPACE
        </div>
        <div style={{ fontSize:24,fontWeight:"bold",letterSpacing:"8px",
          color:cyan,textShadow:`0 0 20px ${cyan},0 0 60px ${cyan}44` }}>
          ⬡ ANALYTICS ⬡
        </div>
        <div style={{ height:1,marginTop:10,
          background:`linear-gradient(90deg,transparent,${cyan}66,${green}66,transparent)` }} />
      </div>

      {/* Grid */}
      <div style={{
        display:"grid", gridTemplateColumns:"210px 270px 210px",
        gridTemplateRows:"auto auto", gap:12,
        maxWidth:740, width:"100%", padding:"0 20px",
        animation:"panel-in 0.5s ease-out 0.3s both",
      }}>

        {/* Users */}
        <Panel title="المستخدمون" color={cyan}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <RadialGauge value={stats?.userCount ?? 0}
              max={Math.max((stats?.userCount ?? 0) * 2, 20)} label="user" color={cyan} />
            <div>
              <div style={{ fontSize:30,fontWeight:"bold",color:cyan,
                textShadow:`0 0 14px ${cyan}` }}>{stats?.userCount ?? "—"}</div>
              <div style={{ fontSize:8,color:`${cyan}55`,marginBottom:6 }}>مستخدم مسجّل</div>
              <Sparkline color={cyan} />
            </div>
          </div>
        </Panel>

        {/* OpenRouter center tall */}
        <Panel title="OpenRouter Models" color={gold} style={{ gridRow:"span 2" }}>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:12 }}>
            <DonutChart free={stats?.openrouterFreeCount ?? 0} paid={stats?.openrouterPaidCount ?? 0} />
            <div style={{ display:"flex",gap:20,justifyContent:"center",width:"100%" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:22,fontWeight:"bold",color:cyan,
                  textShadow:`0 0 10px ${cyan}` }}>{stats?.openrouterFreeCount ?? 0}</div>
                <div style={{ fontSize:8,color:`${cyan}77` }}>مجاني</div>
              </div>
              <div style={{ width:1,background:`${gold}33`,alignSelf:"stretch" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:22,fontWeight:"bold",color:gold,
                  textShadow:`0 0 10px ${gold}` }}>{stats?.openrouterPaidCount ?? 0}</div>
                <div style={{ fontSize:8,color:`${gold}77` }}>مدفوع</div>
              </div>
            </div>
            {/* Progress */}
            <div style={{ width:"100%" }}>
              <div style={{ display:"flex",justifyContent:"space-between",
                fontSize:8,color:`${cyan}55`,marginBottom:5 }}>
                <span>نسبة المجاني</span>
                <span>{total > 0 ? Math.round((stats?.openrouterFreeCount ?? 0) / total * 100) : 0}%</span>
              </div>
              <div style={{ height:5,background:`${gold}18`,borderRadius:3 }}>
                <div style={{ height:"100%",borderRadius:3,
                  width:total > 0 ? `${(stats?.openrouterFreeCount ?? 0) / total * 100}%` : "0%",
                  background:`linear-gradient(90deg,${cyan},${green})`,
                  boxShadow:`0 0 8px ${cyan}88` }} />
              </div>
            </div>
            <div style={{ fontSize:10,color:`${gold}99`,textAlign:"center" }}>
              إجمالي: <span style={{ color:gold,fontWeight:"bold" }}>{total.toLocaleString()}</span>
            </div>
          </div>
        </Panel>

        {/* AI Models */}
        <Panel title="النماذج المُفعَّلة" color={green}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <RadialGauge value={stats?.modelCount ?? 0}
              max={Math.max((stats?.modelCount ?? 0) * 2, 10)} label="model" color={green} />
            <div>
              <div style={{ fontSize:30,fontWeight:"bold",color:green,
                textShadow:`0 0 14px ${green}` }}>{stats?.modelCount ?? "—"}</div>
              <div style={{ fontSize:8,color:`${green}55`,marginBottom:6 }}>نموذج AI مربوط</div>
              <Sparkline color={green} />
            </div>
          </div>
        </Panel>

        {/* Bar chart */}
        <Panel title="مقارنة الأرقام" color={purple}>
          <BarChart
            values={[stats?.userCount ?? 0, stats?.modelCount ?? 0, stats?.openrouterFreeCount ?? 0]}
            labels={["مستخدم","نموذج","مجاني"]}
            colors={[cyan, green, gold]}
          />
        </Panel>

        {/* Instructions */}
        <Panel title="مقتطف التعليمات" color={purple}>
          <div style={{ fontSize:10,lineHeight:1.75,color:`${purple}cc`,
            wordBreak:"break-word",direction:"rtl",textAlign:"right",minHeight:70 }}>
            {stats?.instructionExcerpt
              ? `${stats.instructionExcerpt}${stats.instructionExcerpt.length >= 120 ? " …" : ""}`
              : <span style={{ color:"rgba(255,255,255,.18)",fontStyle:"italic" }}>لا توجد تعليمات مضبوطة</span>}
          </div>
        </Panel>
      </div>

      {/* Footer */}
      <div style={{ marginTop:20 }}>
        <button onClick={closeHologram} style={{
          background:`rgba(0,229,255,.08)`,border:`1px solid ${cyan}44`,
          color:cyan,padding:"9px 32px",borderRadius:8,
          fontSize:12,fontFamily:"monospace",letterSpacing:"2px",cursor:"pointer",
        }}>
          ESC — إغلاق
        </button>
      </div>
    </div>
  );
}
