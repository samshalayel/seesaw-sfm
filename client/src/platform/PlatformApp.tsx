import { useState } from "react";
import { MemoryRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useGame } from "@/lib/stores/useGame";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Monitor } from "./pages/Monitor";
import { Users } from "./pages/Users";

const NAV = [
  { to: "/dashboard", icon: "◧", label: "لوحة القيادة" },
  { to: "/projects",  icon: "▤", label: "المشاريع" },
  { to: "/monitor",   icon: "◈", label: "المراقب" },
  { to: "/users",     icon: "◉", label: "المستخدمون", adminOnly: true },
];

function Shell() {
  const user = useGame((s) => s.user);
  const setAppMode = useGame((s) => s.setAppMode);
  const [navOpen, setNavOpen] = useState(false);
  const isAdmin = user?.role === "admin";

  return (
    <div dir="rtl" className="flex h-screen w-screen overflow-hidden bg-[#070b12] text-slate-200 font-[Almarai,Inter,sans-serif]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-60 shrink-0 border-l border-white/5 bg-[#0a0f1a]
                    transition-transform lg:static lg:translate-x-0
                    ${navOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-sm">
            ◆
          </div>
          <span className="text-[15px] font-extrabold tracking-tight text-slate-100">Sillar</span>
        </div>

        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
                  isActive
                    ? "bg-cyan-400/10 font-bold text-cyan-300 shadow-[inset_2px_0_0_0_#22d3ee]"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`
              }
            >
              <span className="w-4 text-center opacity-80">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/5 p-3">
          <button
            onClick={() => setAppMode(null)}
            className="w-full rounded-lg border border-white/10 px-3 py-2 text-[12px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            ← تبديل الوضع
          </button>
        </div>
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0f1a]/80 px-5 backdrop-blur">
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-slate-300 lg:hidden"
          >
            ☰
          </button>
          <div className="mr-auto flex items-center gap-3">
            {user && (
              <span className="text-[12px] text-slate-400">
                {user.username}
                {isAdmin && (
                  <span className="mr-2 rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-300">
                    مدير
                  </span>
                )}
              </span>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:key" element={<ProjectDetail />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/users" element={isAdmin ? <Users /> : <Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function PlatformApp() {
  // MemoryRouter: التطبيق يُقدَّم من نفس المسار الجذر، فلا نلمس شريط العنوان
  return (
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Shell />
    </MemoryRouter>
  );
}
