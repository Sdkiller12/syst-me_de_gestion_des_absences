import { api, unwrap } from "./api";
import type { User } from "../types";

export interface RegisterSchoolPayload {
  schoolName: string;
  schoolEmail?: string;
  schoolPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string;
}

// Les tokens sont gérés par le backend en cookies HttpOnly : ils ne transitent jamais par le JS.
export const authService = {
  async registerSchool(payload: RegisterSchoolPayload): Promise<{ user: User }> {
    const res = await api.post("/auth/register-school", payload);
    const data = unwrap<{ school: unknown; user: User }>(res);
    return { user: data.user };
  },

  /** identifier : adresse email ou identifiant (ex. jean.kouassi) */
  async login(identifier: string, password: string): Promise<{ user: User }> {
    const res = await api.post("/auth/login", { identifier, password });
    return { user: unwrap<{ user: User }>(res).user };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ user: User }> {
    const res = await api.post("/auth/change-password", { currentPassword, newPassword });
    return { user: unwrap<{ user: User }>(res).user };
  },

  async me(): Promise<User> {
    const res = await api.get("/auth/me");
    return unwrap<User>(res);
  },

  async logout(): Promise<void> {
    try {
      // Le backend révoque la session et efface les cookies
      await api.post("/auth/logout");
    } catch {
      // déconnexion locale même si le réseau échoue
    }
  },
};
