import type { Request } from "express";
import { subjectService } from "../services/subject.service.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const sid = (req: Request) => (req as AuthRequest).user!.schoolId;

export const subjectController = {
  list: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await subjectService.list(req.query as Record<string, unknown>, sid(req)) });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await subjectService.create(req.body, sid(req));
    await audit(req as AuthRequest, "CREATE", "Subject", data.id);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await subjectService.update(req.params.id as string, req.body, sid(req));
    await audit(req as AuthRequest, "UPDATE", "Subject", data.id);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req, res) => {
    await subjectService.remove(req.params.id as string, sid(req));
    await audit(req as AuthRequest, "DELETE", "Subject", req.params.id as string);
    res.status(204).send();
  }),
};
