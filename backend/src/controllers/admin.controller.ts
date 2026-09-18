import type { NextFunction, Response } from "express";
import { prisma } from "../config/database.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import type { AuthRequest } from "../types/index.js";

export const auditController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip, take } = parsePagination(req.query as Record<string, unknown>);
      const where: Record<string, unknown> = {};
      if (req.user!.role !== "SUPER_ADMIN") (where as Record<string, unknown>).schoolId = req.user!.schoolId;
      else if (req.query.schoolId) (where as Record<string, unknown>).schoolId = req.query.schoolId;
      if (req.query.entity) (where as Record<string, unknown>).entity = req.query.entity;
      if (req.query.userId) (where as Record<string, unknown>).userId = req.query.userId;
      const [data, total] = await Promise.all([
        prisma.auditLog.findMany({ where: where as never, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.auditLog.count({ where: where as never }),
      ]);
      return res.json({ success: true, data, pagination: paginationMeta(total, page, limit) });
    } catch (e) { return next(e); }
  },
};

export const smsConfigController = {
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cfg = await prisma.smsConfig.findUnique({ where: { schoolId: req.user!.schoolId! } });
      const safe = cfg ? { ...cfg, apiKey: cfg.apiKey ? "••••••" : null } : null;
      return res.json({ success: true, data: safe });
    } catch (e) { return next(e); }
  },
  async upsert(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { provider, apiUrl, apiKey, senderId, isActive } = req.body as Record<string, string | boolean | null>;
      const data = await prisma.smsConfig.upsert({
        where: { schoolId: req.user!.schoolId! },
        update: {
          provider: provider as string,
          apiUrl: (apiUrl as string) || null,
          ...(apiKey ? { apiKey: apiKey as string } : {}),
          senderId: (senderId as string) || null,
          isActive: (isActive as boolean) ?? true,
        },
        create: {
          schoolId: req.user!.schoolId!,
          provider: provider as string,
          apiUrl: (apiUrl as string) || null,
          apiKey: (apiKey as string) || null,
          senderId: (senderId as string) || null,
        },
      });
      return res.json({ success: true, data: { ...data, apiKey: data.apiKey ? "••••••" : null } });
    } catch (e) { return next(e); }
  },
};
