import type { NextFunction, Response } from "express";
import { forbidden } from "../utils/errors.js";
import type { AuthRequest, Role } from "../types/index.js";

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(forbidden("Non authentifié", "UNAUTHORIZED"));
    // SUPER_ADMIN bypasses all role checks
    if (req.user.role === "SUPER_ADMIN") return next();
    if (!roles.includes(req.user.role)) return next(forbidden("Accès refusé"));
    return next();
  };
}

/** Ensures the request is scoped to a school (SUPER_ADMIN may pass schoolId via query for platform ops) */
export function requireSchool(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(forbidden("Non authentifié", "UNAUTHORIZED"));
  if (req.user.role !== "SUPER_ADMIN" && !req.user.schoolId) {
    return next(forbidden("Aucune école associée à ce compte"));
  }
  return next();
}
