import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";

type Db = typeof prisma | Prisma.TransactionClient;

export const evaluationInclude = {
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EvaluationInclude;

export type EvaluationRow = Prisma.EvaluationGetPayload<{ include: typeof evaluationInclude }>;

export const gradeInclude = {
  evaluation: { include: evaluationInclude },
  student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, classId: true } },
} satisfies Prisma.GradeInclude;

export type GradeRow = Prisma.GradeGetPayload<{ include: typeof gradeInclude }>;

export const evaluationRepository = {
  findById: (id: string) => prisma.evaluation.findUnique({ where: { id }, include: evaluationInclude }),
  findMany: (where: Prisma.EvaluationWhereInput, page?: { skip: number; take: number }) =>
    prisma.evaluation.findMany({ where, include: evaluationInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }], ...page }),
  count: (where: Prisma.EvaluationWhereInput) => prisma.evaluation.count({ where }),
  create: (db: Db, data: Prisma.EvaluationUncheckedCreateInput) => db.evaluation.create({ data, include: evaluationInclude }),
  update: (id: string, data: Prisma.EvaluationUncheckedUpdateInput) => prisma.evaluation.update({ where: { id }, data, include: evaluationInclude }),
  delete: (id: string) => prisma.evaluation.delete({ where: { id } }),

  /** Nombre de notes, moyenne, minimum et maximum par évaluation */
  async statsByEvaluation(ids: string[]) {
    if (ids.length === 0) return new Map<string, { count: number; average: number | null; min: number | null; max: number | null }>();
    const groups = await prisma.grade.groupBy({
      by: ["evaluationId"],
      where: { evaluationId: { in: ids } },
      _count: { _all: true },
      _avg: { score: true },
      _min: { score: true },
      _max: { score: true },
    });
    return new Map(
      groups.map((g) => [
        g.evaluationId,
        { count: g._count._all, average: g._avg.score, min: g._min.score, max: g._max.score },
      ]),
    );
  },
};

export const gradeRepository = {
  findById: (id: string) => prisma.grade.findUnique({ where: { id }, include: gradeInclude }),
  findMany: (where: Prisma.GradeWhereInput, page?: { skip: number; take: number }) =>
    prisma.grade.findMany({
      where,
      include: gradeInclude,
      orderBy: [{ evaluation: { date: "desc" } }, { student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      ...page,
    }),
  count: (where: Prisma.GradeWhereInput) => prisma.grade.count({ where }),
  forEvaluation: (evaluationId: string) => prisma.grade.findMany({ where: { evaluationId } }),
  upsert: (db: Db, evaluationId: string, studentId: string, score: number) =>
    db.grade.upsert({
      where: { evaluationId_studentId: { evaluationId, studentId } },
      update: { score },
      create: { evaluationId, studentId, score },
    }),
  deleteFor: (db: Db, evaluationId: string, studentIds: string[]) =>
    db.grade.deleteMany({ where: { evaluationId, studentId: { in: studentIds } } }),
  update: (id: string, score: number) => prisma.grade.update({ where: { id }, data: { score }, include: gradeInclude }),
  highestScore: async (evaluationId: string) =>
    (await prisma.grade.aggregate({ where: { evaluationId }, _max: { score: true } }))._max.score,
};
