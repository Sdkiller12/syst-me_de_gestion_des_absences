import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { notFound, forbidden, conflict, badRequest } from "../utils/errors.js";
import { normalizePhone } from "../utils/phone.js";
import { allocateUsername, generateTemporaryPassword } from "../utils/credentials.js";
import { revokeAllRefreshTokensForUser } from "../utils/tokenBlacklist.js";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

const teacherInclude = {
  user: {
    select: { id: true, username: true, email: true, isActive: true, mustChangePassword: true, lastLoginAt: true },
  },
  assignments: {
    select: {
      id: true,
      academicYear: true,
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.TeacherInclude;

type TeacherWithRelations = Prisma.TeacherGetPayload<{ include: typeof teacherInclude }>;

function mapTeacher(t: TeacherWithRelations) {
  const subjects = new Map<string, string>();
  const classes = new Set<string>();
  for (const a of t.assignments) {
    subjects.set(a.subject.id, a.subject.name);
    classes.add(a.class.id);
  }
  return {
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    fullName: `${t.firstName} ${t.lastName}`,
    phone: t.phone,
    email: t.email,
    employeeNumber: t.employeeNumber,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    account: t.user
      ? {
          userId: t.user.id,
          username: t.user.username,
          email: t.user.email,
          isActive: t.user.isActive,
          mustChangePassword: t.user.mustChangePassword,
          lastLoginAt: t.user.lastLoginAt?.toISOString() ?? null,
        }
      : null,
    subjects: [...subjects].map(([id, name]) => ({ id, name })),
    assignmentCount: t.assignments.length,
    classCount: classes.size,
  };
}

export interface TeacherProfileInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  employeeNumber?: string | null;
}

/** Mise en forme commune (saisie manuelle et import) */
export function normalizeTeacherInput(p: TeacherProfileInput) {
  const firstName = p.firstName
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return {
    firstName,
    lastName: p.lastName.trim().replace(/\s+/g, " ").toUpperCase(),
    phone: p.phone?.trim() ? normalizePhone(p.phone) : null,
    email: p.email?.trim() ? p.email.trim().toLowerCase() : null,
    employeeNumber: p.employeeNumber?.trim() ? p.employeeNumber.trim().toUpperCase() : null,
  };
}

async function getTeacherOrThrow(id: string, sid: string) {
  const t = await prisma.teacher.findUnique({ where: { id }, include: teacherInclude });
  if (!t || t.schoolId !== sid) throw notFound("Enseignant introuvable", "TEACHER_NOT_FOUND");
  return t;
}

/** Refuse un matricule ou un email déjà utilisé par un autre enseignant de l'école */
async function assertNoDuplicate(sid: string, data: { email: string | null; employeeNumber: string | null }, exceptId?: string) {
  const or: Prisma.TeacherWhereInput[] = [];
  if (data.employeeNumber) or.push({ employeeNumber: data.employeeNumber });
  if (data.email) or.push({ email: data.email });
  if (or.length === 0) return;
  const dup = await prisma.teacher.findFirst({ where: { schoolId: sid, OR: or, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) {
    const field = data.employeeNumber && dup.employeeNumber === data.employeeNumber ? "ce matricule" : "cet email";
    throw conflict(`Un enseignant avec ${field} existe déjà (${dup.firstName} ${dup.lastName})`, "TEACHER_DUPLICATE");
  }
}

export interface IssuedCredentials {
  teacherId: string;
  fullName: string;
  username: string;
  email: string | null;
  temporaryPassword: string;
}

/**
 * Crée le compte de connexion d'un enseignant (dans une transaction fournie).
 * L'email du profil sert aussi d'identifiant s'il n'est pas déjà pris par un autre compte.
 */
async function createAccountFor(
  tx: Prisma.TransactionClient,
  t: { id: string; schoolId: string; firstName: string; lastName: string; email: string | null; phone: string | null },
  reserved: Set<string>,
): Promise<IssuedCredentials> {
  const username = await allocateUsername(tx, t.firstName, t.lastName, reserved);
  const emailFree = t.email ? !(await tx.user.findUnique({ where: { email: t.email } })) : false;
  const temporaryPassword = generateTemporaryPassword();
  const user = await tx.user.create({
    data: {
      schoolId: t.schoolId,
      firstName: t.firstName,
      lastName: t.lastName,
      name: `${t.firstName} ${t.lastName}`,
      email: emailFree ? t.email : null,
      username,
      phone: t.phone,
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      role: "TEACHER",
      mustChangePassword: true,
    },
  });
  await tx.teacher.update({ where: { id: t.id }, data: { userId: user.id } });
  return { teacherId: t.id, fullName: `${t.firstName} ${t.lastName}`, username, email: user.email, temporaryPassword };
}

export const teacherService = {
  async list(query: Record<string, unknown>, schoolId: string | null) {
    const sid = scope(schoolId);
    const { page, limit, skip, take } = parsePagination(query);
    const search = (query.search as string | undefined)?.trim();
    const account = query.account as string | undefined;
    const where: Prisma.TeacherWhereInput = { schoolId: sid };
    if (search) {
      where.OR = [
        { lastName: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeNumber: { contains: search, mode: "insensitive" } },
        { user: { username: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (account === "none") where.userId = null;
    if (account === "active") where.user = { isActive: true };
    if (account === "disabled") where.user = { isActive: false };
    const [data, total] = await Promise.all([
      prisma.teacher.findMany({ where, skip, take, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], include: teacherInclude }),
      prisma.teacher.count({ where }),
    ]);
    return { data: data.map(mapTeacher), pagination: paginationMeta(total, page, limit) };
  },

  async stats(schoolId: string | null) {
    const sid = scope(schoolId);
    const [total, withoutAccount, activeAccounts, disabledAccounts, pendingFirstLogin] = await Promise.all([
      prisma.teacher.count({ where: { schoolId: sid } }),
      prisma.teacher.count({ where: { schoolId: sid, userId: null } }),
      prisma.teacher.count({ where: { schoolId: sid, user: { isActive: true } } }),
      prisma.teacher.count({ where: { schoolId: sid, user: { isActive: false } } }),
      prisma.teacher.count({ where: { schoolId: sid, user: { isActive: true, mustChangePassword: true } } }),
    ]);
    const withoutAssignment = await prisma.teacher.count({ where: { schoolId: sid, assignments: { none: {} } } });
    return { total, withoutAccount, activeAccounts, disabledAccounts, pendingFirstLogin, withoutAssignment };
  },

  async getById(id: string, schoolId: string | null) {
    return mapTeacher(await getTeacherOrThrow(id, scope(schoolId)));
  },

  async create(payload: TeacherProfileInput, schoolId: string | null) {
    const sid = scope(schoolId);
    const data = normalizeTeacherInput(payload);
    await assertNoDuplicate(sid, data);
    const t = await prisma.teacher.create({ data: { ...data, schoolId: sid }, include: teacherInclude });
    return mapTeacher(t);
  },

  async update(id: string, payload: Partial<TeacherProfileInput>, schoolId: string | null) {
    const sid = scope(schoolId);
    const current = await getTeacherOrThrow(id, sid);
    const data = normalizeTeacherInput({
      firstName: payload.firstName ?? current.firstName,
      lastName: payload.lastName ?? current.lastName,
      phone: payload.phone !== undefined ? payload.phone : current.phone,
      email: payload.email !== undefined ? payload.email : current.email,
      employeeNumber: payload.employeeNumber !== undefined ? payload.employeeNumber : current.employeeNumber,
    });
    await assertNoDuplicate(sid, data, id);
    const t = await prisma.$transaction(async (tx) => {
      const updated = await tx.teacher.update({ where: { id }, data, include: teacherInclude });
      // Le nom affiché du compte suit la fiche
      if (updated.userId) {
        await tx.user.update({
          where: { id: updated.userId },
          data: { firstName: data.firstName, lastName: data.lastName, name: `${data.firstName} ${data.lastName}`, phone: data.phone },
        });
      }
      return updated;
    });
    return mapTeacher(t);
  },

  /**
   * Supprime la fiche et son compte. Refusé si l'enseignant a déjà des cours enregistrés :
   * l'historique des présences doit rester traçable, il faut alors désactiver le compte.
   */
  async remove(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const t = await getTeacherOrThrow(id, sid);
    if (t.userId) {
      const courses = await prisma.course.count({ where: { teacherId: t.userId } });
      if (courses > 0) {
        throw conflict(
          "Cet enseignant a des cours et des présences enregistrés. Désactivez son compte plutôt que de le supprimer.",
          "TEACHER_HAS_HISTORY",
        );
      }
    }
    // Les notes saisies restent rattachées à leur auteur
    if ((await prisma.evaluation.count({ where: { teacherId: id } })) > 0) {
      throw conflict(
        "Cet enseignant a saisi des notes. Désactivez son compte plutôt que de le supprimer.",
        "TEACHER_HAS_HISTORY",
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.teacher.delete({ where: { id } });
      if (t.userId) await tx.user.delete({ where: { id: t.userId } });
    });
  },

  // ─── Comptes d'accès ──────────────────────────────────────────────────────

  async createAccount(id: string, schoolId: string | null): Promise<IssuedCredentials> {
    const sid = scope(schoolId);
    const t = await getTeacherOrThrow(id, sid);
    if (t.userId) throw conflict("Cet enseignant possède déjà un compte", "ACCOUNT_EXISTS");
    return prisma.$transaction((tx) => createAccountFor(tx, t, new Set()));
  },

  /** Création en lot : uniquement pour les enseignants qui n'ont pas encore de compte */
  async createAccounts(teacherIds: string[] | undefined, schoolId: string | null) {
    const sid = scope(schoolId);
    const where: Prisma.TeacherWhereInput = { schoolId: sid, userId: null };
    if (teacherIds && teacherIds.length > 0) where.id = { in: teacherIds };
    const teachers = await prisma.teacher.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
    const reserved = new Set<string>();
    const created = await prisma.$transaction(
      async (tx) => {
        const out: IssuedCredentials[] = [];
        for (const t of teachers) out.push(await createAccountFor(tx, t, reserved));
        return out;
      },
      { timeout: 60_000 },
    );
    const alreadyEquipped = teacherIds ? teacherIds.length - teachers.length : 0;
    return { created, skipped: Math.max(0, alreadyEquipped) };
  },

  async resetPassword(id: string, schoolId: string | null): Promise<IssuedCredentials> {
    const sid = scope(schoolId);
    const t = await getTeacherOrThrow(id, sid);
    if (!t.user) throw badRequest("Cet enseignant n'a pas encore de compte", "NO_ACCOUNT");
    const temporaryPassword = generateTemporaryPassword();
    await prisma.user.update({
      where: { id: t.user.id },
      data: { passwordHash: await bcrypt.hash(temporaryPassword, 10), mustChangePassword: true },
    });
    // Les sessions ouvertes avec l'ancien mot de passe sont fermées
    await revokeAllRefreshTokensForUser(t.user.id);
    return {
      teacherId: t.id,
      fullName: `${t.firstName} ${t.lastName}`,
      username: t.user.username ?? t.user.email ?? "",
      email: t.user.email,
      temporaryPassword,
    };
  },

  async setAccountStatus(id: string, isActive: boolean, schoolId: string | null) {
    const sid = scope(schoolId);
    const t = await getTeacherOrThrow(id, sid);
    if (!t.userId) throw badRequest("Cet enseignant n'a pas encore de compte", "NO_ACCOUNT");
    await prisma.$transaction([
      prisma.user.update({ where: { id: t.userId }, data: { isActive } }),
      prisma.teacher.update({ where: { id }, data: { isActive } }),
    ]);
    if (!isActive) await revokeAllRefreshTokensForUser(t.userId);
    return this.getById(id, sid);
  },

  // ─── Affectations pédagogiques ────────────────────────────────────────────

  async listAssignments(id: string, schoolId: string | null, academicYear?: string) {
    const sid = scope(schoolId);
    await getTeacherOrThrow(id, sid);
    const rows = await prisma.teachingAssignment.findMany({
      where: { teacherId: id, schoolId: sid, ...(academicYear ? { academicYear } : {}) },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true, academicYear: true } },
        _count: { select: { courses: true } },
      },
      orderBy: [{ academicYear: "desc" }, { subject: { name: "asc" } }, { class: { name: "asc" } }],
    });
    return rows.map((a) => ({
      id: a.id,
      academicYear: a.academicYear,
      subject: a.subject,
      class: a.class,
      courseCount: a._count.courses,
      createdAt: a.createdAt.toISOString(),
    }));
  },

  /** Crée plusieurs affectations d'un coup ; les doublons existants sont ignorés, pas écrasés */
  async createAssignments(
    id: string,
    payload: { academicYear: string; items: Array<{ subjectId: string; classId: string }> },
    schoolId: string | null,
  ) {
    const sid = scope(schoolId);
    const teacher = await getTeacherOrThrow(id, sid);
    const subjectIds = [...new Set(payload.items.map((i) => i.subjectId))];
    const classIds = [...new Set(payload.items.map((i) => i.classId))];
    const [subjects, classes] = await Promise.all([
      prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId: sid } }),
      prisma.class.findMany({ where: { id: { in: classIds }, schoolId: sid } }),
    ]);
    if (subjects.length !== subjectIds.length) throw notFound("Matière introuvable", "SUBJECT_NOT_FOUND");
    if (classes.length !== classIds.length) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
    const inactive = subjects.find((s) => !s.isActive);
    if (inactive) throw badRequest(`La matière « ${inactive.name} » est désactivée`, "SUBJECT_INACTIVE");

    const result = await prisma.teachingAssignment.createMany({
      data: payload.items.map((i) => ({
        schoolId: sid,
        teacherId: teacher.id,
        subjectId: i.subjectId,
        classId: i.classId,
        academicYear: payload.academicYear,
      })),
      skipDuplicates: true,
    });
    return { created: result.count, skipped: payload.items.length - result.count };
  },

  async deleteAssignment(id: string, assignmentId: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const a = await prisma.teachingAssignment.findUnique({ where: { id: assignmentId } });
    if (!a || a.schoolId !== sid || a.teacherId !== id) throw notFound("Affectation introuvable", "ASSIGNMENT_NOT_FOUND");
    // Les cours déjà tenus restent en base (assignmentId passe à null) pour la traçabilité
    await prisma.teachingAssignment.delete({ where: { id: assignmentId } });
  },

  /** Toutes les affectations de l'école (pour planifier un cours côté administration) */
  async listSchoolAssignments(query: Record<string, unknown>, schoolId: string | null) {
    const sid = scope(schoolId);
    const rows = await prisma.teachingAssignment.findMany({
      where: {
        schoolId: sid,
        ...(query.classId ? { classId: query.classId as string } : {}),
        ...(query.academicYear ? { academicYear: query.academicYear as string } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, userId: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    });
    return rows.map((a) => ({
      id: a.id,
      academicYear: a.academicYear,
      subject: a.subject,
      class: a.class,
      teacher: { id: a.teacher.id, fullName: `${a.teacher.firstName} ${a.teacher.lastName}`, hasAccount: !!a.teacher.userId },
    }));
  },
};

export type TeacherDto = ReturnType<typeof mapTeacher>;
