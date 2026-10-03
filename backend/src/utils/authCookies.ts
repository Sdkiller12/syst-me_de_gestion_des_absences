import jwt from "jsonwebtoken";
import type { CookieOptions, Request, Response } from "express";
import { getEnv } from "../config/env.js";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

// Le refresh token n'est envoyé qu'aux routes d'authentification
const ACCESS_PATH = "/api";
const REFRESH_PATH = "/api/auth";

function baseOptions(): CookieOptions {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production" || env.COOKIE_SAMESITE === "none",
    sameSite: env.COOKIE_SAMESITE,
  };
}

/** Durée de vie restante d'un JWT en ms (d'après son claim exp) */
function maxAgeOf(token: string): number | undefined {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? Math.max(0, decoded.exp * 1000 - Date.now()) : undefined;
}

export function setAuthCookies(res: Response, tokens: { token: string; refreshToken: string }) {
  const opts = baseOptions();
  res.cookie(ACCESS_COOKIE, tokens.token, { ...opts, path: ACCESS_PATH, maxAge: maxAgeOf(tokens.token) });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...opts, path: REFRESH_PATH, maxAge: maxAgeOf(tokens.refreshToken) });
}

export function clearAuthCookies(res: Response) {
  const opts = baseOptions();
  res.clearCookie(ACCESS_COOKIE, { ...opts, path: ACCESS_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...opts, path: REFRESH_PATH });
}

/** Token d'accès : cookie HttpOnly (navigateur) ou en-tête Bearer (clients API) */
export function readAccessToken(req: Request): string | undefined {
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export function readRefreshToken(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}
