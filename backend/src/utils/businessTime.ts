import { BUSINESS_TIMEZONE } from "../constants/index.js";

/**
 * Date et heure "métier" déterminées côté serveur dans le fuseau de l'établissement
 * (Africa/Abidjan), indépendamment du fuseau de la machine ou du navigateur.
 */
export function businessNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    /** AAAA-MM-JJ */
    date,
    /** HH:mm */
    time: `${parts.hour}:${parts.minute}`,
    /** Minuit du jour métier, au format attendu par les colonnes @db.Date */
    dateValue: new Date(`${date}T00:00:00.000Z`),
  };
}

/** "08:30" + 90 → "10:00", plafonné à 23:59 (un cours ne déborde pas sur le lendemain) */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Année académique courante : elle bascule en septembre (ex. oct. 2026 → "2026-2027") */
export function currentAcademicYear(now = new Date()): string {
  const { date } = businessNow(now);
  const [y, m] = date.split("-").map(Number);
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
