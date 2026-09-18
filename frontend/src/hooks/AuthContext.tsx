import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authService } from "../services/auth.service";
import type { RegisterSchoolPayload } from "../services/auth.service";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerSchool: (payload: RegisterSchoolPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login(email, password);
    setUser(res.user);
  }, []);

  const registerSchool = useCallback(async (payload: RegisterSchoolPayload) => {
    const res = await authService.registerSchool(payload);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    void authService.logout().finally(() => setUser(null));
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, registerSchool, logout, isAuthenticated: !!user }),
    [user, loading, login, registerSchool, logout],
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
  return "Enseignant";
}
