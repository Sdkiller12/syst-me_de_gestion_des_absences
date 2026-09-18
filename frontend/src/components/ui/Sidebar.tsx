import { NavLink } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth, roleLabel } from "../../hooks/AuthContext";
import { APP_NAME } from "../../constants";
import { cn } from "../../utils/cn";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { to: "/classes", label: "Classes", icon: BookOpen, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { to: "/students", label: "Étudiants", icon: Users, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { to: "/students/import", label: "Import Excel / PDF", icon: FileSpreadsheet, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { to: "/courses", label: "Cours", icon: BookOpen, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { to: "/attendance", label: "Présences", icon: CheckCircle2, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { to: "/notifications", label: "Notifications SMS", icon: Bell, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { to: "/history", label: "Historique", icon: History, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { to: "/teachers", label: "Enseignants", icon: GraduationCap, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { to: "/audit-logs", label: "Journal d'Audit", icon: ScrollText, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { to: "/settings", label: "Paramètres", icon: Settings, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const visible = links.filter((l) => !user || user.role === "SUPER_ADMIN" || l.roles.includes(user.role));

  return (
    <div className="flex h-full flex-col bg-white border-r border-slate-200/80 shadow-xs">
      {/* Brand Header */}
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight text-slate-900">{APP_NAME}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Établissement scolaire</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3" aria-label="Navigation principale">
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150",
                isActive
                  ? "bg-indigo-50/90 text-indigo-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={19}
                  className={cn(
                    "transition-transform duration-150 group-hover:scale-110",
                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <span className="h-2 w-2 rounded-full bg-indigo-600 shadow-xs" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer Card */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50/80 p-3 border border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-2xs">
            {user?.name?.charAt(0) ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">{user?.name}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">{user ? roleLabel(user.role) : ""}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Déconnexion"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
