import type { Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";
import { unauthorized } from "../utils/errors.js";
import { clearAuthCookies, readAccessToken, readRefreshToken, setAuthCookies } from "../utils/authCookies.js";

// Les tokens sont posés en cookies HttpOnly et ne sont jamais renvoyés dans le corps JSON.

export const authController = {
  async registerSchool(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token, refreshToken, ...rest } = await authService.registerSchool(req.body);
      setAuthCookies(res, { token, refreshToken });
      return res.status(201).json({ success: true, data: rest });
    } catch (e) {
      return next(e);
    }
  },

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { identifier, email, password } = req.body as { identifier?: string; email?: string; password: string };
      const { token, refreshToken, user } = await authService.login((identifier ?? email)!, password);
      setAuthCookies(res, { token, refreshToken });
      await audit(req, "LOGIN", "User", user.id);
      return res.json({ success: true, data: { user } });
    } catch (e) {
      return next(e);
    }
  },

  async refresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const current = readRefreshToken(req);
      if (!current) throw unauthorized("Refresh token manquant");
      const { token, refreshToken, user } = await authService.refresh(current);
      setAuthCookies(res, { token, refreshToken });
      return res.json({ success: true, data: { user } });
    } catch (e) {
      clearAuthCookies(res);
      return next(e);
    }
  },

  /** Ne nécessite pas d'access token valide : les cookies sont toujours effacés. */
  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const accessToken = readAccessToken(req);
      const session = authService.identifySession(accessToken, readRefreshToken(req));
      clearAuthCookies(res);
      if (session) {
        // Revoke access token + all refresh tokens for this user server-side
        await authService.logout(accessToken ?? "", session.userId);
        req.user ??= { id: session.userId, schoolId: session.schoolId } as AuthRequest["user"];
        await audit(req, "LOGOUT", "User", session.userId);
      }
      return res.json({ success: true, data: { message: "Déconnexion réussie" } });
    } catch (e) {
      return next(e);
    }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
      const { token, refreshToken, user } = await authService.changePassword(req.user!.id, currentPassword, newPassword);
      setAuthCookies(res, { token, refreshToken });
      await audit(req, "PASSWORD_CHANGE", "User", user.id);
      return res.json({ success: true, data: { user } });
    } catch (e) {
      return next(e);
    }
  },

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const user = await authService.me(userId);
      return res.json({ success: true, data: user });
    } catch (e) {
      return next(e);
    }
  },
};
