import type { EvaluationType } from "../types";

export const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  DEVOIR: "Devoir",
  INTERROGATION: "Interrogation",
  COMPOSITION: "Composition",
  EXAMEN: "Examen",
  AUTRE: "Autre",
};

/** 17.5 → "17,5" ; 15 → "15" */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/**
 * Lecture d'une saisie de note : "" → null (pas de note), "12,5" ou "12.5" → 12.5.
 * Renvoie une erreur lisible si la saisie est invalide ou hors barème.
 */
export function parseScore(input: string, maxScore: number): { value: number | null; error?: string } {
  const raw = input.trim().replace(",", ".");
  if (raw === "") return { value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { value: null, error: "Note invalide" };
  const value = Number(raw);
  if (value > maxScore) return { value, error: `Max ${formatScore(maxScore)}` };
  return { value };
}

/** Couleur de badge selon la note ramenée sur 20 */
export function scoreTone(score: number | null, maxScore = 20): "green" | "amber" | "red" | "slate" {
  if (score === null) return "slate";
  const on20 = (score / maxScore) * 20;
  if (on20 >= 12) return "green";
  if (on20 >= 10) return "amber";
  return "red";
}
