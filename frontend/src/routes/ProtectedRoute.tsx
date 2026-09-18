import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/AuthContext";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-sm text-[#64748B]">Chargement…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && roles.length > 0) {
    if (user.role === "SUPER_ADMIN") return <>{children}</>;
    if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
