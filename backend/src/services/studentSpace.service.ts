import { prisma } from "../config/database.js";
import { notFound } from "../utils/errors.js";
import type { StudentContext } from "../middlewares/studentAccess.js";
import { gradeReport, type GradeFilters } from "./grade.service.js";
import { timetableService } from "./timetable.service.js";

/**
 * Espace étudiant. Toutes les données personnelles sont lues à partir de l'élève du jeton
 * (StudentContext) : aucun identifiant d'élève n'est accepté depuis la requête.
 */
export const studentSpaceService = {
  async me(ctx: StudentContext) {
    const s = await prisma.student.findUnique({
      where: { id: ctx.studentId },
      include: {
        class: { select: { id: true, name: true, level: true, academicYear: true } },
        school: { select: { id: true, name: true, city: true } },
        user: { select: { username: true, lastLoginAt: true } },
      },
    });
    if (!s) throw notFound("Fiche élève introuvable", "STUDENT_NOT_FOUND");
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`,
      studentNumber: s.studentNumber,
      email: s.email,
      class: s.class,
      school: s.school,
      account: { username: s.user?.username ?? null, lastLoginAt: s.user?.lastLoginAt?.toISOString() ?? null },
    };
  },

  /** Relevé de l'élève connecté ; les matières proposées en filtre sont celles où il a des notes */
  async grades(ctx: StudentContext, query: GradeFilters) {
    const [report, subjects] = await Promise.all([
      gradeReport(ctx.schoolId, ctx.studentId, query),
      prisma.subject.findMany({
        where: { schoolId: ctx.schoolId, evaluations: { some: { grades: { some: { studentId: ctx.studentId } } } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { ...report, availableSubjects: subjects };
  },

  async timetable(ctx: StudentContext) {
    return timetableService.forClass(ctx.schoolId, ctx.classId);
  },

  async classes(ctx: StudentContext) {
    const classes = await timetableService.classes(ctx.schoolId);
    return { myClassId: ctx.classId, classes };
  },

  async classTimetable(ctx: StudentContext, classId: string) {
    return timetableService.forClass(ctx.schoolId, classId);
  },
};
