import { prisma } from "../config/database.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { notFound, badRequest, forbidden } from "../utils/errors.js";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export const courseService = {
  async list(query: Record<string, unknown>, schoolId: string | null, requester?: { id: string; role: string }) {
    const sid = scope(schoolId);
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, unknown> = { schoolId: sid };
    if (query.classId) {
      const cls = await prisma.class.findUnique({ where: { id: query.classId as string } });
      if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
      (where as Record<string, unknown>).classId = query.classId;
    }
    // TEACHER sees only own courses unless admin
    if (requester?.role === "TEACHER") (where as Record<string, unknown>).teacherId = requester.id;
    else if (query.teacherId) (where as Record<string, unknown>).teacherId = query.teacherId;
    if (query.date) (where as Record<string, unknown>).date = new Date(query.date as string);
    if (query.startDate || query.endDate) {
      (where as Record<string, unknown>).date = {
        gte: query.startDate ? new Date(query.startDate as string) : undefined,
        lte: query.endDate ? new Date(query.endDate as string) : undefined,
      };
    }
    const [data, total] = await Promise.all([
      prisma.course.findMany({
        where: where as never,
        skip,
        take,
        orderBy: [{ date: "desc" }, { startTime: "asc" }],
        include: { class: { select: { name: true } }, teacher: { select: { name: true, firstName: true, lastName: true } } },
      }),
      prisma.course.count({ where: where as never }),
    ]);
    const mapped = data.map((c) => ({
      id: c.id,
      subject: c.subject,
      name: c.subject,
      classId: c.classId,
      className: (c as unknown as { class: { name: string } }).class?.name,
      teacherId: c.teacherId,
      teacherName: (c as unknown as { teacher: { name: string } }).teacher?.name,
      date: c.date.toISOString().slice(0, 10),
      startTime: c.startTime,
      endTime: c.endTime,
      room: c.room,
      createdAt: c.createdAt.toISOString(),
    }));
    return { data: mapped, pagination: paginationMeta(total, page, limit) };
  },

  async getById(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const c = await prisma.course.findUnique({ where: { id }, include: { class: true, teacher: true } });
    if (!c || c.schoolId !== sid) throw notFound("Cours introuvable", "COURSE_NOT_FOUND");
    return {
      id: c.id,
      subject: c.subject,
      name: c.subject,
      classId: c.classId,
      className: c.class.name,
      teacherId: c.teacherId,
      teacherName: c.teacher.name,
      date: c.date.toISOString().slice(0, 10),
      startTime: c.startTime,
      endTime: c.endTime,
      room: c.room,
      createdAt: c.createdAt.toISOString(),
    };
  },

  async create(payload: { subject: string; classId: string; teacherId: string; date: string; startTime: string; endTime: string; room?: string }, schoolId: string | null) {
    const sid = scope(schoolId);
    const cls = await prisma.class.findUnique({ where: { id: payload.classId } });
    if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
    const teacher = await prisma.user.findUnique({ where: { id: payload.teacherId } });
    if (!teacher || teacher.schoolId !== sid) throw notFound("Enseignant introuvable", "NOT_FOUND");
    if (teacher.role !== "TEACHER" && teacher.role !== "SCHOOL_ADMIN") throw badRequest("teacherId doit être un enseignant");
    if (payload.startTime >= payload.endTime) throw badRequest("Heure de fin doit être après heure de début");
    return prisma.course.create({
      data: {
        schoolId: sid,
        subject: payload.subject,
        classId: payload.classId,
        teacherId: payload.teacherId,
        date: new Date(payload.date),
        startTime: payload.startTime,
        endTime: payload.endTime,
        room: payload.room || null,
      },
    });
  },

  async update(id: string, payload: Partial<{ subject: string; date: string; startTime: string; endTime: string; classId: string; room: string }>, schoolId: string | null) {
    const sid = scope(schoolId);
    await this.getById(id, sid);
    const data: Record<string, unknown> = {};
    if (payload.subject) data.subject = payload.subject;
    if (payload.date) data.date = new Date(payload.date);
    if (payload.startTime) data.startTime = payload.startTime;
    if (payload.endTime) data.endTime = payload.endTime;
    if (payload.room !== undefined) data.room = payload.room || null;
    if (payload.classId) {
      const cls = await prisma.class.findUnique({ where: { id: payload.classId } });
      if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
      data.classId = payload.classId;
    }
    return prisma.course.update({ where: { id }, data: data as never });
  },

  async remove(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    await this.getById(id, sid);
    await prisma.course.delete({ where: { id } });
  },
};
