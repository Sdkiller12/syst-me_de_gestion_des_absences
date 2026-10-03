import { KeyRound, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../layouts/DashboardLayout";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { homePath, useAuth } from "../hooks/AuthContext";
import { useToast } from "../components/ui/Toast";

/** Première connexion : le mot de passe temporaire doit être remplacé avant tout accès */
export function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const forced = !!user?.mustChangePassword;

  return (
    <AuthLayout>
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl">
        <div className="mb-6 space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <KeyRound size={26} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {forced ? "Choisissez votre mot de passe" : "Changer le mot de passe"}
          </h1>
          <p className="text-sm text-slate-600">
            {forced
              ? `Bienvenue ${user?.firstName ?? ""}. Vous vous êtes connecté avec un mot de passe temporaire : remplacez-le par un mot de passe personnel pour accéder à votre espace.`
              : "Saisissez votre mot de passe actuel puis le nouveau."}
          </p>
          {user?.username ? (
            <p className="text-xs text-slate-500">
              Votre identifiant de connexion : <span className="font-mono font-bold text-slate-800">{user.username}</span>
            </p>
          ) : null}
        </div>
        <ChangePasswordForm
          user={user}
          currentLabel={forced ? "Mot de passe temporaire (fourni par l'école)" : "Mot de passe actuel"}
          submitLabel="Enregistrer et accéder à mon espace"
          onDone={(u) => {
            notify("Mot de passe mis à jour.");
            navigate(homePath(u), { replace: true });
          }}
        />
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <LogOut size={14} /> Se déconnecter
        </button>
      </div>
    </AuthLayout>
  );
}
