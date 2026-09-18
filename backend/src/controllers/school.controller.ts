import type { NextFunction, Response } from "express";
import { schoolService } from "../services/school.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const schoolController = {
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await schoolService.me(req.user!.schoolId, req.user!.role, req.query.schoolId as string | undefined);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user!.schoolId) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Aucune école associée" } });
      const data = await schoolService.update(req.user!.schoolId, req.body);
      await audit(req, "UPDATE", "School", req.user!.schoolId);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
};
