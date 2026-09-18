import { Menu, ShieldCheck } from "lucide-react";
import { useAuth, roleLabel } from "../../hooks/AuthContext";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const todayFormatted = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={onMenu}
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-slate-500 capitalize">{todayFormatted}</p>
          <p className="text-xs font-bold text-slate-800">Gestion des Présences & Notifications SMS</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <ShieldCheck size={14} />
          Session Sécurisée
        </div>

        <div className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-slate-50/80 pl-1.5 pr-3 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 text-xs font-bold text-white shadow-2xs">
            {user?.name?.charAt(0) ?? "A"}
          </div>
          <div className="text-left leading-none">
            <p className="text-xs font-bold text-slate-900">{user?.name}</p>
            <p className="text-[10px] font-semibold text-indigo-600 uppercase mt-0.5">
              {user ? roleLabel(user.role) : ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
