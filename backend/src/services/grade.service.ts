import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { buildReport, on20, round2, summarize, weightedAverage, type ReportGrade } from "../utils/gradeStats.js";
import type { TeacherContext } from "../middlewares/teacherAccess.js";
import {
  evaluationRepository,
  gradeRepository,
  type EvaluationRow,
  type GradeRow,
} from "../repositories/grade.repository.js";

type Db = typeof prisma | Prisma.TransactionClient;
type EvaluationType = "DEVOIR" | "INTERROGATION" | "COMPOSITION" | "EXAMEN" | "AUTRE";

export interface EvaluationInput {
  classId: string;
  subjectId: string;
  title: string;
  type: EvaluationType;
  date: string;
  maxScore: number;
  coefficient: number;
}

export interface GradeEntry {
  studentId: string;
  score: number | null;
}

export interface GradeFilters {
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  studentId?: string;
  type?: EvaluationType;
  from?: string;
  to?: string;
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

function evaluationFilters(q: GradeFilters): Prisma.EvaluationWhereInput {
  return {
    ...(q.classId ? { classId: q.classId } : {}),
    ...(q.subjectId ? { subjectId: q.subjectId } : {}),
    ...(q.teacherId ? { teacherId: q.teacherId } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.from || q.to ? { date: { ...(q.from ? { gte: day(q.from) } : {}), ...(q.to ? { lte: day(q.to) } : {}) } } : {}),
  };
}

type Stats = { count: number; average: number | null; min: number | null; max: number | null };

function mapEvaluation(e: EvaluationRow, stats?: Stats) {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    date: isoDay(e.date),
    maxScore: e.maxScore,
    coefficient: e.coefficient,
    class: e.class,
    subject: e.subject,
    teacher: { id: e.teacher.id, fullName: fullName(e.teacher) },
    stats: {
      count: stats?.count ?? 0,
      average: stats?.average != null ? round2(stats.average) : null,
      min: stats?.min ?? null,
      max: stats?.max ?? null,
    },
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function mapGrade(g: GradeRow) {
  return {
    id: g.id,
    score: g.score,
    student: { id: g.student.id, firstName: g.student.firstName, lastName: g.student.lastName, studentNumber: g.student.studentNumber },
    evaluation: {
      id: g.evaluation.id,
      title: g.evaluation.title,
      type: g.evaluation.type,
      date: isoDay(g.evaluation.date),
      maxScore: g.evaluation.maxScore,
      coefficient: g.evaluation.coefficient,
    },
    class: g.evaluation.class,
    subject: g.evaluation.subject,
    teacher: { id: g.evaluation.teacher.id, fullName: fullName(g.evaluation.teacher) },
    updatedAt: g.updatedAt.toISOString(),
  };
}

function toReportGrade(g: GradeRow): ReportGrade {
  return {
    id: g.id,
    evaluationId: g.evaluation.id,
    title: g.evaluation.title,
    type: g.evaluation.type,
    date: isoDay(g.evaluation.date),
    score: g.score,
    maxScore: g.evaluation.maxScore,
    coefficient: g.evaluation.coefficient,
    subjectId: g.evaluation.subject.id,
    subjectName: g.evaluation.subject.name,
    teacherName: fullName(g.evaluation.teacher),
    updatedAt: g.updatedAt.toISOString(),
  };
}

async function activeStudents(db: Db, schoolId: string, classId: string) {
  return db.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: { id: true, firstName: true, lastName: true, studentNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/**
 * Écrit les notes d'une évaluation après contrôle serveur : chaque élève doit appartenir
 * (actif) à la classe de l'évaluation, et chaque note respecter le barème.
 */
async function applyGrades(db: Db, ev: { id: string; schoolId: string; classId: string; maxScore: number }, entries: GradeEntry[]) {
  const allowed = new Set((await activeStudents(db, ev.schoolId, ev.classId)).map((s) => s.id));
  const outsiders = entries.filter((e) => !allowed.has(e.studentId));
  if (outsiders.length > 0) {
    throw new AppError(400, `${outsiders.length} élève(s) n'appartiennent pas à cette classe`, "STUDENT_NOT_IN_CLASS");
  }
  const tooHigh = entries.filter((e) => e.score !== null && e.score > ev.maxScore);
  if (tooHigh.length > 0) {
    throw new AppError(400, `Une note ne peut pas dépasser le barème (${ev.maxScore})`, "SCORE_ABOVE_MAX");
  }
  const toSave = entries.filter((e): e is { studentId: string; score: number } => e.score !== null);
  const toClear = entries.filter((e) => e.score === null).map((e) => e.studentId);
  for (const e of toSave) await gradeRepository.upsert(db, ev.id, e.studentId, round2(e.score));
  const cleared = toClear.length ? (await gradeRepository.deleteFor(db, ev.id, toClear)).count : 0;
  return { saved: toSave.length, cleared };
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const duplicateEvaluation = () =>
  conflict("Une évaluation avec cet intitulé existe déjà à cette date pour cette classe et cette matière", "EVALUATION_EXISTS");

// ─── Enseignant ─────────────────────────────────────────────────────────────

function assignmentFor(ctx: TeacherContext, classId: string, subjectId: string) {
  return ctx.assignments.find((a) => a.classId === classId && a.subjectId === subjectId);
}

function requireAssignment(ctx: TeacherContext, classId: string, subjectId: string) {
  if (!assignmentFor(ctx, classId, subjectId)) {
    throw forbidden("Vous n'êtes pas affecté à cette matière dans cette classe", "NOT_ASSIGNED");
  }
}

/**
 * Évaluation de l'enseignant connecté. La lecture suffit d'en être l'auteur ; la modification
 * exige en plus d'être toujours affecté à la classe et à la matière.
 */
async function loadOwnEvaluation(ctx: TeacherContext, id: string, mode: "read" | "write") {
  const ev = await evaluationRepository.findById(id);
  if (!ev || ev.schoolId !== ctx.schoolId) throw notFound("Évaluation introuvable", "EVALUATION_NOT_FOUND");
  if (ev.teacherId !== ctx.teacherId) throw forbidden("Cette évaluation ne vous appartient pas", "NOT_OWNER");
  if (mode === "write") requireAssignment(ctx, ev.classId, ev.subjectId);
  return ev;
}

async function createEvaluation(db: Db, ctx: TeacherContext, input: EvaluationInput) {
  requireAssignment(ctx, input.classId, input.subjectId);
  try {
    return await evaluationRepository.create(db, {
      schoolId: ctx.schoolId,
      teacherId: ctx.teacherId,
      classId: input.classId,
      subjectId: input.subjectId,
      title: input.title.trim(),
      type: input.type,
      date: day(input.date),
      maxScore: input.maxScore,
      coefficient: input.coefficient,
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw duplicateEvaluation();
    throw e;
  }
}

export const teacherGradeService = {
  async listEvaluations(ctx: TeacherContext, query: GradeFilters & { page?: number; limit?: number }) {
    const { page, limit, skip, take } = parsePagination(query as Record<string, unknown>);
    const where: Prisma.EvaluationWhereInput = { schoolId: ctx.schoolId, teacherId: ctx.teacherId, ...evaluationFilters(query) };
    const [rows, total] = await Promise.all([evaluationRepository.findMany(where, { skip, take }), evaluationRepository.count(where)]);
    const classIds = [...new Set(rows.map((r) => r.classId))];
    const [stats, sizes] = await Promise.all([
      evaluationRepository.statsByEvaluation(rows.map((r) => r.id)),
      classIds.length
        ? prisma.student.groupBy({ by: ["classId"], where: { classId: { in: classIds }, isActive: true }, _count: { _all: true } })
        : Promise.resolve([]),
    ]);
    const sizeOf = new Map(sizes.map((s) => [s.classId, s._count._all]));
    return {
      data: rows.map((r) => ({
        ...mapEvaluation(r, stats.get(r.id)),
        studentCount: sizeOf.get(r.classId) ?? 0,
        editable: !!assignmentFor(ctx, r.classId, r.subjectId),
      })),
      pagination: paginationMeta(total, page, limit),
    };
  },

  /** Évaluation + liste de la classe avec la note de chaque élève (null si non noté) */
  async getEvaluation(ctx: TeacherContext, id: string) {
    const ev = await loadOwnEvaluation(ctx, id, "read");
    const [students, grades] = await Promise.all([activeStudents(prisma, ctx.schoolId, ev.classId), gradeRepository.forEvaluation(id)]);
    const gradeOf = new Map(grades.map((g) => [g.studentId, g]));
    return {
      evaluation: mapEvaluation(ev, summarize(grades.map((g) => g.score))),
      editable: !!assignmentFor(ctx, ev.classId, ev.subjectId),
      students: students.map((s) => ({ ...s, gradeId: gradeOf.get(s.id)?.id ?? null, score: gradeOf.get(s.id)?.score ?? null })),
    };
  },

  async createEvaluation(ctx: TeacherContext, input: EvaluationInput) {
    return mapEvaluation(await createEvaluation(prisma, ctx, input));
  },

  async updateEvaluation(
    ctx: TeacherContext,
    id: string,
    input: Partial<Pick<EvaluationInput, "title" | "type" | "date" | "maxScore" | "coefficient">>,
  ) {
    await loadOwnEvaluation(ctx, id, "write");
    if (input.maxScore !== undefined) {
      const highest = await gradeRepository.highestScore(id);
      if (highest !== null && highest > input.maxScore) {
        throw badRequest(`Le barème ne peut pas être inférieur à une note déjà saisie (${highest})`, "SCORE_ABOVE_MAX");
      }
    }
    try {
      const ev = await evaluationRepository.update(id, {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.date !== undefined ? { date: day(input.date) } : {}),
        ...(input.maxScore !== undefined ? { maxScore: input.maxScore } : {}),
        ...(input.coefficient !== undefined ? { coefficient: input.coefficient } : {}),
      });
      return mapEvaluation(ev);
    } catch (e) {
      if (isUniqueViolation(e)) throw duplicateEvaluation();
      throw e;
    }
  },

  async deleteEvaluation(ctx: TeacherContext, id: string) {
    const ev = await loadOwnEvaluation(ctx, id, "write");
    await evaluationRepository.delete(id);
    return { id, title: ev.title };
  },

  async saveEvaluationGrades(ctx: TeacherContext, id: string, grades: GradeEntry[]) {
    const ev = await loadOwnEvaluation(ctx, id, "write");
    const result = await prisma.$transaction((tx) => applyGrades(tx, ev, grades), { timeout: 30_000 });
    return { evaluationId: id, ...result };
  },

  /** Saisie en une étape : création éventuelle de l'évaluation et notes, de façon atomique */
  async postGrades(ctx: TeacherContext, payload: { evaluationId?: string; evaluation?: EvaluationInput; grades: GradeEntry[] }) {
    const existing = payload.evaluationId ? await loadOwnEvaluation(ctx, payload.evaluationId, "write") : null;
    return prisma.$transaction(
      async (tx) => {
        const ev = existing ?? (await createEvaluation(tx, ctx, payload.evaluation!));
        const result = await applyGrades(tx, ev, payload.grades);
        return { evaluationId: ev.id, created: !existing, ...result };
      },
      { timeout: 30_000 },
    );
  },

  async updateGrade(ctx: TeacherContext, gradeId: string, score: number) {
    const grade = await gradeRepository.findById(gradeId);
    if (!grade || grade.evaluation.schoolId !== ctx.schoolId) throw notFound("Note introuvable", "GRADE_NOT_FOUND");
    const ev = await loadOwnEvaluation(ctx, grade.evaluationId, "write");
    if (score > ev.maxScore) throw badRequest(`Une note ne peut pas dépasser le barème (${ev.maxScore})`, "SCORE_ABOVE_MAX");
    const updated = await gradeRepository.update(gradeId, round2(score));
    return { grade: mapGrade(updated), previousScore: grade.score };
  },

  /** Historique des notes saisies par l'enseignant */
  async listGrades(ctx: TeacherContext, query: GradeFilters & { page?: number; limit?: number }) {
    const { page, limit, skip, take } = parsePagination(query as Record<string, unknown>);
    const where: Prisma.GradeWhereInput = {
      evaluation: { schoolId: ctx.schoolId, teacherId: ctx.teacherId, ...evaluationFilters(query) },
      ...(query.studentId ? { studentId: query.studentId } : {}),
    };
    const [rows, total] = await Promise.all([gradeRepository.findMany(where, { skip, take }), gradeRepository.count(where)]);
    return { data: rows.map(mapGrade), pagination: paginationMeta(total, page, limit) };
  },
};

// ─── Administration (lecture seule) ─────────────────────────────────────────

function adminGradeWhere(schoolId: string, q: GradeFilters): Prisma.GradeWhereInput {
  return {
    evaluation: { schoolId, ...evaluationFilters(q) },
    ...(q.studentId ? { studentId: q.studentId } : {}),
  };
}

export const adminGradeService = {
  async listGrades(schoolId: string, query: GradeFilters & { page?: number; limit?: number }) {
    const { page, limit, skip, take } = parsePagination(query as Record<string, unknown>);
    const where = adminGradeWhere(schoolId, query);
    const [rows, total] = await Promise.all([gradeRepository.findMany(where, { skip, take }), gradeRepository.count(where)]);
    return { data: rows.map(mapGrade), pagination: paginationMeta(total, page, limit) };
  },

  async listEvaluations(schoolId: string, query: GradeFilters & { page?: number; limit?: number }) {
    const { page, limit, skip, take } = parsePagination(query as Record<string, unknown>);
    const where: Prisma.EvaluationWhereInput = {
      schoolId,
      ...evaluationFilters(query),
      ...(query.studentId ? { grades: { some: { studentId: query.studentId } } } : {}),
    };
    const [rows, total] = await Promise.all([evaluationRepository.findMany(where, { skip, take }), evaluationRepository.count(where)]);
    const stats = await evaluationRepository.statsByEvaluation(rows.map((r) => r.id));
    return { data: rows.map((r) => mapEvaluation(r, stats.get(r.id))), pagination: paginationMeta(total, page, limit) };
  },

  async getEvaluation(schoolId: string, id: string) {
    const ev = await evaluationRepository.findById(id);
    if (!ev || ev.schoolId !== schoolId) throw notFound("Évaluation introuvable", "EVALUATION_NOT_FOUND");
    const grades = await gradeRepository.findMany({ evaluationId: id });
    return {
      evaluation: mapEvaluation(ev, summarize(grades.map((g) => g.score))),
      grades: grades.map((g) => ({ id: g.id, score: g.score, student: mapGrade(g).student, updatedAt: g.updatedAt.toISOString() })),
    };
  },

  /** Statistiques calculées sur les notes réellement présentes en base (moyennes ramenées sur 20) */
  async stats(schoolId: string, query: GradeFilters) {
    const where = adminGradeWhere(schoolId, query);
    const [grades, evaluations] = await Promise.all([
      prisma.grade.findMany({
        where,
        select: { score: true, evaluation: { select: { maxScore: true, coefficient: true, subject: { select: { id: true, name: true } } } } },
      }),
      prisma.evaluation.count({ where: { schoolId, ...evaluationFilters(query), ...(query.studentId ? { grades: { some: { studentId: query.studentId } } } : {}) } }),
    ]);
    const bySubject = new Map<string, { subjectId: string; subjectName: string; rows: Array<{ score: number; maxScore: number; coefficient: number }> }>();
    for (const g of grades) {
      const s = bySubject.get(g.evaluation.subject.id) ?? { subjectId: g.evaluation.subject.id, subjectName: g.evaluation.subject.name, rows: [] };
      s.rows.push({ score: g.score, maxScore: g.evaluation.maxScore, coefficient: g.evaluation.coefficient });
      bySubject.set(s.subjectId, s);
    }
    const on20s = grades.map((g) => on20(g.score, g.evaluation.maxScore));
    return {
      evaluations,
      grades: grades.length,
      average: on20s.length ? round2(on20s.reduce((a, b) => a + b, 0) / on20s.length) : null,
      bySubject: [...bySubject.values()]
        .map((s) => ({ subjectId: s.subjectId, subjectName: s.subjectName, count: s.rows.length, average: weightedAverage(s.rows) }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "fr")),
    };
  },

  async studentReport(schoolId: string, studentId: string, query: GradeFilters) {
    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { class: { select: { id: true, name: true } } } });
    if (!student || student.schoolId !== schoolId) throw notFound("Élève introuvable", "STUDENT_NOT_FOUND");
    return {
      student: { id: student.id, firstName: student.firstName, lastName: student.lastName, studentNumber: student.studentNumber, class: student.class },
      ...(await gradeReport(schoolId, studentId, query)),
    };
  },
};

// ─── Relevé d'un élève (espace étudiant et administration) ──────────────────

export async function gradeReport(schoolId: string, studentId: string, query: GradeFilters) {
  const rows = await gradeRepository.findMany({
    studentId,
    evaluation: { schoolId, ...evaluationFilters({ subjectId: query.subjectId, type: query.type, from: query.from, to: query.to }) },
  });
  return buildReport(rows.map(toReportGrade));
}
