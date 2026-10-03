import type { NextFunction, Response } from "express";
import { prisma } from "../config/database.js";
import { forbidden } from "../utils/errors.js";
import type { AuthRequest } from "../types/index.js";

/**
 * Contexte étudiant chargé depuis l'identité du jeton : un étudiant ne peut jamais désigner
 * un autre élève, son identifiant ne vient pas du navigateur.
 */
export interface StudentContext {
  studentId: string;
  userId: string;
  schoolId: string;
  classId: string;
  firstName: string;
  lastName: string;
}

export interface StudentRequest extends AuthRequest {
  student?: StudentContext;
}

/** Charge la fiche élève liée au compte connecté (même école, fiche active) */
export async function requireStudentProfile(req: StudentRequest, _res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    if (!user.schoolId) throw forbidden("Aucune école associée à ce compte");
    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student || student.schoolId !== user.schoolId) throw forbidden("Aucune fiche élève associée à ce compte", "NO_STUDENT_PROFILE");
    if (!student.isActive) throw forbidden("Fiche élève désactivée", "FORBIDDEN");
    req.student = {
      studentId: student.id,
      userId: user.id,
      schoolId: student.schoolId,
      classId: student.classId,
      firstName: student.firstName,
      lastName: student.lastName,
    };
    next();
  } catch (e) {
    next(e);
  }
}
