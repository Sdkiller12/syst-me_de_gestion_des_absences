import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import { prisma } from "../config/database.js";
import { getEnv } from "../config/env.js";
import { unauthorized, forbidden } from "../utils/errors.js";
import { isTokenRevoked } from "../utils/tokenBlacklist.js";
import type { AuthRequest, JwtPayload } from "../types/index.js";

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized("Token manquant");
    const token = header.slice(7);
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Check token blacklist (revoked on logout)
    if (await isTokenRevoked(token)) throw unauthorized("Token révoqué");

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw unauthorized("Utilisateur introuvable");
    if (!user.isActive) throw forbidden("Compte désactivé", "FORBIDDEN");
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId };
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return next(unauthorized(err.message));
    }
    return next(err);
  }
}
