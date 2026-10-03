import type { Request } from "express";
import { teacherService } from "../services/teacher.service.js";
import { teacherImportService } from "../services/teacherImport.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

const ctx = (req: Request) => req as AuthRequest;
const sid = (req: Request) => ctx(req).user!.schoolId;
const id = (req: Request) => req.params.id as string;

// Les mots de passe temporaires ne sont renvoyés qu'une fois, dans la réponse, et jamais journalisés.
export const teacherController = {
  list: asyncHandler(async (req, res) => {
    const result = await teacherService.list(req.query as Record<string, unknown>, sid(req));
    res.json({ success: true, data: result.data, pagination: result.pagination });
  }),

  stats: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherService.stats(sid(req)) });
  }),

  getOne: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherService.getById(id(req), sid(req)) });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await teacherService.create(req.body, sid(req));
    await audit(ctx(req), "CREATE", "Teacher", data.id);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await teacherService.update(id(req), req.body, sid(req));
    await audit(ctx(req), "UPDATE", "Teacher", data.id);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req, res) => {
    await teacherService.remove(id(req), sid(req));
    await audit(ctx(req), "DELETE", "Teacher", id(req));
    res.status(204).send();
  }),

  createAccount: asyncHandler(async (req, res) => {
    const data = await teacherService.createAccount(id(req), sid(req));
    await audit(ctx(req), "ACCOUNT_CREATE", "Teacher", data.teacherId, { username: data.username });
    res.status(201).json({ success: true, data });
  }),

  createAccounts: asyncHandler(async (req, res) => {
    const data = await teacherService.createAccounts((req.body as { teacherIds?: string[] }).teacherIds, sid(req));
    await audit(ctx(req), "ACCOUNT_CREATE_BULK", "Teacher", undefined, { created: data.created.length, skipped: data.skipped });
    res.status(201).json({ success: true, data });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const data = await teacherService.resetPassword(id(req), sid(req));
    await audit(ctx(req), "PASSWORD_RESET", "Teacher", data.teacherId);
    res.json({ success: true, data });
  }),

  setAccountStatus: asyncHandler(async (req, res) => {
    const { isActive } = req.body as { isActive: boolean };
    const data = await teacherService.setAccountStatus(id(req), isActive, sid(req));
    await audit(ctx(req), isActive ? "ACCOUNT_ENABLE" : "ACCOUNT_DISABLE", "Teacher", data.id);
    res.json({ success: true, data });
  }),

  listAssignments: asyncHandler(async (req, res) => {
    const data = await teacherService.listAssignments(id(req), sid(req), req.query.academicYear as string | undefined);
    res.json({ success: true, data });
  }),

  createAssignments: asyncHandler(async (req, res) => {
    const data = await teacherService.createAssignments(id(req), req.body, sid(req));
    await audit(ctx(req), "ASSIGNMENT_CREATE", "Teacher", id(req), data);
    res.status(201).json({ success: true, data });
  }),

  deleteAssignment: asyncHandler(async (req, res) => {
    await teacherService.deleteAssignment(id(req), req.params.assignmentId as string, sid(req));
    await audit(ctx(req), "ASSIGNMENT_DELETE", "TeachingAssignment", req.params.assignmentId as string);
    res.status(204).send();
  }),

  schoolAssignments: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherService.listSchoolAssignments(req.query as Record<string, unknown>, sid(req)) });
  }),

  importPreview: asyncHandler(async (req, res) => {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new AppError(400, "Veuillez sélectionner un fichier (.xlsx, .xls ou .pdf)", "VALIDATION_ERROR");
    res.json({ success: true, data: await teacherImportService.preview(file.buffer, file.originalname, sid(req)) });
  }),

  importRevalidate: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherImportService.revalidate(req.body.rows, sid(req)) });
  }),

  importConfirm: asyncHandler(async (req, res) => {
    const data = await teacherImportService.confirm(req.body.rows, sid(req));
    await audit(ctx(req), "IMPORT", "Teacher", undefined, {
      teachersCreated: data.teachersCreated,
      subjectsCreated: data.subjectsCreated,
      assignmentsCreated: data.assignmentsCreated,
    });
    res.json({ success: true, data });
  }),
};
