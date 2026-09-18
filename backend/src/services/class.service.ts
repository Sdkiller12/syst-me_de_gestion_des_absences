import { prisma } from "../config/database.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { notFound } from "../utils/errors.js";

export const classService = {
  async list(query: Record<string, unknown>, schoolId: string | null) {
    const { page, limit, skip, take } = parsePagination(query);
    const search = (query.search as string | undefined)?.trim();
    const academicYear = query.academicYear as string | undefined;
    const where: Record<string, unknown> = {};
    if (schoolId) where.schoolId = schoolId;
    if (search) (where as Record<string, unknown>).name = { contains: search, mode: "insensitive" };
    if (academicYear) (where as Record<string, unknown>).academicYear = academicYear;

    const [data, total] = await Promise.all([
      prisma.class.findMany({
        where: where as never,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { students: true } } },
      }),
      prisma.class.count({ where: where as never }),
    ]);

    const mapped = data.map((c) => ({
      id: c.id,
      name: c.name,
      academicYear: c.academicYear,
      level: c.level,
      section: c.section,
      studentCount: (c as unknown as { _count: { students: number } })._count.students,
      createdAt: c.createdAt.toISOString(),
    }));
    return { data: mapped, pagination: paginationMeta(total, page, limit) };
  },

  async getById(id: string, schoolId: string | null) {
    const cls = await prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!cls || (schoolId && cls.schoolId !== schoolId)) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
    return {
      id: cls.id,
      name: cls.name,
      academicYear: cls.academicYear,
      level: cls.level,
      section: cls.section,
      studentCount: (cls as unknown as { _count: { students: number } })._count.students,
      createdAt: cls.createdAt.toISOString(),
    };
  },

  async create(payload: { name: string; academicYear: string; level?: string; section?: string }, schoolId: string) {
    const created = await prisma.class.create({ data: { ...payload, schoolId } });
    return { id: created.id, name: created.name, academicYear: created.academicYear, studentCount: 0, createdAt: created.createdAt.toISOString() };
  },

  async update(id: string, payload: { name?: string; academicYear?: string; level?: string; section?: string }, schoolId: string | null) {
    await this.getById(id, schoolId);
    const updated = await prisma.class.update({ where: { id }, data: payload });
    return { id: updated.id, name: updated.name, academicYear: updated.academicYear, createdAt: updated.createdAt.toISOString() };
  },

  async remove(id: string, schoolId: string | null) {
    await this.getById(id, schoolId);
    await prisma.class.delete({ where: { id } });
  },
};
