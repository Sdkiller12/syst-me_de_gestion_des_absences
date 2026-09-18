import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";
import { logger } from "../config/logger.js";

function fail(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return fail(res, 400, "VALIDATION_ERROR", "Données invalides", err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  if (err instanceof AppError) {
    return fail(res, err.statusCode, err.code, err.message);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return fail(res, 409, "CONFLICT", "Conflit: ressource déjà existante");
    }
    if (err.code === "P2025") {
      return fail(res, 404, "NOT_FOUND", "Ressource introuvable");
    }
    logger.error({ code: err.code, meta: err.meta }, "Prisma error");
    return fail(res, 500, "INTERNAL_ERROR", "Erreur serveur");
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error(err, "Prisma validation");
    return fail(res, 400, "VALIDATION_ERROR", "Requête invalide");
  }

  const anyErr = err as { status?: number; message?: string } | null;
  if (anyErr && typeof anyErr.status === "number" && anyErr.message?.toLowerCase().includes("limit")) {
    return fail(res, 413, "PAYLOAD_TOO_LARGE", anyErr.message);
  }

  if (err instanceof Error && (err.name === "PrismaClientInitializationError" || /authentication failed|connect|ECONNREFUSED/i.test(err.message))) {
    logger.error(err, "Database unavailable");
    return fail(res, 503, "DB_UNAVAILABLE", "Base de données indisponible. Vérifiez DATABASE_URL et que PostgreSQL est démarré.");
  }

  logger.error(err, "Unhandled error");
  const isProd = process.env.NODE_ENV === "production";
  return fail(res, 500, "INTERNAL_ERROR", isProd ? "Erreur serveur" : (err as Error)?.message ?? "Erreur serveur");
}
