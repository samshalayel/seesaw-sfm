import { useState } from "react";
import { MemoryRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useGame } from "@/lib/stores/useGame";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Monitor } from "./pages/Monitor";
import { Users } from "./pages/Users";
import { Settings } from "./pages/Settings";
import { Chat } from "./pages/Chat";

const NAV = [
  { to: "/dashboard", icon: "◧", label: "لوحة القيادة" },
  { to: "/projects",  icon: "▤", label: "المشاريع" },
  { to: "/chat",      icon: "◇", label: "الروبوتات" },
  { to: "/monitor",   icon: "◈", label: "المراقب" },
  { to: "/settings",  icon: "⚙", label: "الإعدادات" },
  { to: "/users",     icon: "◉", label: "المستخدمون", adminOnly: true },
];

function Shell() {
  const user = useGame((s) => s.user);
  const setAppMode = useGame((s) => s.setAppMode);
  const [navOpen, setNavOpen] = useState(false);
  const isAdmin = user?.role === "admin";

  return (
    <div dir="rtl" className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-700 font-[Almarai,Inter,sans-serif]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-60 shrink-0 border-l border-slate-200 bg-white
                    transition-transform lg:static lg:translate-x-0
                    ${navOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300 bg-cyan-50 text-sm">
            ◆
          </div>
          <span className="text-[15px] font-extrabold tracking-tight text-slate-900">Sillar</span>
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
                    ? "bg-cyan-50 font-bold text-cyan-700 shadow-[inset_2px_0_0_0_#22d3ee]"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <span className="w-4 text-center opacity-80">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 p-3">
          <button
            onClick={() => setAppMode(null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ← تبديل الوضع
          </button>
        </div>
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur">
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 lg:hidden"
          >
            ☰
          </button>
          <div className="mr-auto flex items-center gap-3">
            {user && (
              <span className="text-[12px] text-slate-500">
                {user.username}
                {isAdmin && (
                  <span className="mr-2 rounded border border-cyan-300 bg-cyan-50 px-1.5 py-0.5 text-[10px] text-cyan-700">
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
            <Route path="/chat" element={<Chat />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/settings" element={<Settings />} />
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
