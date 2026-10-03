import { prisma } from "../config/database.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { DAY_NAMES } from "../utils/timeSlots.js";
import { timetableRepository, type TimetableEntryRow } from "../repositories/timetable.repository.js";

export interface TimetableEntryInput {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}

/**
 * "full" pour les utilisateurs connectés de l'école ; "public" pour la consultation sans compte,
 * qui n'expose que l'initiale du prénom de l'enseignant.
 */
type Audience = "full" | "public";

function teacherLabel(t: { firstName: string; lastName: string }, audience: Audience) {
  return audience === "public" ? `${t.firstName.charAt(0)}. ${t.lastName}` : `${t.firstName} ${t.lastName}`;
}

export function mapEntry(e: TimetableEntryRow, audience: Audience = "full") {
  return {
    id: e.id,
    dayOfWeek: e.dayOfWeek,
    startTime: e.startTime,
    endTime: e.endTime,
    room: e.room,
    class: e.class,
    subject: e.subject,
    teacher: { id: audience === "public" ? null : e.teacher.id, name: teacherLabel(e.teacher, audience) },
  };
}

const cleanRoom = (room?: string | null) => (room?.trim() ? room.trim().replace(/\s+/g, " ") : null);

/** Message de conflit explicite : l'administrateur voit immédiatement quel créneau gêne */
function conflictMessage(slot: { classId: string; teacherId: string; room: string | null }, other: TimetableEntryRow) {
  const when = `le ${DAY_NAMES[other.dayOfWeek]} de ${other.startTime} à ${other.endTime}`;
  if (other.classId === slot.classId) {
    return `La classe ${other.class.name} a déjà ${other.subject.name} ${when}`;
  }
  if (other.teacherId === slot.teacherId) {
    return `${other.teacher.firstName} ${other.teacher.lastName} enseigne déjà en ${other.class.name} ${when}`;
  }
  return `La salle ${other.room} est déjà occupée par ${other.class.name} ${when}`;
}

async function loadClass(schoolId: string, classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, schoolId: true, level: true, academicYear: true } });
  if (!cls || cls.schoolId !== schoolId) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
  return cls;
}

/**
 * Cohérence du créneau : matière et enseignant actifs de la même école, et enseignant
 * affecté à cette matière dans cette classe (les affectations restent la source des droits).
 */
async function assertSlotReferences(schoolId: string, slot: { classId: string; subjectId: string; teacherId: string }) {
  const [subject, teacher, assignment] = await Promise.all([
    prisma.subject.findUnique({ where: { id: slot.subjectId } }),
    prisma.teacher.findUnique({ where: { id: slot.teacherId } }),
    prisma.teachingAssignment.findFirst({ where: { schoolId, classId: slot.classId, subjectId: slot.subjectId, teacherId: slot.teacherId } }),
  ]);
  if (!subject || subject.schoolId !== schoolId) throw notFound("Matière introuvable", "SUBJECT_NOT_FOUND");
  if (!teacher || teacher.schoolId !== schoolId) throw notFound("Enseignant introuvable", "TEACHER_NOT_FOUND");
  if (!subject.isActive) throw badRequest("Cette matière est désactivée", "SUBJECT_INACTIVE");
  if (!teacher.isActive) throw badRequest("Cet enseignant est désactivé", "TEACHER_INACTIVE");
  if (!assignment) {
    throw badRequest(
      "Cet enseignant n'est pas affecté à cette matière dans cette classe. Ajoutez d'abord l'affectation depuis la fiche de l'enseignant.",
      "NOT_ASSIGNED",
    );
  }
}

export const timetableService = {
  async forClass(schoolId: string, classId: string, audience: Audience = "full") {
    const cls = await loadClass(schoolId, classId);
    const entries = await timetableRepository.listEntries({ schoolId, classId });
    return {
      class: { id: cls.id, name: cls.name, level: cls.level, academicYear: cls.academicYear },
      entries: entries.map((e) => mapEntry(e, audience)),
    };
  },

  async forTeacher(schoolId: string, teacherId: string) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.schoolId !== schoolId) throw notFound("Enseignant introuvable", "TEACHER_NOT_FOUND");
    const entries = await timetableRepository.listEntries({ schoolId, teacherId });
    return {
      teacher: { id: teacher.id, fullName: `${teacher.firstName} ${teacher.lastName}` },
      entries: entries.map((e) => mapEntry(e)),
    };
  },

  async create(schoolId: string, input: TimetableEntryInput) {
    await loadClass(schoolId, input.classId);
    await assertSlotReferences(schoolId, input);
    const slot = { ...input, schoolId, room: cleanRoom(input.room) };
    const entry = await prisma.$transaction(async (tx) => {
      await timetableRepository.lockSchool(tx, schoolId);
      const clash = await timetableRepository.findOverlapping(tx, slot);
      if (clash.length > 0) throw conflict(conflictMessage(slot, clash[0]), "TIMETABLE_CONFLICT");
      const timetable = await timetableRepository.ensureForClass(tx, schoolId, input.classId);
      return timetableRepository.createEntry(tx, {
        schoolId,
        timetableId: timetable.id,
        classId: input.classId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: slot.room,
      });
    });
    return mapEntry(entry);
  },

  /** La classe d'un créneau ne change pas : on supprime puis on recrée dans l'autre classe */
  async update(schoolId: string, id: string, input: Partial<Omit<TimetableEntryInput, "classId">>) {
    const current = await timetableRepository.findEntry(id);
    if (!current || current.schoolId !== schoolId) throw notFound("Créneau introuvable", "TIMETABLE_ENTRY_NOT_FOUND");
    const next = {
      classId: current.classId,
      subjectId: input.subjectId ?? current.subjectId,
      teacherId: input.teacherId ?? current.teacherId,
      dayOfWeek: input.dayOfWeek ?? current.dayOfWeek,
      startTime: input.startTime ?? current.startTime,
      endTime: input.endTime ?? current.endTime,
      room: input.room !== undefined ? cleanRoom(input.room) : current.room,
    };
    if (next.startTime >= next.endTime) throw badRequest("L'heure de fin doit être après l'heure de début");
    if (next.subjectId !== current.subjectId || next.teacherId !== current.teacherId) await assertSlotReferences(schoolId, next);
    const entry = await prisma.$transaction(async (tx) => {
      await timetableRepository.lockSchool(tx, schoolId);
      const clash = await timetableRepository.findOverlapping(tx, { ...next, schoolId, excludeId: id });
      if (clash.length > 0) throw conflict(conflictMessage(next, clash[0]), "TIMETABLE_CONFLICT");
      return timetableRepository.updateEntry(tx, id, next);
    });
    return mapEntry(entry);
  },

  async remove(schoolId: string, id: string) {
    const current = await timetableRepository.findEntry(id);
    if (!current || current.schoolId !== schoolId) throw notFound("Créneau introuvable", "TIMETABLE_ENTRY_NOT_FOUND");
    await timetableRepository.deleteEntry(id);
    return mapEntry(current);
  },

  /** Classes de l'école (pour le choix du niveau/de la classe) : aucune donnée d'élève */
  async classes(schoolId: string) {
    const rows = await prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, level: true, academicYear: true, _count: { select: { timetableEntries: true } } },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });
    return rows.map((c) => ({ id: c.id, name: c.name, level: c.level, academicYear: c.academicYear, slotCount: c._count.timetableEntries }));
  },

  async publicSchool(schoolId: string) {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, city: true } });
    if (!school) throw notFound("Établissement introuvable", "SCHOOL_NOT_FOUND");
    return school;
  },
};
