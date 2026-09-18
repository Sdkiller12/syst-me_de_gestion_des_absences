import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { forbidden } from "../utils/errors.js";
import { withCache, dashboardStatsKey } from "../utils/cache.js";

const DASHBOARD_TTL_SEC = 60; // 1 minute TTL

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

async function fetchStats(
  sid: string,
  requester?: { id: string; role: string },
) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  // ---------------------------------------------------------------------------
  // Course filter as a sub-query predicate — no courseId array pre-fetch
  // ---------------------------------------------------------------------------
  const courseFilter: Prisma.CourseWhereInput = { schoolId: sid };
  if (requester?.role === "TEACHER") {
    courseFilter.teacherId = requester.id;
  }

  const attendanceCourseFilter: Prisma.AttendanceWhereInput = {
    course: courseFilter,
  };

  const [
    students,
    classes,
    courses,
    todayAbsences,
    weekAbsences,
    todayPresences,
    smsSent,
    smsFailed,
    totalAttendances,
    presentCount,
    recentAbsences,
    recentNotifications,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId: sid } }),
    prisma.class.count({ where: { schoolId: sid } }),
    prisma.course.count({ where: { schoolId: sid } }),

    prisma.attendance.count({
      where: { ...attendanceCourseFilter, status: "ABSENT", recordedAt: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.attendance.count({
      where: { ...attendanceCourseFilter, status: "ABSENT", recordedAt: { gte: sevenDaysAgo } },
    }),
    prisma.attendance.count({
      where: { ...attendanceCourseFilter, status: "PRESENT", recordedAt: { gte: startOfDay, lte: endOfDay } },
    }),

    prisma.smsLog.count({ where: { status: "SENT", schoolId: sid } }),
    prisma.smsLog.count({ where: { status: "FAILED", schoolId: sid } }),

    prisma.attendance.count({ where: attendanceCourseFilter }),
    prisma.attendance.count({ where: { ...attendanceCourseFilter, status: "PRESENT" } }),

    prisma.attendance.findMany({
      where: { ...attendanceCourseFilter, status: "ABSENT" },
      orderBy: { recordedAt: "desc" },
      take: 5,
      include: {
        student: { select: { firstName: true, lastName: true } },
        course: { select: { subject: true, class: { select: { name: true } } } },
      },
    }),

    prisma.smsLog.findMany({
      where: { schoolId: sid },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { student: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return {
    students,
    classes,
    courses,
    todayAbsences,
    weekAbsences,
    todayPresences,
    smsSent,
    smsFailed,
    presenceRate: totalAttendances
      ? Math.round((presentCount / totalAttendances) * 100)
      : 0,
    recentAbsences: recentAbsences.map((a) => ({
      id: a.id,
      studentName: `${a.student.lastName} ${a.student.firstName}`,
      className: a.course.class.name,
      subject: a.course.subject,
      recordedAt: a.recordedAt.toISOString(),
    })),
    recentNotifications: recentNotifications.map((n) => ({
      id: n.id,
      studentName: `${n.student.lastName} ${n.student.firstName}`,
      status: n.status,
      sentAt: n.sentAt?.toISOString() ?? n.createdAt.toISOString(),
    })),
  };
}

export const dashboardService = {
  async stats(schoolId: string | null, requester?: { id: string; role: string }) {
    const sid = scope(schoolId);
    const cacheKey = dashboardStatsKey(sid, requester?.role ?? "ADMIN", requester?.id);
    return withCache(cacheKey, DASHBOARD_TTL_SEC, () => fetchStats(sid, requester));
  },

  async attendanceChart(schoolId: string | null, days = 7) {
    const sid = scope(schoolId);
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    return prisma.attendance.groupBy({
      by: ["status"],
      where: { recordedAt: { gte: since }, course: { schoolId: sid } },
      _count: { status: true },
    });
  },
};
