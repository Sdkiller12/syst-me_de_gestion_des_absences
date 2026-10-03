/** Arrondi à 2 décimales (affichage des moyennes et stockage des notes) */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Note ramenée sur 20 quel que soit le barème de l'évaluation */
export function on20(score: number, maxScore: number): number {
  return maxScore > 0 ? (score / maxScore) * 20 : 0;
}

/** Statistiques brutes d'une série de notes (sur le barème d'origine) */
export function summarize(scores: number[]) {
  if (scores.length === 0) return { count: 0, average: null, min: null, max: null };
  const sum = scores.reduce((a, b) => a + b, 0);
  return { count: scores.length, average: round2(sum / scores.length), min: Math.min(...scores), max: Math.max(...scores) };
}

export interface WeightedScore {
  score: number;
  maxScore: number;
  coefficient: number;
}

/** Moyenne pondérée par les coefficients, ramenée sur 20 ; null sans aucune note */
export function weightedAverage(rows: WeightedScore[]): number | null {
  const weight = rows.reduce((n, r) => n + r.coefficient, 0);
  if (weight <= 0) return null;
  return round2(rows.reduce((n, r) => n + on20(r.score, r.maxScore) * r.coefficient, 0) / weight);
}

export interface ReportGrade extends WeightedScore {
  id: string;
  evaluationId: string;
  title: string;
  type: string;
  date: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  updatedAt: string;
}

/**
 * Relevé d'un élève : notes regroupées par matière, moyenne pondérée par matière et
 * moyenne générale (moyenne des moyennes de matière, aucune matière n'ayant de coefficient propre).
 */
export function buildReport(grades: ReportGrade[]) {
  const bySubject = new Map<string, { subjectId: string; subjectName: string; grades: ReportGrade[] }>();
  for (const g of grades) {
    const s = bySubject.get(g.subjectId) ?? { subjectId: g.subjectId, subjectName: g.subjectName, grades: [] };
    s.grades.push(g);
    bySubject.set(g.subjectId, s);
  }
  const subjects = [...bySubject.values()]
    .map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      average: weightedAverage(s.grades),
      count: s.grades.length,
      grades: [...s.grades].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "fr"));
  const averages = subjects.map((s) => s.average).filter((a): a is number => a !== null);
  return {
    subjects,
    overallAverage: averages.length ? round2(averages.reduce((a, b) => a + b, 0) / averages.length) : null,
    evaluationCount: grades.length,
  };
}
