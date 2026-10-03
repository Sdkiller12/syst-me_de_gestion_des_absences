import { Link } from "react-router-dom";
import { FileSpreadsheet, GraduationCap, Link2, Plus } from "lucide-react";
import { useTeacherStats } from "../hooks/useTeacherModule";
import { Card } from "./ui/Card";

/** Section « Gestion des enseignants » du tableau de bord administrateur */
export function TeacherAdminSection() {
  const stats = useTeacherStats();
  const s = stats.data;
  const link = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-700">
          <GraduationCap size={18} className="text-indigo-600" /> Gestion des enseignants
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/teachers/import" className={link}>
            <FileSpreadsheet size={14} /> Importer
          </Link>
          <Link to="/admin/teachers" className={link}>
            <Plus size={14} /> Ajouter
          </Link>
          <Link to="/admin/teachers" className={link}>
            <Link2 size={14} /> Gérer les affectations
          </Link>
        </div>
      </div>
      {s ? (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-semibold text-slate-500">Total enseignants</dt>
            <dd className="text-xl font-extrabold text-slate-900">{s.total}</dd>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <dt className="text-xs font-semibold text-emerald-700">Comptes actifs</dt>
            <dd className="text-xl font-extrabold text-emerald-800">{s.activeAccounts}</dd>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <dt className="text-xs font-semibold text-amber-700">Comptes non configurés</dt>
            <dd className="text-xl font-extrabold text-amber-800">{s.withoutAccount}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-slate-500">{stats.isError ? "Statistiques indisponibles." : "Chargement…"}</p>
      )}
      {s && s.total === 0 ? <p className="text-sm text-slate-500">Aucun enseignant enregistré.</p> : null}
    </Card>
  );
}
