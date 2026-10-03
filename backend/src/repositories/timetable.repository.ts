import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";

type Db = typeof prisma | Prisma.TransactionClient;

export const timetableEntryInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  class: { select: { id: true, name: true } },
} satisfies Prisma.TimetableEntryInclude;

export type TimetableEntryRow = Prisma.TimetableEntryGetPayload<{ include: typeof timetableEntryInclude }>;

export const timetableRepository = {
  /** L'emploi du temps d'une classe est créé au premier créneau ajouté */
  ensureForClass: (db: Db, schoolId: string, classId: string) =>
    db.timetable.upsert({ where: { classId }, update: {}, create: { schoolId, classId } }),

  findEntry: (id: string) => prisma.timetableEntry.findUnique({ where: { id }, include: timetableEntryInclude }),

  listEntries: (where: Prisma.TimetableEntryWhereInput) =>
    prisma.timetableEntry.findMany({ where, include: timetableEntryInclude, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),

  /** Créneaux du même jour qui chevauchent [startTime, endTime[ pour la classe, l'enseignant ou la salle */
  findOverlapping: (
    db: Db,
    slot: { schoolId: string; dayOfWeek: number; startTime: string; endTime: string; classId: string; teacherId: string; room: string | null; excludeId?: string },
  ) =>
    db.timetableEntry.findMany({
      where: {
        schoolId: slot.schoolId,
        dayOfWeek: slot.dayOfWeek,
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime },
        ...(slot.excludeId ? { id: { not: slot.excludeId } } : {}),
        OR: [
          { classId: slot.classId },
          { teacherId: slot.teacherId },
          ...(slot.room ? [{ room: { equals: slot.room, mode: "insensitive" as const } }] : []),
        ],
      },
      include: timetableEntryInclude,
    }),

  createEntry: (db: Db, data: Prisma.TimetableEntryUncheckedCreateInput) =>
    db.timetableEntry.create({ data, include: timetableEntryInclude }),

  updateEntry: (db: Db, id: string, data: Prisma.TimetableEntryUncheckedUpdateInput) =>
    db.timetableEntry.update({ where: { id }, data, include: timetableEntryInclude }),

  deleteEntry: (id: string) => prisma.timetableEntry.delete({ where: { id } }),

  /**
   * Verrou transactionnel par école : deux administrateurs qui ajoutent un créneau en même
   * temps ne peuvent pas passer chacun le contrôle de conflit puis créer un doublon.
   */
  lockSchool: (db: Prisma.TransactionClient, schoolId: string) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${schoolId}))`,
};
