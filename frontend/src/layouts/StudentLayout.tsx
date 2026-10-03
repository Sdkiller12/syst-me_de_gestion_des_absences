import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Sidebar } from "../components/ui/Sidebar";
import { studentLinks } from "../constants/navigation";
import { Topbar } from "../components/ui/Topbar";
import { cn } from "../utils/cn";

/**
 * Espace étudiant : même design global (Sidebar + Topbar) que les autres espaces, avec en plus
 * une barre d'onglets en bas d'écran sur mobile, où la plupart des élèves consultent.
 */
export function StudentLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <aside className="hidden w-64 shrink-0 border-r border-[#E2E8F0] lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Navigation étudiant"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {studentLinks.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
                isActive ? "text-indigo-700" : "text-slate-500 hover:text-slate-800",
              )
            }
          >
            <Icon size={20} />
            {short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
