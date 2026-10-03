import { Link, useNavigate } from "react-router-dom";
import { BookOpenCheck, CalendarDays, Sparkles } from "lucide-react";
import { useStudentClasses, useStudentGrades, useStudentMe } from "../../hooks/useGradesTimetable";
import { APP_NAME } from "../../constants";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { StatCard } from "../../components/ui/StatCard";
import { ClassPicker } from "../../components/ClassPicker";
import { formatScore } from "../../utils/grades";

export function StudentHome() {
  const navigate = useNavigate();
  const me = useStudentMe();
  const classes = useStudentClasses();
  const grades = useStudentGrades({});

  if (me.isLoading) return <LoadingState label="Chargement de votre espace…" />;
  if (me.isError || !me.data) return <ErrorState message="Impossible de charger votre espace." onRetry={() => void me.refetch()} />;
  const p = me.data;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles size={14} className="text-amber-300" />
            <span>Espace élève · {p.school.name}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Bienvenue sur {APP_NAME}</h1>
          <p className="text-sm font-medium text-indigo-100">
            {p.firstName} {p.lastName} · {p.class.name}
          </p>
        </div>
        <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Moyenne générale"
          value={grades.data?.overallAverage != null ? `${formatScore(grades.data.overallAverage)} / 20` : "—"}
          icon={BookOpenCheck}
          color="indigo"
        />
        <StatCard label="Évaluations" value={grades.data?.evaluationCount ?? "—"} icon={CalendarDays} color="blue" />
        <div className="col-span-2 flex flex-col gap-2 sm:flex-row lg:col-span-1 lg:flex-col">
          <Link to="/student/timetable" className="flex-1">
            <Button variant="gradient" className="w-full">
              <CalendarDays size={16} /> Mon emploi du temps
            </Button>
          </Link>
          <Link to="/student/grades" className="flex-1">
            <Button variant="outline" className="w-full">
              <BookOpenCheck size={16} /> Mes notes
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <h2 className="mb-1 text-base font-bold text-slate-900">Consulter un emploi du temps</h2>
        <p className="mb-4 text-xs text-slate-500">Choisissez un niveau puis une classe de votre établissement.</p>
        {classes.isLoading ? <LoadingState /> : null}
        {classes.isError ? <ErrorState message="Impossible de charger les classes." onRetry={() => void classes.refetch()} /> : null}
        {classes.data ? (
          <ClassPicker
            classes={classes.data.classes}
            highlightId={classes.data.myClassId}
            onSelect={(c) => navigate(c.id === classes.data.myClassId ? "/student/timetable" : `/student/timetable?classId=${c.id}`)}
          />
        ) : null}
      </Card>
    </div>
  );
}
