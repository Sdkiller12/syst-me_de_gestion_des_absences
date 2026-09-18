import type { NextFunction, Response } from "express";
import { dashboardService } from "../services/dashboard.service.js";
import type { AuthRequest } from "../types/index.js";

export const dashboardController = {
  async stats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.stats(req.user!.schoolId, req.user!);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async chart(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.attendanceChart(req.user!.schoolId, Number(req.query.days ?? 7));
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
};
