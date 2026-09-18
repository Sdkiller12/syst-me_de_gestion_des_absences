import type { NextFunction, Response } from "express";
import { classService } from "../services/class.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const classController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await classService.list(req.query as Record<string, unknown>, req.user!.schoolId);
      return res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) { return next(e); }
  },
  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await classService.getById((req.params.id as string), req.user!.schoolId);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await classService.create(req.body, req.user!.schoolId!);
      await audit(req, "CREATE", "Class", data.id);
      return res.status(201).json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await classService.update((req.params.id as string), req.body, req.user!.schoolId);
      await audit(req, "UPDATE", "Class", (req.params.id as string));
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await classService.remove((req.params.id as string), req.user!.schoolId);
      await audit(req, "DELETE", "Class", (req.params.id as string));
      return res.status(204).send();
    } catch (e) { return next(e); }
  },
};
