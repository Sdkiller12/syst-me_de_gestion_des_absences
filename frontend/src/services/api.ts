import axios from "axios";

// Par défaut l'API est servie sur la même origine (proxy Vite en dev, rewrite Vercel en prod),
// ce qui permet des cookies d'authentification HttpOnly + SameSite=Strict.
export const apiBaseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000,
  // Les tokens sont dans des cookies HttpOnly, envoyés automatiquement par le navigateur
  withCredentials: true,
  // En-tête exigé par la protection CSRF du backend sur les requêtes mutantes
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

// Pages consultables sans session (dont l'emploi du temps public d'un établissement)
const PUBLIC_PATHS = ["/login", "/register-school", "/schools/"];
// Endpoints dont un 401 ne doit pas déclencher de refresh
const NO_REFRESH_URLS = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/register-school"];

// Refresh partagé : le refresh token est à usage unique (rotation), donc plusieurs
// requêtes expirées en même temps doivent attendre le même appel.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= api
    .post("/auth/refresh")
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config as (typeof error.config & { _retried?: boolean }) | undefined;
    const url: string = original?.url ?? "";

    if (status === 401 && original && !original._retried && !NO_REFRESH_URLS.some((u) => url.endsWith(u))) {
      original._retried = true;
      if (await refreshSession()) return api(original);
      if (!PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))) {
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
