import type { NextFunction, Response } from "express";
import { notificationService } from "../services/notification.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const notificationController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.list(req.query as Record<string, unknown>, req.user!.schoolId);
      return res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) { return next(e); }
  },
  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await notificationService.getById((req.params.id as string), req.user!.schoolId);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async retry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await notificationService.retry((req.params.id as string), req.user!.schoolId);
      await audit(req, "RETRY", "SmsLog", (req.params.id as string));
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
};
