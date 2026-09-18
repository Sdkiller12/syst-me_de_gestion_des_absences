import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";
import { prisma } from "../config/database.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/errors.js";
import {
  revokeToken,
  revokeAllRefreshTokensForUser,
  getLogoutCutoff,
  purgeExpiredTokens,
} from "../utils/tokenBlacklist.js";

function signAccess(userId: string, schoolId: string | null, role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER") {
  const env = getEnv();
  return jwt.sign({ userId, schoolId, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

function signRefresh(userId: string) {
  const env = getEnv();
  const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET;
  return jwt.sign({ userId, type: "refresh" }, secret, { expiresIn: "30d" } as jwt.SignOptions);
}

function safeUser(u: {
  id: string;
  schoolId: string | null;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER";
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    schoolId: u.schoolId,
    firstName: u.firstName,
    lastName: u.lastName,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

export const authService = {
  async registerSchool(payload: {
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
  }) {
    const email = payload.adminEmail.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError(409, "Un compte existe déjà avec cet email", "CONFLICT");
    const passwordHash = await bcrypt.hash(payload.adminPassword, 10);
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: payload.schoolName.trim(),
          email: payload.schoolEmail?.toLowerCase().trim() || null,
          phone: payload.schoolPhone?.trim() || null,
          address: payload.address?.trim() || null,
          city: payload.city?.trim() || null,
          country: payload.country?.trim() || "Côte d'Ivoire",
        },
      });
      const admin = await tx.user.create({
        data: {
          schoolId: school.id,
          firstName: payload.adminFirstName.trim(),
          lastName: payload.adminLastName.trim().toUpperCase(),
          name: `${payload.adminFirstName.trim()} ${payload.adminLastName.trim().toUpperCase()}`,
          email,
          phone: payload.adminPhone?.trim() || null,
          passwordHash,
          role: "SCHOOL_ADMIN",
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          userId: admin.id,
          action: "SCHOOL_REGISTER",
          entity: "School",
          entityId: school.id,
        },
      });
      return { school, admin };
    });
    const token = signAccess(result.admin.id, result.admin.schoolId, result.admin.role);
    const refreshToken = signRefresh(result.admin.id);
    return {
      school: { id: result.school.id, name: result.school.name },
      user: safeUser(result.admin),
      token,
      refreshToken,
    };
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email.toLowerCase().trim());
    if (!user) throw new AppError(401, "Email ou mot de passe incorrect", "UNAUTHORIZED");
    if (!user.isActive) throw new AppError(403, "Compte désactivé", "FORBIDDEN");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new AppError(401, "Email ou mot de passe incorrect", "UNAUTHORIZED");
    const token = signAccess(user.id, user.schoolId, user.role);
    const refreshToken = signRefresh(user.id);
    // Purge expired revoked tokens opportunistically (fire-and-forget)
    void purgeExpiredTokens().catch(() => null);
    return { user: safeUser(user), token, refreshToken };
  },

  /**
   * Refresh token rotation — single use:
   * 1. Verify signature and type claim.
   * 2. Check the iat against the user's last logout cutoff (rejects tokens from revoked sessions).
   * 3. Revoke the incoming refresh token immediately.
   * 4. Issue a fresh access token + fresh refresh token.
   */
  async refresh(refreshToken: string) {
    const env = getEnv();
    const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET;

    let decoded: { userId: string; type?: string; iat?: number; exp?: number };
    try {
      decoded = jwt.verify(refreshToken, secret) as typeof decoded;
    } catch {
      throw new AppError(401, "Refresh token invalide", "UNAUTHORIZED");
    }
    if (decoded.type !== "refresh") throw new AppError(401, "Refresh token invalide", "UNAUTHORIZED");

    // Check against logout cutoff — if user logged out after this token was issued, reject it
    const cutoff = await getLogoutCutoff(decoded.userId);
    if (cutoff && decoded.iat && decoded.iat * 1000 < cutoff.getTime()) {
      throw new AppError(401, "Session expirée, veuillez vous reconnecter", "UNAUTHORIZED");
    }

    const user = await userRepository.findById(decoded.userId);
    if (!user || !user.isActive) throw new AppError(401, "Utilisateur introuvable", "UNAUTHORIZED");

    // Rotate: revoke the used refresh token immediately (single-use enforcement)
    if (decoded.exp) {
      await revokeToken(refreshToken, decoded.userId, decoded.exp);
    }

    // Issue new tokens
    const newAccessToken = signAccess(user.id, user.schoolId, user.role);
    const newRefreshToken = signRefresh(user.id);

    return { token: newAccessToken, refreshToken: newRefreshToken, user: safeUser(user) };
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(404, "Utilisateur introuvable", "NOT_FOUND");
    return safeUser(user);
  },

  /**
   * Logout: revoke the current access token AND all refresh tokens for this user.
   * @param accessToken  Raw JWT from Authorization header
   * @param userId       Authenticated user id
   */
  async logout(accessToken: string, userId: string) {
    try {
      const decoded = jwt.decode(accessToken) as { exp?: number } | null;
      if (decoded?.exp) {
        await revokeToken(accessToken, userId, decoded.exp);
      }
      // Invalidate all refresh tokens — any token with iat < now is rejected on next use
      await revokeAllRefreshTokensForUser(userId);
    } catch {
      // Logout must never fail from the caller's perspective
    }
  },
};
