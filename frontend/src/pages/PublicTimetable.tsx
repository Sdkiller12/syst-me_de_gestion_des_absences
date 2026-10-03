import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Lock, Sparkles } from "lucide-react";
import { usePublicClassTimetable, usePublicSchool } from "../hooks/useGradesTimetable";
import { APP_NAME } from "../constants";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { ClassPicker } from "../components/ClassPicker";
import { TimetableView } from "../components/TimetableView";

/**
 * Consultation sans compte de l'emploi du temps, depuis le lien de l'établissement.
 * Les notes, données personnelles, restent derrière la connexion élève.
 */
export function PublicTimetable() {
  const { schoolId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const classId = params.get("classId") ?? "";
  const school = usePublicSchool(schoolId);
  const tt = usePublicClassTimetable(schoolId, classId);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight text-slate-900">{APP_NAME}</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-indigo-600">{school.data?.school.name ?? "Établissement scolaire"}</p>
            </div>
          </div>
          <Link to="/login">
            <Button size="sm" variant="outline" className="whitespace-nowrap">
              <Lock size={14} /> Mes notes
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        {school.isLoading ? <LoadingState /> : null}
        {school.isError ? <ErrorState message="Ce lien d'établissement n'est pas valide. Demandez le bon lien à votre administration." /> : null}

        {school.data && !classId ? (
          <Card>
            <h1 className="text-xl font-extrabold text-slate-900">Bienvenue sur {APP_NAME}</h1>
            <p className="mb-5 text-sm text-slate-500">Consultez l'emploi du temps de votre classe — {school.data.school.name}.</p>
            <ClassPicker classes={school.data.classes} onSelect={(c) => setParams({ classId: c.id })} />
          </Card>
        ) : null}

        {school.data && classId ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <button type="button" onClick={() => setParams({})} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                  <ArrowLeft size={14} /> Changer de classe
                </button>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
                  <CalendarDays className="text-indigo-600" size={22} /> {tt.data?.class.name ?? "Emploi du temps"}
                </h1>
                {tt.data ? <p className="text-sm text-slate-500">Année {tt.data.class.academicYear}</p> : null}
              </div>
            </div>
            {tt.isLoading ? <LoadingState /> : null}
            {tt.isError ? <ErrorState message="Classe introuvable." onRetry={() => void tt.refetch()} /> : null}
            {tt.data && tt.data.entries.length === 0 ? (
              <EmptyState title="Emploi du temps non publié" description="L'administration n'a pas encore programmé les cours de cette classe." />
            ) : null}
            {tt.data && tt.data.entries.length > 0 ? <TimetableView entries={tt.data.entries} show="teacher" /> : null}
          </>
        ) : null}

        <p className="flex items-center justify-center gap-1.5 pt-4 text-center text-xs text-slate-500">
          <Lock size={12} /> Les notes sont personnelles : connectez-vous avec l'identifiant remis par votre établissement.
        </p>
      </main>
    </div>
  );
}
