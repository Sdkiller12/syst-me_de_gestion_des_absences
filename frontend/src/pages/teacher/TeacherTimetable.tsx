import { CalendarDays, Lock } from "lucide-react";
import { useMyTeacherTimetable } from "../../hooks/useGradesTimetable";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Badge } from "../../components/ui/Badge";
import { TimetableView } from "../../components/TimetableView";

/** Emploi du temps de l'enseignant : consultation uniquement, il est établi par l'administration */
export function TeacherTimetable() {
  const tt = useMyTeacherTimetable();

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <CalendarDays className="text-emerald-600" size={22} /> Mon emploi du temps
          </h1>
          <p className="text-sm text-slate-500">Vos cours de la semaine, avec classes, horaires et salles.</p>
        </div>
        <Badge tone="slate" dot={false}>
          <Lock size={12} /> Lecture seule
        </Badge>
      </div>

      {tt.isLoading ? <LoadingState /> : null}
      {tt.isError ? <ErrorState message="Impossible de charger votre emploi du temps." onRetry={() => void tt.refetch()} /> : null}
      {tt.data && tt.data.entries.length === 0 ? (
        <EmptyState title="Aucun cours planifié" description="L'administration n'a pas encore programmé vos cours dans l'emploi du temps." />
      ) : null}
      {tt.data && tt.data.entries.length > 0 ? <TimetableView entries={tt.data.entries} show="class" accent="emerald" /> : null}
    </div>
  );
}
