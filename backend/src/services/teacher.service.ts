import bcrypt from "bcryptjs";
import { prisma } from "../config/database.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { AppError, notFound, forbidden } from "../utils/errors.js";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export const teacherService = {
  async list(query: Record<string, unknown>, schoolId: string | null) {
    const sid = scope(schoolId);
    const { page, limit, skip, take } = parsePagination(query);
    const search = (query.search as string | undefined)?.trim();
    const where: Record<string, unknown> = { schoolId: sid, role: "TEACHER" };
    if (search) {
      (where as Record<string, unknown>).OR = [
        { lastName: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: where as never,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, firstName: true, lastName: true, name: true, email: true, phone: true, isActive: true, createdAt: true },
      }),
      prisma.user.count({ where: where as never }),
    ]);
    return { data, pagination: paginationMeta(total, page, limit) };
  },

  async create(payload: { firstName: string; lastName: string; email: string; password: string; phone?: string }, schoolId: string | null) {
    const sid = scope(schoolId);
    const email = payload.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, "Un compte existe déjà avec cet email", "CONFLICT");
    const passwordHash = await bcrypt.hash(payload.password, 10);
    return prisma.user.create({
      data: {
        schoolId: sid,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim().toUpperCase(),
        name: `${payload.firstName.trim()} ${payload.lastName.trim().toUpperCase()}`,
        email,
        phone: payload.phone?.trim() || null,
        passwordHash,
        role: "TEACHER",
      },
      select: { id: true, firstName: true, lastName: true, name: true, email: true, phone: true, isActive: true, createdAt: true },
    });
  },

  async update(id: string, payload: { firstName?: string; lastName?: string; phone?: string | null; isActive?: boolean }, schoolId: string | null) {
    const sid = scope(schoolId);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.schoolId !== sid || user.role !== "TEACHER") throw notFound("Enseignant introuvable", "NOT_FOUND");
    return prisma.user.update({
      where: { id },
      data: {
        ...(payload.firstName ? { firstName: payload.firstName.trim() } : {}),
        ...(payload.lastName ? { lastName: payload.lastName.trim().toUpperCase() } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
      select: { id: true, firstName: true, lastName: true, name: true, email: true, phone: true, isActive: true, createdAt: true },
    });
  },

  async remove(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.schoolId !== sid || user.role !== "TEACHER") throw notFound("Enseignant introuvable", "NOT_FOUND");
    await prisma.user.delete({ where: { id } });
  },
};
