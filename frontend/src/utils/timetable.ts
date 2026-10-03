import type { ClassOption, TimetableEntry } from "../types";

export const DAYS = [
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
  { value: 7, label: "Dimanche", short: "Dim" },
] as const;

export const dayLabel = (day: number) => DAYS.find((d) => d.value === day)?.label ?? "";

/** Jour de la semaine au format de l'API : 1 = lundi … 7 = dimanche */
export function isoWeekday(date = new Date()): number {
  return ((date.getDay() + 6) % 7) + 1;
}

/** Créneaux regroupés par jour et triés par heure de début */
export function groupByDay(entries: TimetableEntry[]): Map<number, TimetableEntry[]> {
  const out = new Map<number, TimetableEntry[]>();
  for (const e of entries) out.set(e.dayOfWeek, [...(out.get(e.dayOfWeek) ?? []), e]);
  for (const list of out.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return out;
}

/** Lundi → samedi affichés ; le dimanche seulement s'il porte un cours */
export function visibleDays(entries: TimetableEntry[]) {
  const used = new Set(entries.map((e) => e.dayOfWeek));
  return DAYS.filter((d) => d.value <= 6 || used.has(d.value));
}

/** Classes regroupées par niveau (6ème, 5ème…) tel qu'enregistré en base ; sans niveau → "Autres classes" */
export function groupClassesByLevel(classes: ClassOption[]) {
  const groups = new Map<string, ClassOption[]>();
  for (const c of classes) {
    const key = c.level?.trim() || "Autres classes";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups].map(([level, list]) => ({ level, classes: list.sort((a, b) => a.name.localeCompare(b.name, "fr")) }));
}
