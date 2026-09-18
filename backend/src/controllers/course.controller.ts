import type { NextFunction, Response } from "express";
import { courseService } from "../services/course.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const courseController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await courseService.list(req.query as Record<string, unknown>, req.user!.schoolId, req.user!);
      return res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) { return next(e); }
  },
  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await courseService.getById((req.params.id as string), req.user!.schoolId);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.role === "TEACHER" ? req.user!.id : (req.body.teacherId as string) ?? req.user!.id;
      const data = await courseService.create({ ...req.body, teacherId }, req.user!.schoolId);
      await audit(req, "CREATE", "Course", (data as { id: string }).id);
      return res.status(201).json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await courseService.update((req.params.id as string), req.body, req.user!.schoolId);
      await audit(req, "UPDATE", "Course", (req.params.id as string));
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await courseService.remove((req.params.id as string), req.user!.schoolId);
      await audit(req, "DELETE", "Course", (req.params.id as string));
      return res.status(204).send();
    } catch (e) { return next(e); }
  },
};
