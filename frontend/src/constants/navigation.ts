import { BookOpenCheck, CalendarDays, Home, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Mention affichée à côté du libellé (ex. module en lecture seule) */
  badge?: string;
}

/** Navigation simplifiée de l'espace étudiant (barre latérale et barre d'onglets mobile) */
export const studentLinks: Array<NavItem & { short: string }> = [
  { to: "/student/home", label: "Accueil", short: "Accueil", icon: Home },
  { to: "/student/timetable", label: "Emploi du temps", short: "Horaires", icon: CalendarDays },
  { to: "/student/grades", label: "Mes notes", short: "Notes", icon: BookOpenCheck },
  { to: "/student/profile", label: "Mon profil", short: "Profil", icon: UserRound },
];
