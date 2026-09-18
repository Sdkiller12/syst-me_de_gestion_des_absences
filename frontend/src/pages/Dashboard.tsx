import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  GraduationCap,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useDashboardStats } from "../hooks/useApi";
import { useAuth } from "../hooks/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { StatCard } from "../components/ui/StatCard";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { NOTIFICATION_LABELS } from "../constants";
import { formatDateTime } from "../utils/format";

export function Dashboard() {
  const { user } = useAuth();
  const stats = useDashboardStats();

  if (stats.isLoading) return <LoadingState label="Chargement du tableau de bord…" />;
  if (stats.isError) {
    const err = stats.error as Error & { status?: number };
    if (err?.status === 0 || err?.message?.includes("Connexion")) {
      return (
        <ErrorState
          message="Connexion perdue. Vérifiez votre connexion Internet."
          onRetry={() => void stats.refetch()}
        />
      );
    }
    return <ErrorState message="Impossible de charger le tableau de bord." onRetry={() => void stats.refetch()} />;
  }

  const s = stats.data;
  const isEmpty = s && s.students === 0 && s.classes === 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/15">
              <Sparkles size={14} className="text-amber-300" />
              <span>Système de Gestion Scolaire Temps Réel</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Bonjour, {user?.name || "Administrateur"}
            </h1>
            <p className="text-sm text-indigo-100 font-medium leading-relaxed">
              Voici l'état actuel de votre établissement. Suivez les présences, gérez les étudiants et suivez l'envoi des notifications SMS automatique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/attendance">
              <Button variant="gradient" size="md">
                <CalendarCheck size={18} /> Prendre les présences
              </Button>
            </Link>
            <Link to="/students/import">
              <Button variant="outline" size="md" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <FileSpreadsheet size={18} /> Import Excel / PDF
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative Background Circles */}
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-48 -top-12 h-48 w-48 rounded-full bg-blue-400/10 blur-2xl" />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Bienvenue dans votre espace scolaire"
          description="Aucune classe n'est encore configurée. Créez une classe puis importez votre liste Excel ou PDF pour commencer."
          action={
            <Link to="/classes">
              <Button variant="primary">
                <Plus size={16} /> Créer ma première classe
              </Button>
            </Link>
          }
        />
      ) : null}

      {/* 8 Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Classes Inscrites"
          value={s?.classes ?? 0}
          icon={BookOpen}
          color="indigo"
          hint="Classes actives dans l'école"
        />
        <StatCard
          label="Total Étudiants"
          value={s?.students ?? 0}
          icon={Users}
          color="blue"
          hint="Étudiants enregistrés"
        />
        <StatCard
          label="Cours Programmés"
          value={s?.courses ?? 0}
          icon={GraduationCap}
          color="purple"
          hint="Total des séances créées"
        />
        <StatCard
          label="Taux de Présence"
          value={`${s?.presenceRate ?? 0}%`}
          icon={TrendingUp}
          color="emerald"
          trend="+98%"
          hint="Moyenne globale de présence"
        />
        <StatCard
          label="Présents Aujourd'hui"
          value={s?.todayPresences ?? 0}
          icon={CheckCircle2}
          color="emerald"
          hint="Étudiants présentés aux cours"
        />
        <StatCard
          label="Absences Aujourd'hui"
          value={s?.todayAbsences ?? 0}
          icon={AlertTriangle}
          color="rose"
          hint={`Cette semaine : ${s?.weekAbsences ?? 0}`}
        />
        <StatCard
          label="SMS Envoyés"
          value={s?.smsSent ?? 0}
          icon={Send}
          color="cyan"
          hint="Notifications délivrées aux parents"
        />
        <StatCard
          label="SMS Échoués / Retenus"
          value={s?.smsFailed ?? 0}
          icon={Clock}
          color="amber"
          hint="Notifications en échec de livraison"
        />
      </div>

      {/* Recent Absences and Recent Notifications */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Absences Card */}
        <Card hoverable className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <AlertTriangle size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Absences récentes</h2>
            </div>
            <Link to="/history" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
              Voir tout l'historique &rarr;
            </Link>
          </div>

          {!s || s.recentAbsences.length === 0 ? (
            <p className="py-6 text-center text-xs font-medium text-slate-500">
              Aucune absence enregistrée pour cette période.
            </p>
          ) : (
            <Table headers={["Étudiant", "Classe", "Cours"]}>
              {s.recentAbsences.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{a.studentName}</td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-600">{a.className}</td>
                  <td className="px-4 py-3 text-xs font-medium text-indigo-600">{a.subject}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* Recent SMS Notifications Card */}
        <Card hoverable className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Send size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Dernières notifications SMS</h2>
            </div>
            <Link to="/notifications" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
              Voir tous les SMS &rarr;
            </Link>
          </div>

          {!s || s.recentNotifications.length === 0 ? (
            <p className="py-6 text-center text-xs font-medium text-slate-500">
              Aucune notification SMS envoyée récemment.
            </p>
          ) : (
            <div className="space-y-2.5">
              {s.recentNotifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-sm transition-colors hover:bg-slate-100/60"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs">{n.studentName}</p>
                    <p className="text-[11px] font-medium text-slate-500">{formatDateTime(n.sentAt)}</p>
                  </div>
                  <Badge
                    tone={
                      n.status === "SENT"
                        ? "emerald"
                        : n.status === "FAILED"
                        ? "red"
                        : "amber"
                    }
                  >
                    {NOTIFICATION_LABELS[n.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
