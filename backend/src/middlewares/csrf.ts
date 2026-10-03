import type { NextFunction, Request, Response } from "express";
import { forbidden } from "../utils/errors.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../utils/authCookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protection CSRF par en-tête personnalisé (OWASP "custom request header").
 * Un site tiers ne peut pas ajouter X-Requested-With sans preflight CORS,
 * or CORS n'autorise que FRONTEND_URL. Complète SameSite sur les cookies.
 * Ne s'applique qu'aux requêtes authentifiées par cookie (pas aux clients Bearer).
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
  if (!cookies[ACCESS_COOKIE] && !cookies[REFRESH_COOKIE]) return next();
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    return next(forbidden("Requête refusée (protection CSRF)", "CSRF_REJECTED"));
  }
  return next();
}
