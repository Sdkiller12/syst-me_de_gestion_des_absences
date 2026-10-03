import { Link } from "react-router-dom";
import { BookOpen, CalendarCheck, ClipboardCheck, Clock, Sparkles, Users } from "lucide-react";
import { useTeacherDashboard } from "../../hooks/useTeacherModule";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { CourseCard } from "./CourseCard";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

export function TeacherDashboard() {
  const dash = useTeacherDashboard();
  if (dash.isLoading) return <LoadingState label="Chargement de votre espace…" />;
  if (dash.isError || !dash.data) return <ErrorState message="Impossible de charger votre tableau de bord." onRetry={() => void dash.refetch()} />;
  const d = dash.data;
  const today = new Date(`${d.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15">
              <Sparkles size={14} className="text-amber-300" />
              <span>Espace Enseignant</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Bonjour, {d.teacherName}
            </h1>
            <p className="text-sm text-indigo-100 font-medium leading-relaxed">
              Voici l'état de vos classes aujourd'hui ({today}). Suivez vos présences et gérez vos cours.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/teacher/attendance">
              <Button variant="gradient" size="md">
                <CalendarCheck size={18} /> Faire l'appel
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative Background Circles */}
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-48 -top-12 h-48 w-48 rounded-full bg-blue-400/10 blur-2xl" />
      </div>

      {d.assignments === 0 ? (
        <EmptyState 
          title="Aucune affectation"
          description="Aucune classe ne vous est encore affectée. L'administration de votre établissement doit vous attribuer vos classes et matières."
        />
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Mes classes" 
          value={d.classes} 
          icon={Users} 
          color="indigo" 
          hint="Classes qui vous sont affectées" 
        />
        <StatCard 
          label="Cours aujourd'hui" 
          value={d.coursesToday} 
          icon={BookOpen} 
          color="blue" 
          hint="Nombre de cours ce jour" 
        />
        <StatCard 
          label="Appels à effectuer" 
          value={d.callsPending} 
          icon={ClipboardCheck} 
          color="amber" 
          hint="Appels restants aujourd'hui" 
        />
        <StatCard 
          label="Absences aujourd'hui" 
          value={d.absencesToday} 
          icon={Clock} 
          color="rose" 
          hint={`Cette semaine : ${d.absencesWeek}`} 
        />
      </div>

      <Card className="space-y-4" hoverable>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Aujourd'hui</h2>
          </div>
          <Link to="/teacher/attendance" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
            Faire l'appel &rarr;
          </Link>
        </div>
        
        {d.todayCourses.length === 0 ? (
          <p className="py-6 text-center text-xs font-medium text-slate-500">
            Aucun cours planifié aujourd'hui. Vous pouvez tout de même démarrer un appel.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {d.todayCourses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
