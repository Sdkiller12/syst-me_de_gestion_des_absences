import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../layouts/DashboardLayout";

export function NotFound() {
  return (
    <AuthLayout>
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-8 text-center shadow-2xl space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
          <Compass size={28} />
        </div>
        <p className="text-sm font-bold text-indigo-600">Erreur 404</p>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Page introuvable</h1>
        <p className="text-sm text-slate-600">La page demandée n'existe pas ou a été déplacée.</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </AuthLayout>
  );
}
