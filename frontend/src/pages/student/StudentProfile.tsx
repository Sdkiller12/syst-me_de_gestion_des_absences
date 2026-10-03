import { KeyRound, UserRound } from "lucide-react";
import { useAuth } from "../../hooks/AuthContext";
import { useStudentMe } from "../../hooks/useGradesTimetable";
import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { useToast } from "../../components/ui/Toast";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export function StudentProfile() {
  const { user } = useAuth();
  const me = useStudentMe();
  const { notify } = useToast();
  if (me.isLoading) return <LoadingState />;
  if (me.isError || !me.data) return <ErrorState message="Impossible de charger votre profil." onRetry={() => void me.refetch()} />;
  const p = me.data;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
        <UserRound className="text-indigo-600" size={22} /> Mon profil
      </h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h2 className="mb-2 text-base font-bold text-slate-900">Informations</h2>
          <dl className="divide-y divide-slate-100">
            <Row label="Nom" value={p.fullName} />
            <Row label="Matricule" value={p.studentNumber} />
            <Row label="Classe" value={`${p.class.name} · ${p.class.academicYear}`} />
            <Row label="Établissement" value={p.school.name} />
            <Row label="Identifiant" value={p.account.username} />
            <Row label="Dernière connexion" value={p.account.lastLoginAt ? new Date(p.account.lastLoginAt).toLocaleString("fr-FR") : null} />
          </dl>
          <p className="mt-3 text-xs text-slate-500">Une information est inexacte ? Contactez l'administration de votre établissement.</p>
        </section>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
            <KeyRound size={18} className="text-indigo-600" /> Changer mon mot de passe
          </h2>
          <ChangePasswordForm user={user} onDone={() => notify("Mot de passe mis à jour. Vos autres sessions ont été fermées.")} />
        </section>
      </div>
    </div>
  );
}
