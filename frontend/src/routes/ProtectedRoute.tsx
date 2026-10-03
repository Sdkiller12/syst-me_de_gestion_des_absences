import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { homePath, useAuth } from "../hooks/AuthContext";
import { LoadingState } from "../components/ui/LoadingState";

/**
 * Garde de navigation (confort d'usage uniquement : la sécurité réelle est vérifiée par l'API).
 * - pas de session → /login
 * - mot de passe temporaire → /change-password
 * - rôle non autorisé → page d'accueil du rôle (un enseignant ne voit jamais l'espace admin)
 */
export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Vérification de la session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  if (roles && roles.length > 0 && !roles.includes(user.role)) return <Navigate to={homePath(user)} replace />;
  return <>{children}</>;
}
