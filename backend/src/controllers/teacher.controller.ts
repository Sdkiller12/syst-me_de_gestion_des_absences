import type { NextFunction, Response } from "express";
import { teacherService } from "../services/teacher.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const teacherController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await teacherService.list(req.query as Record<string, unknown>, req.user!.schoolId);
      return res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) { return next(e); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await teacherService.create(req.body, req.user!.schoolId);
      await audit(req, "CREATE", "User", (data as { id: string }).id);
      return res.status(201).json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await teacherService.update((req.params.id as string), req.body, req.user!.schoolId);
      await audit(req, "UPDATE", "User", (req.params.id as string));
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await teacherService.remove((req.params.id as string), req.user!.schoolId);
      await audit(req, "DELETE", "User", (req.params.id as string));
      return res.status(204).send();
    } catch (e) { return next(e); }
  },
};
