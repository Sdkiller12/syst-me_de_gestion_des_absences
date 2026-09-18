import type { NextFunction, Response } from "express";
import { attendanceService } from "../services/attendance.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const attendanceController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.list(req.query as Record<string, unknown>, req.user!.schoolId, req.user!);
      return res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) { return next(e); }
  },
  async byCourse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.byCourse((req.params.courseId as string), req.user!.schoolId);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.save(req.body, req.user!.schoolId, req.user?.id);
      await audit(req, "SAVE", "Attendance", req.body.courseId as string, { count: (req.body.records as unknown[]).length });
      return res.status(201).json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async updateOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, justification } = req.body as { status: string; justification?: string | null };
      const data = await attendanceService.updateOne((req.params.id as string), status as never, justification ?? null, req.user!.schoolId);
      await audit(req, "UPDATE", "Attendance", (req.params.id as string));
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
};
