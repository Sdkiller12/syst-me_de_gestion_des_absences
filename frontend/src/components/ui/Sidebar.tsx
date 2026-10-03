import { NavLink } from "react-router-dom";
import {
  Bell,
  BookMarked,
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
  Home,
  UserRound,
  ClipboardCheck,
  BookOpenCheck,
  CalendarDays,
  Lock,
} from "lucide-react";
import { useAuth, roleLabel } from "../../hooks/AuthContext";
import { APP_NAME } from "../../constants";
import { cn } from "../../utils/cn";
import { studentLinks } from "../../constants/navigation";
import type { NavItem } from "../../constants/navigation";

const adminLinks: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/classes", label: "Classes", icon: BookOpen },
  { to: "/students", label: "Étudiants", icon: Users },
  { to: "/students/import", label: "Import Excel / PDF", icon: FileSpreadsheet },
  { to: "/admin/teachers", label: "Enseignants", icon: GraduationCap },
  { to: "/admin/subjects", label: "Matières", icon: BookMarked },
  { to: "/admin/timetable", label: "Emploi du temps", icon: CalendarDays },
  { to: "/admin/grades", label: "Notes", icon: BookOpenCheck, badge: "Lecture seule" },
  { to: "/courses", label: "Cours", icon: BookOpen },
  { to: "/attendance", label: "Présences", icon: CheckCircle2 },
  { to: "/notifications", label: "Notifications SMS", icon: Bell },
  { to: "/history", label: "Historique", icon: History },
  { to: "/audit-logs", label: "Journal d'Audit", icon: ScrollText },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

const teacherLinks: NavItem[] = [
  { to: "/teacher/dashboard", label: "Tableau de bord", icon: Home },
  { to: "/teacher/courses", label: "Mes cours", icon: BookOpen },
  { to: "/teacher/classes", label: "Mes classes", icon: Users },
  { to: "/teacher/attendance", label: "Faire l'appel", icon: ClipboardCheck },
  { to: "/teacher/grades", label: "Notes", icon: BookOpenCheck },
  { to: "/teacher/timetable", label: "Emploi du temps", icon: CalendarDays },
  { to: "/teacher/history", label: "Historique", icon: History },
  { to: "/teacher/profile", label: "Mon profil", icon: UserRound },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();

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
        {(user?.role === "TEACHER" ? teacherLinks : user?.role === "STUDENT" ? studentLinks : adminLinks).map(({ to, label, icon: Icon, badge }) => (
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
                {badge ? (
                  <span title={badge} className="inline-flex items-center gap-0.5 rounded-full border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                    <Lock size={9} /> {badge}
                  </span>
                ) : null}
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
