import { prisma } from "../config/database.js";
import { normalizePhone, validatePhone } from "../utils/phone.js";
import { parsePagination, paginationMeta } from "../utils/pagination.js";
import { AppError, notFound, forbidden } from "../utils/errors.js";
import { logger } from "../config/logger.js";
import * as XLSX from "xlsx";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export interface StudentPayload {
  firstName: string;
  lastName: string;
  phone?: string;
  classId: string;
  studentNumber?: string;
  parentName?: string;
  parentPhone?: string;
  email?: string;
}

export const studentService = {
  async list(query: Record<string, unknown>, schoolId: string | null) {
    const sid = scope(schoolId);
    const { page, limit, skip, take } = parsePagination(query);
    const classId = query.classId as string | undefined;
    const search = (query.search as string | undefined)?.trim();
    const where: Record<string, unknown> = { schoolId: sid };
    if (classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
      (where as Record<string, unknown>).classId = classId;
    }
    if (search) {
      (where as Record<string, unknown>).OR = [
        { lastName: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { studentNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.student.findMany({
        where: where as never,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { class: { select: { name: true } } },
      }),
      prisma.student.count({ where: where as never }),
    ]);
    const mapped = data.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      studentNumber: s.studentNumber,
      phone: s.phone,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      email: s.email,
      classId: s.classId,
      className: (s as unknown as { class: { name: string } }).class?.name,
      createdAt: s.createdAt.toISOString(),
    }));
    return { data: mapped, pagination: paginationMeta(total, page, limit) };
  },

  async getById(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const s = await prisma.student.findUnique({ where: { id }, include: { class: true } });
    if (!s || s.schoolId !== sid) throw notFound("Étudiant introuvable", "STUDENT_NOT_FOUND");
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      studentNumber: s.studentNumber,
      phone: s.phone,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      email: s.email,
      classId: s.classId,
      className: s.class.name,
      createdAt: s.createdAt.toISOString(),
    };
  },

  async create(payload: StudentPayload, schoolId: string | null) {
    const sid = scope(schoolId);
    const cls = await prisma.class.findUnique({ where: { id: payload.classId } });
    if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
    const phone = payload.phone ? normalizePhone(payload.phone) : "";
    if (phone && !validatePhone(phone)) throw new AppError(400, "Numéro de téléphone invalide", "VALIDATION_ERROR");
    let parentPhone: string | undefined;
    if (payload.parentPhone) {
      parentPhone = normalizePhone(payload.parentPhone);
      if (!validatePhone(parentPhone)) throw new AppError(400, "Téléphone parent invalide", "VALIDATION_ERROR");
    }
    const duplicate = await prisma.student.findFirst({
      where: { schoolId: sid, classId: payload.classId, firstName: { equals: payload.firstName, mode: "insensitive" }, lastName: { equals: payload.lastName, mode: "insensitive" } },
    });
    if (duplicate) throw new AppError(409, "Étudiant déjà existant dans cette classe", "CONFLICT");
    if (payload.studentNumber) {
      const dupNum = await prisma.student.findUnique({ where: { schoolId_studentNumber: { schoolId: sid, studentNumber: payload.studentNumber } } }).catch(() => null);
      if (dupNum) throw new AppError(409, "Matricule déjà utilisé", "CONFLICT");
    }
    return prisma.student.create({
      data: {
        schoolId: sid,
        classId: payload.classId,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim().toUpperCase(),
        phone,
        studentNumber: payload.studentNumber?.trim() || null,
        parentName: payload.parentName?.trim() || null,
        parentPhone: parentPhone || null,
        email: payload.email?.toLowerCase().trim() || null,
      },
    });
  },

  async update(id: string, payload: Partial<StudentPayload>, schoolId: string | null) {
    const sid = scope(schoolId);
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== sid) throw notFound("Étudiant introuvable", "STUDENT_NOT_FOUND");
    if (payload.classId) {
      const cls = await prisma.class.findUnique({ where: { id: payload.classId } });
      if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
    }
    const data: Record<string, unknown> = {};
    if (payload.firstName) data.firstName = payload.firstName.trim();
    if (payload.lastName) data.lastName = payload.lastName.trim().toUpperCase();
    if (payload.phone !== undefined) {
      const phone = payload.phone ? normalizePhone(payload.phone) : "";
      if (phone && !validatePhone(phone)) throw new AppError(400, "Numéro de téléphone invalide", "VALIDATION_ERROR");
      data.phone = phone;
    }
    if (payload.parentPhone !== undefined) {
      const pp = payload.parentPhone ? normalizePhone(payload.parentPhone) : null;
      if (pp && !validatePhone(pp)) throw new AppError(400, "Téléphone parent invalide", "VALIDATION_ERROR");
      data.parentPhone = pp;
    }
    if (payload.parentName !== undefined) data.parentName = payload.parentName?.trim() || null;
    if (payload.studentNumber !== undefined) data.studentNumber = payload.studentNumber?.trim() || null;
    if (payload.email !== undefined) data.email = payload.email?.toLowerCase().trim() || null;
    if (payload.classId) data.classId = payload.classId;
    return prisma.student.update({ where: { id }, data: data as never });
  },

  async remove(id: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const s = await prisma.student.findUnique({ where: { id } });
    if (!s || s.schoolId !== sid) throw notFound("Étudiant introuvable", "STUDENT_NOT_FOUND");
    await prisma.student.delete({ where: { id } });
  },

  async importExcel(file: Express.Multer.File, classId: string, schoolId: string | null) {
    const sid = scope(schoolId);
    if (!classId) throw new AppError(400, "classId requis", "VALIDATION_ERROR");
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable", "CLASS_NOT_FOUND");
    if (!file) throw new AppError(400, "Fichier manquant", "VALIDATION_ERROR");
    if (file.size > 5 * 1024 * 1024) throw new AppError(400, "Fichier trop volumineux (max 5 Mo)", "VALIDATION_ERROR");
    if (!/\.(xlsx|xls)$/i.test(file.originalname)) throw new AppError(400, "Format invalide. Utilisez .xlsx ou .xls", "VALIDATION_ERROR");

    let rows: Array<Record<string, unknown>>;
    try {
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    } catch {
      throw new AppError(400, "Impossible de lire le fichier Excel", "VALIDATION_ERROR");
    }
    if (rows.length === 0) throw new AppError(400, "Fichier vide", "VALIDATION_ERROR");
    if (rows.length > 1000) throw new AppError(400, "Le fichier contient trop de lignes (max 1000 par import)", "VALIDATION_ERROR");

    const errors: Array<{ row: number; message: string }> = [];
    const valid: Array<{ nom: string; prenom: string; telephone: string; matricule?: string; parentPhone?: string; parentName?: string; email?: string; line: number }> = [];
    const seen = new Set<string>();

    rows.forEach((r, idx) => {
      const line = idx + 2;
      const lower: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) lower[k.trim().toLowerCase()] = String(v ?? "").trim();
      const nom = lower["nom"] ?? "";
      const prenom = lower["prenom"] ?? lower["prénom"] ?? lower["prénom "] ?? "";
      const telephone = lower["telephone"] ?? lower["téléphone"] ?? lower["tel"] ?? "";
      const matricule = lower["matricule"] ?? lower["studentnumber"] ?? "";
      const parentPhone = lower["telephone parent"] ?? lower["téléphone parent"] ?? lower["parentphone"] ?? "";
      const parentName = lower["parent"] ?? lower["nom parent"] ?? "";
      const email = lower["email"] ?? "";
      const classe = lower["classe"] ?? "";
      if (classe && cls.name.toLowerCase() !== classe.toLowerCase()) {
        errors.push({ row: line, message: `Classe "${classe}" différente de la classe cible` });
        return;
      }
      if (!nom) errors.push({ row: line, message: "Nom manquant" });
      else if (!prenom) errors.push({ row: line, message: "Prénom manquant" });
      else if (telephone && !validatePhone(telephone)) errors.push({ row: line, message: "Numéro de téléphone invalide" });
      else if (parentPhone && !validatePhone(parentPhone)) errors.push({ row: line, message: "Téléphone parent invalide" });
      else {
        const key = `${nom.toLowerCase()}|${prenom.toLowerCase()}`;
        if (seen.has(key)) errors.push({ row: line, message: "Doublon dans le fichier" });
        else {
          seen.add(key);
          valid.push({ nom, prenom, telephone, matricule, parentPhone, parentName, email, line });
        }
      }
    });

    let duplicates = 0;
    let imported = 0;
    const analyzed = rows.length;
    if (valid.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const v of valid) {
          const exists = await tx.student.findFirst({
            where: { schoolId: sid, classId, firstName: { equals: v.prenom, mode: "insensitive" }, lastName: { equals: v.nom, mode: "insensitive" } },
          });
          if (exists) {
            duplicates++;
            errors.push({ row: v.line, message: "Doublon (déjà existant)" });
            continue;
          }
          if (v.matricule) {
            const dupNum = await tx.student.findUnique({ where: { schoolId_studentNumber: { schoolId: sid, studentNumber: v.matricule } } }).catch(() => null);
            if (dupNum) {
              duplicates++;
              errors.push({ row: v.line, message: "Matricule déjà utilisé" });
              continue;
            }
          }
          await tx.student.create({
            data: {
              schoolId: sid,
              classId,
              firstName: v.prenom.trim(),
              lastName: v.nom.trim().toUpperCase(),
              phone: v.telephone ? normalizePhone(v.telephone) : "",
              studentNumber: v.matricule?.trim() || null,
              parentName: v.parentName?.trim() || null,
              parentPhone: v.parentPhone ? normalizePhone(v.parentPhone) : null,
              email: v.email?.toLowerCase().trim() || null,
            },
          });
          imported++;
        }
      });
    }

    const invalid = errors.length - duplicates;
    logger.info({ classId, analyzed, imported, duplicates, invalid }, "Import Excel");
    return { analyzed, imported, duplicates, invalid, failed: errors.length, errors };
  },
};
