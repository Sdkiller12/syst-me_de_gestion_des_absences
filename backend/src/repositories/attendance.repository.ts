import { prisma } from "../config/database.js";
import type { AttendanceStatus, Prisma } from "@prisma/client";

export const attendanceRepository = {
  findMany: (args?: Prisma.AttendanceFindManyArgs) => prisma.attendance.findMany(args ?? {}),
  count: (where?: Prisma.AttendanceWhereInput) => prisma.attendance.count({ where }),
  findByCourse: (courseId: string) =>
    prisma.attendance.findMany({ where: { courseId }, include: { student: true, course: true } }),
  findById: (id: string) => prisma.attendance.findUnique({ where: { id }, include: { student: true, course: true } }),
  upsert: (data: { courseId: string; studentId: string; status: AttendanceStatus; recordedBy?: string }) =>
    prisma.attendance.upsert({
      where: { courseId_studentId: { courseId: data.courseId, studentId: data.studentId } },
      update: { status: data.status, recordedBy: data.recordedBy },
      create: { courseId: data.courseId, studentId: data.studentId, status: data.status, recordedBy: data.recordedBy },
    }),
  findByCourseAndStudent: (courseId: string, studentId: string) =>
    prisma.attendance.findUnique({ where: { courseId_studentId: { courseId, studentId } } }),
};
