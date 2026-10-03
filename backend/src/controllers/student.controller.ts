import type { NextFunction, Response } from "express";
import { studentService } from "../services/student.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";

export const studentController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await studentService.list(req.query as Record<string, unknown>, req.user!.schoolId);
      return res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) { return next(e); }
  },
  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await studentService.getById((req.params.id as string), req.user!.schoolId);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await studentService.create(req.body, req.user!.schoolId);
      await audit(req, "CREATE", "Student", (data as { id: string }).id);
      return res.status(201).json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await studentService.update((req.params.id as string), req.body, req.user!.schoolId);
      await audit(req, "UPDATE", "Student", (req.params.id as string));
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await studentService.remove((req.params.id as string), req.user!.schoolId);
      await audit(req, "DELETE", "Student", (req.params.id as string));
      return res.status(204).send();
    } catch (e) { return next(e); }
  },
  // Les mots de passe temporaires ne sont renvoyés qu'une fois, dans la réponse, et jamais journalisés.
  async createAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await studentService.createAccount(req.params.id as string, req.user!.schoolId);
      await audit(req, "ACCOUNT_CREATE", "Student", data.studentId, { username: data.username });
      return res.status(201).json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async createAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await studentService.createAccounts(req.body, req.user!.schoolId);
      await audit(req, "ACCOUNT_CREATE_BULK", "Student", undefined, { created: data.created.length, classId: req.body?.classId });
      return res.status(201).json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await studentService.resetPassword(req.params.id as string, req.user!.schoolId);
      await audit(req, "PASSWORD_RESET", "Student", data.studentId);
      return res.json({ success: true, data });
    } catch (e) { return next(e); }
  },
  async importExcel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const classId = (req.query.classId as string) ?? (req.body?.classId as string) ?? "";
      const file = (req as unknown as { file?: Express.Multer.File }).file;
      const result = await studentService.importExcel(file as Express.Multer.File, classId, req.user!.schoolId);
      await audit(req, "IMPORT", "Student", classId, { imported: result.imported });
      return res.json({ success: true, data: result });
    } catch (e) { return next(e); }
  },
};
