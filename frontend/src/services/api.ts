import axios from "axios";

export const apiBaseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000/api";

export const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config as (typeof error.config & { _retried?: boolean }) | undefined;
    // Try refresh token once on 401 (real session renewal, no mock)
    if (status === 401 && original && !original._retried && localStorage.getItem("refreshToken")) {
      original._retried = true;
      try {
        refreshing = true;
        const { data } = await axios.post(`${apiBaseURL}/auth/refresh`, {
          refreshToken: localStorage.getItem("refreshToken"),
        });
        const token: string = data?.data?.token;
        if (token) {
          localStorage.setItem("token", token);
          // Rotation: store the new refresh token issued by the server
          if (data?.data?.refreshToken) {
            localStorage.setItem("refreshToken", data.data.refreshToken);
          }
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        // fall through to logout
      } finally {
        refreshing = false;
      }
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      if (!window.location.pathname.includes("/login")) window.location.href = "/login";
    }
    if (status === 401 && !refreshing) {
      localStorage.removeItem("token");
      if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/register")) {
        window.location.href = "/login";
      }
    }
    if (!error?.response) {
      return Promise.reject(new Error("Connexion perdue. Vérifiez votre connexion Internet."));
    }
    const body = error?.response?.data as
      | { error?: { code?: string; message?: string }; message?: string }
      | undefined;
    const message: string =
      body?.error?.message ?? body?.message ?? "Une erreur est survenue. Veuillez réessayer.";
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = status;
    err.code = body?.error?.code;
    return Promise.reject(err);
  },
);

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function unwrap<T>(res: { data: { success: boolean; data: T } }): T {
  return res.data.data;
}

export function unwrapPaginated<T>(res: { data: { success: boolean; data: T[]; pagination: Paginated<T>["pagination"] } }): Paginated<T> {
  return { data: res.data.data, pagination: res.data.pagination };
}
