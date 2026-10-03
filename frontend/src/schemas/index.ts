import { z } from "zod";
import { IVORIAN_PHONE_REGEX } from "../constants";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Email ou identifiant requis"),
  password: z.string().min(6, "6 caractères minimum"),
});

/** Même politique que le serveur */
export const newPasswordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/\d/, "Au moins un chiffre");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Les mots de passe ne correspondent pas", path: ["confirmPassword"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "Choisissez un mot de passe différent de l'actuel", path: ["newPassword"] });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const registerSchoolSchema = z.object({
  schoolName: z.string().min(2, "Nom d'école requis"),
  schoolEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  schoolPhone: z.string().min(8).optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  adminFirstName: z.string().min(2, "Prénom requis"),
  adminLastName: z.string().min(2, "Nom requis"),
  adminEmail: z.string().email("Email invalide"),
  adminPassword: newPasswordSchema,
  adminPhone: z.string().min(8).optional().or(z.literal("")),
});

export const classSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Format AAAA-AAAA"),
  level: z.string().optional(),
  section: z.string().optional(),
});

export const studentSchema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  phone: z.string().optional(),
  classId: z.string().min(1, "Classe requise"),
  studentNumber: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
});

/** Cours planifié pour un enseignant (affectation) ou cours libre (classe + matière) */
export const courseSchema = z
  .object({
    assignmentId: z.string().optional(),
    subject: z.string().optional(),
    classId: z.string().optional(),
    date: z.string().min(1, "Date requise"),
    startTime: z.string().min(1, "Heure de début requise"),
    endTime: z.string().min(1, "Heure de fin requise"),
    room: z.string().optional(),
  })
  .refine((v) => !!v.assignmentId || (v.subject ?? "").trim().length >= 2, { message: "Matière requise", path: ["subject"] })
  .refine((v) => !!v.assignmentId || !!v.classId, { message: "Classe requise", path: ["classId"] })
  .refine((v) => v.startTime < v.endTime, { message: "L'heure de fin doit suivre l'heure de début", path: ["endTime"] });

/** Fiche enseignant : le compte de connexion est créé séparément (mot de passe temporaire) */
export const teacherSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(80),
  lastName: z.string().trim().min(2, "Nom requis").max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || IVORIAN_PHONE_REGEX.test(v.replace(/[\s.-]/g, "")), "Numéro ivoirien invalide (ex. 0707070707)")
    .optional(),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  employeeNumber: z.string().trim().max(50).optional(),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(500).optional(),
});

export type SubjectInput = z.infer<typeof subjectSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type TeacherInput = z.infer<typeof teacherSchema>;
