import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/auth.service";
import type { RegisterSchoolPayload } from "../services/auth.service";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** identifier : email ou identifiant de connexion */
  login: (identifier: string, password: string) => Promise<User>;
  registerSchool: (payload: RegisterSchoolPayload) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // La session vit dans un cookie HttpOnly invisible du JS : on demande au serveur.
    authService
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await authService.login(identifier, password);
      // Aucune donnée d'une session précédente (poste partagé) ne doit rester en cache
      queryClient.clear();
      setUser(res.user);
      return res.user;
    },
    [queryClient],
  );

  const registerSchool = useCallback(async (payload: RegisterSchoolPayload) => {
    const res = await authService.registerSchool(payload);
    queryClient.clear();
    setUser(res.user);
  }, [queryClient]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await authService.changePassword(currentPassword, newPassword);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    void authService.logout().finally(() => {
      queryClient.clear();
      setUser(null);
    });
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, registerSchool, changePassword, logout, isAuthenticated: !!user }),
    [user, loading, login, registerSchool, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}

export function roleLabel(role: User["role"]): string {
  if (role === "SUPER_ADMIN") return "Super admin";
  if (role === "SCHOOL_ADMIN") return "Administrateur";
  if (role === "STUDENT") return "Élève";
  return "Enseignant";
}

/** Page d'accueil selon le rôle (et le changement de mot de passe obligatoire) */
export function homePath(user: User): string {
  if (user.mustChangePassword) return "/change-password";
  if (user.role === "TEACHER") return "/teacher/dashboard";
  if (user.role === "STUDENT") return "/student/home";
  return "/dashboard";
}
