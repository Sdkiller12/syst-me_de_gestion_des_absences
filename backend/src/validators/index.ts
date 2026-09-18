import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "6 caractères minimum"),
});

export const classSchema = z.object({
  name: z.string().min(2, "Nom requis").max(100),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Format AAAA-AAAA"),
});

export const classQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  academicYear: z.string().optional(),
});

export const studentSchema = z.object({
  firstName: z.string().min(2, "Prénom requis").max(80),
  lastName: z.string().min(2, "Nom requis").max(80),
  phone: z.string().min(8, "Téléphone requis"),
  classId: z.string().min(1, "Classe requise"),
});

export const studentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  classId: z.string().optional(),
  search: z.string().optional(),
});

export const importQuerySchema = z.object({
  classId: z.string().min(1, "classId requis en query ou form-data"),
});

export const courseSchema = z.object({
  subject: z.string().min(2).max(120),
  classId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
});

export const courseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  classId: z.string().optional(),
  teacherId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const attendancePayloadSchema = z.object({
  courseId: z.string().min(1),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "JUSTIFIED"]),
    }),
  ).min(1, "Au moins un enregistrement"),
});

export const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  courseId: z.string().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "JUSTIFIED"]).optional(),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  studentId: z.string().optional(),
  classId: z.string().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
export const courseIdParamSchema = z.object({ courseId: z.string().min(1) });

export const registerSchoolSchema = z.object({
  schoolName: z.string().min(2, "Nom d'école requis").max(150),
  schoolEmail: z.string().email("Email école invalide").optional(),
  schoolPhone: z.string().min(8).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  adminFirstName: z.string().min(2, "Prénom requis").max(80),
  adminLastName: z.string().min(2, "Nom requis").max(80),
  adminEmail: z.string().email("Email invalide"),
  adminPassword: z.string().min(8, "8 caractères minimum"),
  adminPhone: z.string().min(8).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token requis"),
});

export const schoolUpdateSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(8).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  logo: z.string().max(500).nullable().optional(),
});

export const teacherCreateSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  phone: z.string().min(8).optional(),
});

export const teacherUpdateSchema = z.object({
  firstName: z.string().min(2).max(80).optional(),
  lastName: z.string().min(2).max(80).optional(),
  phone: z.string().min(8).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const classSchemaExtended = classSchema.extend({
  level: z.string().max(50).optional(),
  section: z.string().max(50).optional(),
});

export const studentSchemaExtended = studentSchema.extend({
  studentNumber: z.string().max(50).optional(),
  parentName: z.string().max(120).optional(),
  parentPhone: z.string().min(8).optional(),
  email: z.string().email().optional(),
});

export const courseSchemaExtended = courseSchema.extend({
  room: z.string().max(50).optional(),
});

export const attendanceUpdateSchema = z.object({
  status: z.enum(["PRESENT", "ABSENT", "LATE", "JUSTIFIED"]),
  justification: z.string().max(500).nullable().optional(),
});

export const smsConfigSchema = z.object({
  provider: z.enum(["mock", "production"]),
  apiUrl: z.string().url().nullable().optional(),
  apiKey: z.string().max(255).nullable().optional(),
  senderId: z.string().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  entity: z.string().optional(),
  userId: z.string().optional(),
});
