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

export const authService = {
  async registerSchool(payload: RegisterSchoolPayload): Promise<{ token: string; refreshToken: string; user: User }> {
    const res = await api.post("/auth/register-school", payload);
    const data = unwrap<{ school: unknown; user: User; token: string; refreshToken: string }>(res);
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    return { token: data.token, refreshToken: data.refreshToken, user: data.user };
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await api.post("/auth/login", { email, password });
    const data = unwrap<{ user: User; token: string; refreshToken: string }>(res);
    localStorage.setItem("token", data.token);
    if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
    return { token: data.token, user: data.user };
  },

  async me(): Promise<User> {
    const res = await api.get("/auth/me");
    return unwrap<User>(res);
  },

  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch {
      // logout local même si le réseau échoue
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
  },
};
