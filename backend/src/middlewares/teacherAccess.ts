import type { NextFunction, Response } from "express";
import { prisma } from "../config/database.js";
import { forbidden, notFound } from "../utils/errors.js";
import type { AuthRequest, Role } from "../types/index.js";

/**
 * Contexte enseignant chargé depuis l'identité du jeton (jamais depuis un teacherId envoyé
 * par le navigateur) : sa fiche et ses affectations pédagogiques.
 */
export interface TeacherContext {
  teacherId: string;
  userId: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  assignments: Array<{
    id: string;
    subjectId: string;
    classId: string;
    academicYear: string;
    subjectName: string;
    className: string;
  }>;
}

export interface TeacherRequest extends AuthRequest {
  teacher?: TeacherContext;
}

/** Rôle strict, sans le contournement SUPER_ADMIN de authorize() */
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(forbidden("Non authentifié", "UNAUTHORIZED"));
    if (!roles.includes(req.user.role)) {
      return next(forbidden(roles.includes("STUDENT") ? "Accès réservé aux étudiants" : "Accès réservé aux enseignants"));
    }
    return next();
  };
}

/** Charge la fiche enseignant liée au compte connecté (même école, fiche active) */
export async function requireTeacherProfile(req: TeacherRequest, _res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    if (!user.schoolId) throw forbidden("Aucune école associée à ce compte");
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        assignments: {
          include: { subject: { select: { name: true, isActive: true } }, class: { select: { name: true } } },
        },
      },
    });
    if (!teacher || teacher.schoolId !== user.schoolId) throw forbidden("Aucune fiche enseignant associée à ce compte", "NO_TEACHER_PROFILE");
    if (!teacher.isActive) throw forbidden("Fiche enseignant désactivée", "FORBIDDEN");
    req.teacher = {
      teacherId: teacher.id,
      userId: user.id,
      schoolId: teacher.schoolId,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      assignments: teacher.assignments
        .filter((a) => a.subject.isActive)
        .map((a) => ({
          id: a.id,
          subjectId: a.subjectId,
          classId: a.classId,
          academicYear: a.academicYear,
          subjectName: a.subject.name,
          className: a.class.name,
        })),
    };
    next();
  } catch (e) {
    next(e);
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Affectation qui autorise l'enseignant sur ce cours : le cours est rattaché à l'une de ses
 * affectations, ou il en est l'enseignant ET il est affecté à cette classe pour cette matière.
 */
export function assignmentForCourse(
  ctx: TeacherContext,
  course: { classId: string; teacherId: string; assignmentId: string | null; subjectId: string | null; subject: string },
) {
  const direct = course.assignmentId ? ctx.assignments.find((a) => a.id === course.assignmentId) : undefined;
  if (direct) return direct;
  if (course.teacherId !== ctx.userId) return undefined;
  return ctx.assignments.find(
    (a) =>
      a.classId === course.classId &&
      (course.subjectId ? a.subjectId === course.subjectId : norm(a.subjectName) === norm(course.subject)),
  );
}

/** Charge un cours et vérifie l'autorisation ; 404 hors école, 403 hors affectations */
export async function loadAuthorizedCourse(ctx: TeacherContext, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { class: { select: { name: true } } } });
  if (!course || course.schoolId !== ctx.schoolId) throw notFound("Cours introuvable", "COURSE_NOT_FOUND");
  const assignment = assignmentForCourse(ctx, course);
  if (!assignment) throw forbidden("Vous n'êtes pas affecté à ce cours", "NOT_ASSIGNED");
  return { course, assignment };
}

/**
 * Garde de route : vérifie les paramètres :classId, :courseId, :assignmentId (URL ou corps)
 * contre les affectations de l'enseignant avant d'atteindre le contrôleur.
 */
export async function requireTeacherAssignment(req: TeacherRequest, _res: Response, next: NextFunction) {
  try {
    const ctx = req.teacher!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pick = (name: string) => (req.params[name] as string | undefined) ?? (typeof body[name] === "string" ? (body[name] as string) : undefined) ?? (typeof req.query[name] === "string" ? (req.query[name] as string) : undefined);
    const classId = pick("classId");
    const courseId = pick("courseId");
    const assignmentId = pick("assignmentId");
    if (classId && !ctx.assignments.some((a) => a.classId === classId)) {
      throw forbidden("Vous n'êtes pas affecté à cette classe", "NOT_ASSIGNED");
    }
    if (assignmentId && !ctx.assignments.some((a) => a.id === assignmentId)) {
      throw forbidden("Cette affectation ne vous appartient pas", "NOT_ASSIGNED");
    }
    if (courseId) await loadAuthorizedCourse(ctx, courseId);
    next();
  } catch (e) {
    next(e);
  }
}
