import { KeyRound, UserRound } from "lucide-react";
import { useTeacherMe } from "../../hooks/useTeacherModule";
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

export function TeacherProfile() {
  const me = useTeacherMe();
  const { notify } = useToast();
  if (me.isLoading) return <LoadingState />;
  if (me.isError || !me.data) return <ErrorState message="Impossible de charger votre profil." onRetry={() => void me.refetch()} />;
  const p = me.data;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
        <UserRound className="text-emerald-600" size={22} /> Mon profil
      </h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-emerald-100 bg-white p-5">
          <h2 className="mb-2 text-base font-bold text-slate-900">Informations</h2>
          <dl className="divide-y divide-slate-100">
            <Row label="Nom" value={`${p.firstName} ${p.lastName}`} />
            <Row label="Établissement" value={p.school.name} />
            <Row label="Identifiant" value={p.account.username} />
            <Row label="Email" value={p.email ?? p.account.email} />
            <Row label="Téléphone" value={p.phone} />
            <Row label="Matricule" value={p.employeeNumber} />
            <Row label="Dernière connexion" value={p.account.lastLoginAt ? new Date(p.account.lastLoginAt).toLocaleString("fr-FR") : null} />
          </dl>
          <h3 className="mb-2 mt-5 text-sm font-bold text-slate-900">Mes matières et classes</h3>
          {p.assignments.length === 0 ? <p className="text-sm text-slate-500">Aucune affectation pour le moment.</p> : null}
          <ul className="space-y-1">
            {p.assignments.map((a) => (
              <li key={a.id} className="flex justify-between rounded-lg bg-emerald-50/60 px-3 py-1.5 text-sm">
                <span className="font-semibold text-slate-900">{a.subject.name}</span>
                <span className="text-emerald-800">
                  {a.class.name} · {a.academicYear}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Une information est inexacte ? Contactez l'administration de votre établissement.</p>
        </section>
        <section className="rounded-2xl border border-emerald-100 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
            <KeyRound size={18} className="text-emerald-600" /> Changer mon mot de passe
          </h2>
          <ChangePasswordForm user={p.account as any} onDone={() => notify("Mot de passe mis à jour. Vos autres sessions ont été fermées.")} />
        </section>
      </div>
    </div>
  );
}
