import { Link } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { useTeacherCourses, useTeacherMe } from "../../hooks/useTeacherModule";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { CourseCard } from "./CourseCard";

export function TeacherCourses() {
  const courses = useTeacherCourses();
  const me = useTeacherMe();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Mes cours</h1>
        <p className="text-sm text-slate-500">Cours planifiés pour vos classes sur les 7 prochains jours.</p>
      </div>

      {courses.isLoading ? <LoadingState /> : null}
      {courses.isError ? <ErrorState message="Impossible de charger vos cours." onRetry={() => void courses.refetch()} /> : null}
      {courses.data && courses.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center text-sm text-slate-500">
          Aucun cours planifié par l'administration sur cette période.
        </p>
      ) : null}
      {courses.data && courses.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.data.map((c) => (
            <CourseCard key={c.id} course={c} showDate />
          ))}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Démarrer un appel maintenant</h2>
        <p className="text-sm text-slate-500">Pour une séance non planifiée : la date et l'heure sont enregistrées automatiquement.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(me.data?.assignments ?? []).map((a) => (
            <Link
              key={a.id}
              to={`/teacher/attendance?assignmentId=${a.id}`}
              className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-100 bg-white p-4 hover:border-emerald-300"
            >
              <span>
                <span className="block text-sm font-bold text-slate-900">{a.subject.name}</span>
                <span className="block text-sm text-emerald-700">{a.class.name}</span>
              </span>
              <ClipboardCheck className="text-emerald-600" size={20} />
            </Link>
          ))}
          {me.data && me.data.assignments.length === 0 ? <p className="text-sm text-slate-500">Aucune classe ne vous est affectée.</p> : null}
        </div>
      </section>
    </div>
  );
}
