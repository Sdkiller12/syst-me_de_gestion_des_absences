import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { conflict, forbidden, notFound } from "../utils/errors.js";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

/** Nom de matière nettoyé : espaces normalisés, première lettre en majuscule */
export function cleanSubjectName(name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  return n.charAt(0).toUpperCase() + n.slice(1);
}

type Db = typeof prisma | Prisma.TransactionClient;

/** Recherche insensible à la casse ("mathématiques" = "Mathématiques") */
export async function findSubjectByName(db: Db, schoolId: string, name: string) {
  return db.subject.findFirst({ where: { schoolId, name: { equals: cleanSubjectName(name), mode: "insensitive" } } });
}

export const subjectService = {
  async list(query: Record<string, unknown>, schoolId: string | null) {
    const sid = scope(schoolId);
    const search = (query.search as string | undefined)?.trim();
    const rows = await prisma.subject.findMany({
      where: {
        schoolId: sid,
        ...(query.active === "true" ? { isActive: true } : {}),
        ...(search
          ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] }
          : {}),
      },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      description: s.description,
      isActive: s.isActive,
      assignmentCount: s._count.assignments,
      createdAt: s.createdAt.toISOString(),
    }));
  },

  async create(payload: { name: string; code?: string | null; description?: string | null }, schoolId: string | null) {
    const sid = scope(schoolId);
    const name = cleanSubjectName(payload.name);
    if (await findSubjectByName(prisma, sid, name)) throw conflict(`La matière « ${name} » existe déjà`, "SUBJECT_EXISTS");
    const code = payload.code?.trim() ? payload.code.trim().toUpperCase() : null;
    if (code && (await prisma.subject.findFirst({ where: { schoolId: sid, code } }))) {
      throw conflict(`Le code « ${code} » est déjà utilisé`, "SUBJECT_CODE_EXISTS");
    }
    return prisma.subject.create({
      data: { schoolId: sid, name, code, description: payload.description?.trim() || null },
    });
  },

  async update(
    id: string,
    payload: { name?: string; code?: string | null; description?: string | null; isActive?: boolean },
    schoolId: string | null,
  ) {
    const sid = scope(schoolId);
    const current = await prisma.subject.findUnique({ where: { id } });
    if (!current || current.schoolId !== sid) throw notFound("Matière introuvable", "SUBJECT_NOT_FOUND");
    const data: Prisma.SubjectUpdateInput = {};
    if (payload.name !== undefined) {
      const name = cleanSubjectName(payload.name);
      const dup = await findSubjectByName(prisma, sid, name);
      if (dup && dup.id !== id) throw conflict(`La matière « ${name} » existe déjà`, "SUBJECT_EXISTS");
      data.name = name;
    }
    if (payload.code !== undefined) {
      const code = payload.code?.trim() ? payload.code.trim().toUpperCase() : null;
      if (code) {
        const dup = await prisma.subject.findFirst({ where: { schoolId: sid, code, id: { not: id } } });
        if (dup) throw conflict(`Le code « ${code} » est déjà utilisé`, "SUBJECT_CODE_EXISTS");
      }
      data.code = code;
    }
    if (payload.description !== undefined) data.description = payload.description?.trim() || null;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;
    return prisma.subject.update({ where: { id }, data });
  },

  /** Une matière déjà affectée ne se supprime pas (les affectations en dépendent) : la désactiver */
  async remove(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const s = await prisma.subject.findUnique({ where: { id }, include: { _count: { select: { assignments: true, evaluations: true } } } });
    if (!s || s.schoolId !== sid) throw notFound("Matière introuvable", "SUBJECT_NOT_FOUND");
    if (s._count.evaluations > 0) {
      throw conflict("Des notes ont été saisies dans cette matière. Désactivez-la plutôt que de la supprimer.", "SUBJECT_IN_USE");
    }
    if (s._count.assignments > 0) {
      throw conflict("Cette matière est utilisée dans des affectations. Désactivez-la plutôt que de la supprimer.", "SUBJECT_IN_USE");
    }
    await prisma.subject.delete({ where: { id } });
  },
};
