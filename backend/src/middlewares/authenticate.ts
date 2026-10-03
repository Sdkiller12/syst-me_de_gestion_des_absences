import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import { prisma } from "../config/database.js";
import { getEnv } from "../config/env.js";
import { unauthorized, forbidden } from "../utils/errors.js";
import { isTokenRevoked } from "../utils/tokenBlacklist.js";
import { readAccessToken } from "../utils/authCookies.js";
import type { AuthRequest, JwtPayload } from "../types/index.js";

const PASSWORD_CHANGE_ALLOWED = ["/auth/me", "/auth/change-password", "/auth/logout"];

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = readAccessToken(req);
    if (!token) throw unauthorized("Token manquant");
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Check token blacklist (revoked on logout)
    if (await isTokenRevoked(token)) throw unauthorized("Token révoqué");

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw unauthorized("Utilisateur introuvable");
    if (!user.isActive) throw forbidden("Compte désactivé", "FORBIDDEN");
    // Mot de passe temporaire : seules les routes nécessaires au changement restent ouvertes
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.some((p) => req.originalUrl.split("?")[0].endsWith(p))) {
      throw forbidden("Vous devez changer votre mot de passe temporaire", "PASSWORD_CHANGE_REQUIRED");
    }
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId };
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return next(unauthorized(err.message));
    }
    return next(err);
  }
}
