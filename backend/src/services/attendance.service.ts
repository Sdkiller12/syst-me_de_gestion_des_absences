import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { AppError, notFound, forbidden } from "../utils/errors.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { buildAbsenceMessage, buildJustificationMessage } from "../utils/smsMessage.js";
import { smsQueue } from "./smsQueue.js";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

type Status = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED";

// ---------------------------------------------------------------------------
// Typed Prisma includes — eliminates all (as unknown as ...) casts
// ---------------------------------------------------------------------------
const attendanceWithDetails = {
  student: { select: { firstName: true, lastName: true } },
  course: { select: { subject: true, date: true, startTime: true, class: { select: { name: true } } } },
} satisfies Prisma.AttendanceInclude;

type AttendanceWithDetails = Prisma.AttendanceGetPayload<{
  include: typeof attendanceWithDetails;
}>;

function mapAttendance(a: AttendanceWithDetails) {
  return {
    id: a.id,
    courseId: a.courseId,
    studentId: a.studentId,
    studentName: `${a.student.lastName} ${a.student.firstName}`,
    className: a.course.class.name,
    subject: a.course.subject,
    date: a.course.date.toISOString().slice(0, 10),
    status: a.status,
    absenceTime: a.absenceTime?.toISOString() ?? null,
    justification: a.justification,
    recordedAt: a.recordedAt.toISOString(),
  };
}

export const attendanceService = {
  async list(
    query: Record<string, unknown>,
    schoolId: string | null,
    requester?: { id: string; role: string },
  ) {
    const sid = scope(schoolId);
    const { page, limit, skip, take } = parsePagination(query);
    const where: Prisma.AttendanceWhereInput = {};

    if (query.courseId) {
      const course = await prisma.course.findUnique({ where: { id: query.courseId as string } });
      if (!course || course.schoolId !== sid) throw notFound("Cours introuvable", "COURSE_NOT_FOUND");
      where.courseId = query.courseId as string;
    } else {
      const courseFilter: Prisma.CourseWhereInput = { schoolId: sid };
      if (query.classId) courseFilter.classId = query.classId as string;
      if (query.startDate || query.endDate) {
        courseFilter.date = {
          gte: query.startDate ? new Date(query.startDate as string) : undefined,
          lte: query.endDate ? new Date(query.endDate as string) : undefined,
        };
      }
      if (requester?.role === "TEACHER") {
        courseFilter.teacherId = requester.id;
      }
      where.course = courseFilter;
    }

    if (query.studentId) where.studentId = query.studentId as string;
    if (query.status) where.status = query.status as Status;

    const [data, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: attendanceWithDetails,
      }),
      prisma.attendance.count({ where }),
    ]);

    return { data: data.map(mapAttendance), pagination: paginationMeta(total, page, limit) };
  },

  async byCourse(courseId: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.schoolId !== sid) throw notFound("Cours introuvable", "COURSE_NOT_FOUND");

    const data = await prisma.attendance.findMany({
      where: { courseId },
      include: attendanceWithDetails,
      orderBy: { createdAt: "asc" },
    });
    return data.map(mapAttendance);
  },

  async save(
    payload: {
      courseId: string;
      records: Array<{ studentId: string; status: Status; justification?: string }>;
    },
    schoolId: string | null,
    recordedBy?: string,
  ) {
    const sid = scope(schoolId);
    const course = await prisma.course.findUnique({
      where: { id: payload.courseId },
      include: { class: true },
    });
    if (!course || course.schoolId !== sid) throw notFound("Cours introuvable", "COURSE_NOT_FOUND");
    if (payload.records.length === 0) throw new AppError(400, "Aucun enregistrement", "VALIDATION_ERROR");

    const studentIds = payload.records.map((r) => r.studentId);
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, schoolId: sid },
    });
    if (students.length !== studentIds.length) {
      throw new AppError(400, "Un ou plusieurs étudiants introuvables", "STUDENT_NOT_FOUND");
    }
    for (const s of students) {
      if (s.classId !== course.classId) {
        throw new AppError(
          400,
          `L'étudiant ${s.firstName} ${s.lastName} n'appartient pas à la classe du cours`,
          "VALIDATION_ERROR",
        );
      }
    }

    const seen = new Set<string>();
    for (const r of payload.records) {
      if (seen.has(r.studentId)) throw new AppError(400, "Doublon dans les enregistrements", "VALIDATION_ERROR");
      seen.add(r.studentId);
    }

    const now = new Date();
    const courseDate = course.date.toISOString().slice(0, 10);

    await prisma.$transaction(async (tx) => {
      for (const r of payload.records) {
        const res = await tx.attendance.upsert({
          where: { courseId_studentId: { courseId: payload.courseId, studentId: r.studentId } },
          update: {
            status: r.status as never,
            recordedBy,
            justification: r.justification ?? null,
            absenceTime: r.status === "ABSENT" ? now : null,
          },
          create: {
            courseId: payload.courseId,
            studentId: r.studentId,
            status: r.status as never,
            recordedBy,
            justification: r.justification ?? null,
            absenceTime: r.status === "ABSENT" ? now : null,
          },
        });

        if (res.status === "ABSENT") {
          const existing = await tx.smsLog.findUnique({ where: { attendanceId: res.id } });
          if (existing) continue;
          const st = students.find((s) => s.id === r.studentId)!;
          const recipient = st.parentPhone || st.phone;
          // Use sanitised message builder to prevent SMS injection
          const message = buildAbsenceMessage({
            firstName: st.firstName,
            lastName: st.lastName,
            subject: course.subject,
            date: courseDate,
            startTime: course.startTime,
          });
          await tx.smsLog.create({
            data: {
              schoolId: sid,
              studentId: r.studentId,
              attendanceId: res.id,
              recipient,
              phone: recipient,
              message,
              status: "PENDING",
              provider: "mock",
            },
          });
        }
      }
    });

    // Fire-and-forget: presence is already persisted, worker drains PENDING SMS
    smsQueue.enqueueDrain();

    const result = await prisma.attendance.findMany({
      where: { courseId: payload.courseId, studentId: { in: studentIds } },
      include: attendanceWithDetails,
    });
    return result.map(mapAttendance);
  },

  async updateOne(
    id: string,
    status: Status,
    justification: string | null,
    schoolId: string | null,
  ) {
    const sid = scope(schoolId);
    const att = await prisma.attendance.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!att || att.course.schoolId !== sid) throw notFound("Présence introuvable", "NOT_FOUND");

    const previousStatus = att.status;

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        status: status as never,
        justification,
        absenceTime: status === "ABSENT" ? new Date() : null,
      },
    });

    // Send absence SMS if newly marked absent
    if (status === "ABSENT") {
      const existing = await prisma.smsLog.findUnique({ where: { attendanceId: id } });
      if (!existing) {
        const st = await prisma.student.findUnique({ where: { id: att.studentId } });
        if (st) {
          const recipient = st.parentPhone || st.phone;
          const message = buildAbsenceMessage({
            firstName: st.firstName,
            lastName: st.lastName,
            subject: att.course.subject,
            date: att.course.date.toISOString().slice(0, 10),
            startTime: att.course.startTime,
          });
          await prisma.smsLog.create({
            data: {
              schoolId: sid,
              studentId: st.id,
              attendanceId: id,
              recipient,
              phone: recipient,
              message,
              status: "PENDING",
              provider: "mock",
            },
          });
          smsQueue.enqueueDrain();
        }
      }
    }

    // #10 — Send justification confirmation SMS when status changes ABSENT → JUSTIFIED
    if (status === "JUSTIFIED" && previousStatus === "ABSENT") {
      const st = await prisma.student.findUnique({ where: { id: att.studentId } });
      if (st) {
        const recipient = st.parentPhone || st.phone;
        if (recipient) {
          const message = buildJustificationMessage({
            firstName: st.firstName,
            lastName: st.lastName,
            subject: att.course.subject,
            date: att.course.date.toISOString().slice(0, 10),
          });
          // Justification is a confirmation, not an absence alert — send directly via smsService
          // without blocking the response (fire-and-forget).
          const { smsService } = await import("./sms.service.js");
          void smsService.sendSms(recipient, message, sid).catch(() => null);
        }
      }
    }

    return updated;
  },
};
