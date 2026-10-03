import { useState } from "react";
import { BookOpenCheck } from "lucide-react";
import { useStudentGrades } from "../../hooks/useGradesTimetable";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { GradeReportView } from "../../components/GradeReportView";
import { EVALUATION_TYPE_LABELS } from "../../utils/grades";
import type { EvaluationType } from "../../types";

/** Notes de l'élève connecté uniquement : le serveur ne renvoie jamais celles d'un autre élève */
export function StudentGrades() {
  const [filters, setFilters] = useState({ subjectId: "", type: "" as EvaluationType | "", from: "", to: "" });
  const grades = useStudentGrades(filters);
  // Matières où l'élève a des notes, indépendamment des filtres appliqués
  const subjects = grades.data?.availableSubjects ?? [];

  const select = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
  const set = <K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <BookOpenCheck className="text-indigo-600" size={22} /> Mes notes
        </h1>
        <p className="text-sm text-slate-500">Notes enregistrées par vos enseignants. Moyennes pondérées par les coefficients, ramenées sur 20.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select aria-label="Matière" className={select} value={filters.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
          <option value="">Toutes les matières</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Type d'évaluation" className={select} value={filters.type} onChange={(e) => set("type", e.target.value as EvaluationType | "")}>
          <option value="">Tous les types</option>
          {(Object.keys(EVALUATION_TYPE_LABELS) as EvaluationType[]).map((t) => (
            <option key={t} value={t}>
              {EVALUATION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input aria-label="Du" type="date" className={select} value={filters.from} onChange={(e) => set("from", e.target.value)} />
        <input aria-label="Au" type="date" className={select} value={filters.to} onChange={(e) => set("to", e.target.value)} />
      </div>

      {grades.isLoading ? <LoadingState /> : null}
      {grades.isError ? <ErrorState message="Impossible de charger vos notes." onRetry={() => void grades.refetch()} /> : null}
      {grades.data ? (
        <GradeReportView
          report={grades.data}
          emptyDescription={
            Object.values(filters).some(Boolean) ? "Aucune note ne correspond à ces filtres." : "Vos enseignants n'ont pas encore enregistré de note."
          }
        />
      ) : null}
    </div>
  );
}
