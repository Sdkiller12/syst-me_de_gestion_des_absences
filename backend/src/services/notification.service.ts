import { prisma } from "../config/database.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { AppError, notFound, forbidden } from "../utils/errors.js";
import { smsQueue } from "./smsQueue.js";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export const notificationService = {
  async list(query: Record<string, unknown>, schoolId: string | null) {
    const sid = scope(schoolId);
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, unknown> = { schoolId: sid };
    if (query.status) (where as Record<string, unknown>).status = query.status;
    if (query.studentId) (where as Record<string, unknown>).studentId = query.studentId;
    if (query.classId) {
      (where as Record<string, unknown>).student = { classId: query.classId as string, schoolId: sid };
    }
    const [data, total] = await Promise.all([
      prisma.smsLog.findMany({
        where: where as never,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { student: { select: { firstName: true, lastName: true, class: { select: { name: true } } } }, attendance: { include: { course: true } } },
      }),
      prisma.smsLog.count({ where: where as never }),
    ]);
    const mapped = data.map((n) => ({
      id: n.id,
      studentId: n.studentId,
      studentName: `${(n as unknown as { student: { lastName: string; firstName: string } }).student.lastName} ${(n as unknown as { student: { lastName: string; firstName: string } }).student.firstName}`,
      phone: n.phone,
      recipient: n.recipient,
      attendanceId: n.attendanceId,
      message: n.message,
      provider: n.provider,
      status: n.status,
      errorMessage: n.errorMessage ?? undefined,
      sentAt: n.sentAt?.toISOString() ?? n.createdAt.toISOString(),
    }));
    return { data: mapped, pagination: paginationMeta(total, page, limit) };
  },

  async getById(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const n = await prisma.smsLog.findUnique({ where: { id }, include: { student: true } });
    if (!n || n.schoolId !== sid) throw notFound("Notification introuvable", "NOT_FOUND");
    return n;
  },

  async retry(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const log = await prisma.smsLog.findUnique({ where: { id } });
    if (!log || log.schoolId !== sid) throw notFound("Notification introuvable", "NOT_FOUND");
    if (log.status !== "FAILED") throw new AppError(400, "Seules les notifications échouées peuvent être relancées", "VALIDATION_ERROR");
    await prisma.smsLog.update({ where: { id }, data: { status: "PENDING", errorMessage: null } });
    // Async redelivery via queue (non-blocking)
    smsQueue.enqueueDrain();
    return prisma.smsLog.findUnique({ where: { id } });
  },
};
