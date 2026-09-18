import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../layouts/DashboardLayout";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/AuthContext";
import { APP_NAME } from "../constants";
import { loginSchema } from "../schemas";
import type { LoginInput } from "../schemas";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError("");
    try {
      await login(values.email, values.password);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Connexion impossible.");
    }
  }

  function fillDemo(email: string) {
    setValue("email", email);
    setValue("password", "Password123!");
  }

  return (
    <AuthLayout>
      <div className="relative w-full max-w-md">
        {/* Ambient Glow Effects */}
        <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25">
              <Sparkles size={28} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{APP_NAME}</h1>
            <p className="text-xs font-semibold text-slate-500">
              Espace d'administration & gestion des absences scolaires
            </p>
          </div>

          {/* Form */}
          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Adresse Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="admin@ecole.ci"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  {...register("email")}
                />
              </div>
              {errors.email ? <p className="text-xs font-semibold text-rose-600 mt-1">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password ? <p className="text-xs font-semibold text-rose-600 mt-1">{errors.password.message}</p> : null}
            </div>

            {serverError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 text-center">
                {serverError}
              </div>
            ) : null}

            <Button type="submit" variant="gradient" loading={isSubmitting} className="w-full py-3 text-sm font-bold shadow-md shadow-indigo-600/10">
              Se connecter à l'espace
            </Button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck size={13} className="text-emerald-600" /> Identifiants de Démonstration
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => fillDemo("admin@ecole.ci")}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-slate-700 border border-slate-200"
              >
                Admin École
              </button>
              <button
                type="button"
                onClick={() => fillDemo("prof@ecole.ci")}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-slate-700 border border-slate-200"
              >
                Enseignant
              </button>
            </div>
          </div>

          {/* Register Link */}
          <div className="mt-4 text-center">
            <p className="text-xs text-slate-600">
              Nouveau sur la plateforme ?{" "}
              <Link to="/register-school" className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
                Créer votre espace école
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
