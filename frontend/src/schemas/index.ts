import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "6 caractères minimum"),
});

export const registerSchoolSchema = z.object({
  schoolName: z.string().min(2, "Nom d'école requis"),
  schoolEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  schoolPhone: z.string().min(8).optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  adminFirstName: z.string().min(2, "Prénom requis"),
  adminLastName: z.string().min(2, "Nom requis"),
  adminEmail: z.string().email("Email invalide"),
  adminPassword: z.string().min(8, "8 caractères minimum"),
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

export const courseSchema = z.object({
  subject: z.string().min(2, "Matière requise"),
  classId: z.string().min(1, "Classe requise"),
  teacherId: z.string().optional(),
  date: z.string().min(1, "Date requise"),
  startTime: z.string().min(1, "Heure de début requise"),
  endTime: z.string().min(1, "Heure de fin requise"),
  room: z.string().optional(),
});

export const teacherSchema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  phone: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type TeacherInput = z.infer<typeof teacherSchema>;
