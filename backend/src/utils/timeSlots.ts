export const DAY_NAMES = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;

/**
 * Deux créneaux "HH:mm" se chevauchent s'ils partagent au moins une minute.
 * Des créneaux consécutifs (08:00-10:00 puis 10:00-12:00) ne sont pas en conflit.
 * La comparaison de chaînes suffit : le format HH:mm sur 24 h est ordonné lexicographiquement.
 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}
