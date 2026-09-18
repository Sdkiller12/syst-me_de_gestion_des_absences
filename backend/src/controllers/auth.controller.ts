import type { Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const authController = {
  async registerSchool(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.registerSchool(req.body);
      return res.status(201).json({ success: true, data: result });
    } catch (e) {
      return next(e);
    }
  },

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await authService.login(email, password);
      await audit(req, "LOGIN", "User", result.user.id);
      return res.json({ success: true, data: result });
    } catch (e) {
      return next(e);
    }
  },

  async refresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      const result = await authService.refresh(refreshToken);
      return res.json({ success: true, data: result });
    } catch (e) {
      return next(e);
    }
  },

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Revoke access token + all refresh tokens for this user server-side
      const token = req.headers.authorization?.slice(7);
      if (token && req.user?.id) {
        await authService.logout(token, req.user.id);
      }
      await audit(req, "LOGOUT", "User", req.user?.id);
      return res.json({ success: true, data: { message: "Déconnexion réussie" } });
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
