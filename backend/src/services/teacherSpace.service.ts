import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { AppError, badRequest, forbidden, notFound } from "../utils/errors.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { addMinutes, businessNow } from "../utils/businessTime.js";
import { assignmentForCourse, loadAuthorizedCourse, type TeacherContext } from "../middlewares/teacherAccess.js";
import { attendanceService } from "./attendance.service.js";

type Status = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED";
const STATUSES: Status[] = ["PRESENT", "ABSENT", "LATE", "JUSTIFIED"];

/** Pré-filtre SQL des cours de l'enseignant, affiné ensuite par assignmentForCourse */
function myCoursesWhere(ctx: TeacherContext): Prisma.CourseWhereInput {
  return {
    schoolId: ctx.schoolId,
    OR: [
      { assignmentId: { in: ctx.assignments.map((a) => a.id) } },
      { teacherId: ctx.userId, classId: { in: [...new Set(ctx.assignments.map((a) => a.classId))] } },
    ],
  };
}

async function countsByCourse(courseIds: string[]) {
  const groups = courseIds.length
    ? await prisma.attendance.groupBy({ by: ["courseId", "status"], where: { courseId: { in: courseIds } }, _count: { _all: true } })
    : [];
  const out = new Map<string, Record<Status, number> & { total: number }>();
  for (const g of groups) {
    const c = out.get(g.courseId) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, total: 0 };
    c[g.status as Status] += g._count._all;
    c.total += g._count._all;
    out.set(g.courseId, c);
  }
  return out;
}

const emptyCounts = () => ({ PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, total: 0 });

type CourseRow = Prisma.CourseGetPayload<{ include: { class: { select: { name: true } } } }>;

function mapCourse(c: CourseRow, counts?: ReturnType<typeof emptyCounts>) {
  return {
    id: c.id,
    subject: c.subject,
    subjectId: c.subjectId,
    classId: c.classId,
    className: c.class.name,
    assignmentId: c.assignmentId,
    date: c.date.toISOString().slice(0, 10),
    startTime: c.startTime,
    endTime: c.endTime,
    room: c.room,
    attendanceTaken: (counts?.total ?? 0) > 0,
    counts: counts ?? emptyCounts(),
  };
}

async function studentsOfClass(schoolId: string, classId: string) {
  return prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: { id: true, firstName: true, lastName: true, studentNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export const teacherSpaceService = {
  async me(ctx: TeacherContext) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: ctx.teacherId },
      include: {
        school: { select: { id: true, name: true, city: true } },
        user: { select: { username: true, email: true, lastLoginAt: true } },
      },
    });
    if (!teacher) throw notFound("Fiche enseignant introuvable", "TEACHER_NOT_FOUND");
    const subjects = new Map(ctx.assignments.map((a) => [a.subjectId, a.subjectName]));
    return {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      fullName: `${teacher.firstName} ${teacher.lastName}`,
      phone: teacher.phone,
      email: teacher.email,
      employeeNumber: teacher.employeeNumber,
      school: teacher.school,
      account: {
        username: teacher.user?.username ?? null,
        email: teacher.user?.email ?? null,
        lastLoginAt: teacher.user?.lastLoginAt?.toISOString() ?? null,
      },
      subjects: [...subjects].map(([id, name]) => ({ id, name })),
      assignments: ctx.assignments.map((a) => ({
        id: a.id,
        academicYear: a.academicYear,
        subject: { id: a.subjectId, name: a.subjectName },
        class: { id: a.classId, name: a.className },
      })),
    };
  },

  async dashboard(ctx: TeacherContext) {
    const { date, dateValue } = businessNow();
    const weekAgo = new Date(dateValue.getTime() - 6 * 86_400_000);
    const base = myCoursesWhere(ctx);
    const [todayRaw, weekRaw] = await Promise.all([
      prisma.course.findMany({ where: { ...base, date: dateValue }, include: { class: { select: { name: true } } }, orderBy: { startTime: "asc" } }),
      prisma.course.findMany({ where: { ...base, date: { gte: weekAgo, lte: dateValue } }, select: { id: true, classId: true, teacherId: true, assignmentId: true, subjectId: true, subject: true } }),
    ]);
    const today = todayRaw.filter((c) => assignmentForCourse(ctx, c));
    const weekIds = weekRaw.filter((c) => assignmentForCourse(ctx, c)).map((c) => c.id);
    const counts = await countsByCourse([...new Set([...today.map((c) => c.id), ...weekIds])]);
    const sum = (ids: string[], s: Status) => ids.reduce((n, id) => n + (counts.get(id)?.[s] ?? 0), 0);

    return {
      date,
      teacherName: `${ctx.firstName} ${ctx.lastName}`,
      classes: new Set(ctx.assignments.map((a) => a.classId)).size,
      subjects: new Set(ctx.assignments.map((a) => a.subjectId)).size,
      assignments: ctx.assignments.length,
      coursesToday: today.length,
      callsPending: today.filter((c) => !counts.get(c.id)?.total).length,
      absencesToday: sum(today.map((c) => c.id), "ABSENT"),
      lateToday: sum(today.map((c) => c.id), "LATE"),
      absencesWeek: sum(weekIds, "ABSENT"),
      sessionsWeek: weekIds.filter((id) => counts.get(id)?.total).length,
      todayCourses: today.map((c) => mapCourse(c, counts.get(c.id))),
    };
  },

  async classes(ctx: TeacherContext) {
    const classIds = [...new Set(ctx.assignments.map((a) => a.classId))];
    const [classes, studentCounts] = await Promise.all([
      prisma.class.findMany({ where: { id: { in: classIds }, schoolId: ctx.schoolId }, orderBy: { name: "asc" } }),
      prisma.student.groupBy({ by: ["classId"], where: { classId: { in: classIds }, isActive: true }, _count: { _all: true } }),
    ]);
    const countOf = new Map(studentCounts.map((g) => [g.classId, g._count._all]));
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      academicYear: c.academicYear,
      level: c.level,
      studentCount: countOf.get(c.id) ?? 0,
      assignments: ctx.assignments
        .filter((a) => a.classId === c.id)
        .map((a) => ({ id: a.id, subjectId: a.subjectId, subjectName: a.subjectName, academicYear: a.academicYear })),
    }));
  },

  async classStudents(ctx: TeacherContext, classId: string) {
    if (!ctx.assignments.some((a) => a.classId === classId)) throw forbidden("Vous n'êtes pas affecté à cette classe", "NOT_ASSIGNED");
    return studentsOfClass(ctx.schoolId, classId);
  },

  /** Cours planifiés rattachés aux affectations (par défaut : aujourd'hui et les 6 jours suivants) */
  async courses(ctx: TeacherContext, query: Record<string, unknown>) {
    const { dateValue } = businessNow();
    const from = query.from ? new Date(`${query.from as string}T00:00:00.000Z`) : dateValue;
    const to = query.to ? new Date(`${query.to as string}T00:00:00.000Z`) : new Date(dateValue.getTime() + 6 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw badRequest("Dates invalides");
    const raw = await prisma.course.findMany({
      where: { ...myCoursesWhere(ctx), date: { gte: from, lte: to } },
      include: { class: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const mine = raw.filter((c) => assignmentForCourse(ctx, c));
    const counts = await countsByCourse(mine.map((c) => c.id));
    return mine.map((c) => mapCourse(c, counts.get(c.id)));
  },

  /** Feuille d'appel : cours existant (courseId) ou nouvelle séance d'une affectation (assignmentId) */
  async sheet(ctx: TeacherContext, query: { courseId?: string; assignmentId?: string }) {
    const { date, dateValue, time } = businessNow();
    if (query.courseId) {
      const { course, assignment } = await loadAuthorizedCourse(ctx, query.courseId);
      const [students, records] = await Promise.all([
        studentsOfClass(ctx.schoolId, course.classId),
        prisma.attendance.findMany({ where: { courseId: course.id }, select: { studentId: true, status: true } }),
      ]);
      const statusOf = new Map(records.map((r) => [r.studentId, r.status]));
      return {
        mode: "COURSE" as const,
        course: mapCourse(course),
        assignment: { id: assignment.id, subjectName: assignment.subjectName, className: assignment.className },
        date: course.date.toISOString().slice(0, 10),
        time: course.startTime,
        alreadyRecorded: records.length > 0,
        students: students.map((s) => ({ ...s, status: statusOf.get(s.id) ?? null })),
      };
    }
    if (!query.assignmentId) throw badRequest("courseId ou assignmentId requis");
    const assignment = ctx.assignments.find((a) => a.id === query.assignmentId);
    if (!assignment) throw forbidden("Cette affectation ne vous appartient pas", "NOT_ASSIGNED");
    const [students, todaySessions] = await Promise.all([
      studentsOfClass(ctx.schoolId, assignment.classId),
      prisma.course.findMany({
        where: { assignmentId: assignment.id, date: dateValue },
        include: { class: { select: { name: true } } },
        orderBy: { startTime: "asc" },
      }),
    ]);
    const counts = await countsByCourse(todaySessions.map((c) => c.id));
    return {
      mode: "NEW_SESSION" as const,
      course: null,
      assignment: { id: assignment.id, subjectName: assignment.subjectName, className: assignment.className },
      date,
      time,
      alreadyRecorded: false,
      // Séances déjà tenues aujourd'hui pour cette affectation : évite un double appel involontaire
      todaySessions: todaySessions.map((c) => mapCourse(c, counts.get(c.id))),
      students: students.map((s) => ({ ...s, status: null })),
    };
  },

  /**
   * Enregistre l'appel. Pour une nouvelle séance, le cours est créé côté serveur à la date et
   * à l'heure d'Abidjan ; les absences déclenchent la file SMS via attendanceService.
   */
  async saveAttendance(
    ctx: TeacherContext,
    payload: { courseId?: string; assignmentId?: string; durationMinutes?: number; records: Array<{ studentId: string; status: Status }> },
  ) {
    let courseId = payload.courseId;
    if (!courseId) {
      const assignment = ctx.assignments.find((a) => a.id === payload.assignmentId);
      if (!assignment) throw forbidden("Cette affectation ne vous appartient pas", "NOT_ASSIGNED");
      const { dateValue, time } = businessNow();
      const course = await prisma.course.create({
        data: {
          schoolId: ctx.schoolId,
          classId: assignment.classId,
          teacherId: ctx.userId,
          assignmentId: assignment.id,
          subjectId: assignment.subjectId,
          subject: assignment.subjectName,
          date: dateValue,
          startTime: time,
          endTime: addMinutes(time, payload.durationMinutes ?? 60),
        },
      });
      courseId = course.id;
    } else {
      await loadAuthorizedCourse(ctx, courseId);
    }

    // L'appel porte sur toute la classe : chaque élève actif doit avoir un statut
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const students = await studentsOfClass(ctx.schoolId, course.classId);
    const provided = new Set(payload.records.map((r) => r.studentId));
    const missing = students.filter((s) => !provided.has(s.id));
    if (missing.length > 0) {
      if (!payload.courseId) await prisma.course.delete({ where: { id: courseId } });
      throw new AppError(400, `Statut manquant pour ${missing.length} étudiant(s)`, "INCOMPLETE_ATTENDANCE");
    }

    try {
      await attendanceService.save({ courseId, records: payload.records }, ctx.schoolId, ctx.userId);
    } catch (e) {
      // Une séance créée pour cet appel ne doit pas rester vide si l'enregistrement échoue
      if (!payload.courseId) await prisma.course.delete({ where: { id: courseId } }).catch(() => undefined);
      throw e;
    }
    const counts = (await countsByCourse([courseId])).get(courseId) ?? emptyCounts();
    const smsQueued = await prisma.smsLog.count({ where: { attendance: { courseId }, status: "PENDING" } });
    return { courseId, counts, smsQueued };
  },

  /** Historique des appels de l'enseignant uniquement, filtrable */
  async history(ctx: TeacherContext, query: Record<string, unknown>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Prisma.CourseWhereInput = { ...myCoursesWhere(ctx), attendances: { some: {} } };
    const and: Prisma.CourseWhereInput[] = [];
    if (query.classId) and.push({ classId: query.classId as string });
    if (query.subjectId) {
      const ids = ctx.assignments.filter((a) => a.subjectId === query.subjectId).map((a) => a.id);
      and.push({ OR: [{ subjectId: query.subjectId as string }, { assignmentId: { in: ids } }] });
    }
    if (query.from || query.to) {
      and.push({
        date: {
          ...(query.from ? { gte: new Date(`${query.from as string}T00:00:00.000Z`) } : {}),
          ...(query.to ? { lte: new Date(`${query.to as string}T00:00:00.000Z`) } : {}),
        },
      });
    }
    if (query.status && STATUSES.includes(query.status as Status)) {
      and.push({ attendances: { some: { status: query.status as Status } } });
    }
    if (and.length) where.AND = and;

    // Filtrage fin (assignmentForCourse) avant pagination pour des totaux exacts
    const candidates = await prisma.course.findMany({
      where,
      select: { id: true, classId: true, teacherId: true, assignmentId: true, subjectId: true, subject: true },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    });
    const allowed = candidates.filter((c) => assignmentForCourse(ctx, c)).map((c) => c.id);
    const pageIds = allowed.slice(skip, skip + take);
    const [rows, counts] = await Promise.all([
      prisma.course.findMany({
        where: { id: { in: pageIds } },
        include: { class: { select: { name: true } } },
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
      }),
      countsByCourse(pageIds),
    ]);
    return { data: rows.map((c) => mapCourse(c, counts.get(c.id))), pagination: paginationMeta(allowed.length, page, limit) };
  },

  async session(ctx: TeacherContext, courseId: string) {
    const { course } = await loadAuthorizedCourse(ctx, courseId);
    const records = await prisma.attendance.findMany({
      where: { courseId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
        smsLogs: { select: { status: true } },
      },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    });
    const counts = (await countsByCourse([courseId])).get(courseId);
    return {
      course: mapCourse(course, counts),
      records: records.map((r) => ({
        id: r.id,
        student: r.student,
        status: r.status,
        recordedAt: r.recordedAt.toISOString(),
        smsStatus: r.smsLogs[0]?.status ?? null,
      })),
    };
  },
};
