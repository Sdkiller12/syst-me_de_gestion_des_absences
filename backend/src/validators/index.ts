import { z } from "zod";
import { passwordPolicy } from "../utils/credentials.js";
import { validatePhone } from "../utils/phone.js";

/** Connexion par email ou identifiant ; "email" reste accepté pour les clients existants */
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(3, "Identifiant requis").max(254).optional(),
    email: z.string().trim().min(3).max(254).optional(),
    password: z.string().min(6, "6 caractères minimum").max(128),
  })
  .refine((v) => !!(v.identifier ?? v.email), { message: "Email ou identifiant requis", path: ["identifier"] });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis").max(128),
  newPassword: passwordPolicy,
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
  adminPassword: passwordPolicy,
  adminPhone: z.string().min(8).optional(),
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

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const phoneField = z
  .string()
  .trim()
  .refine((v) => v === "" || validatePhone(v), "Numéro de téléphone invalide (format ivoirien attendu)")
  .nullable()
  .optional();
const emailField = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email invalide")
  .nullable()
  .optional();
const academicYearField = z.string().regex(/^\d{4}-\d{4}$/, "Format AAAA-AAAA");
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ");

export const teacherCreateSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(80),
  lastName: z.string().trim().min(2, "Nom requis").max(80),
  phone: phoneField,
  email: emailField,
  employeeNumber: optionalText(50),
});

export const teacherUpdateSchema = teacherCreateSchema.partial();

export const teacherQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(100).optional(),
  account: z.enum(["none", "active", "disabled"]).optional(),
});

export const accountStatusSchema = z.object({ isActive: z.boolean() });

export const bulkAccountsSchema = z.object({ teacherIds: z.array(z.string().min(1)).max(500).optional() });

export const assignmentsCreateSchema = z.object({
  academicYear: academicYearField,
  items: z
    .array(z.object({ subjectId: z.string().min(1), classId: z.string().min(1) }))
    .min(1, "Sélectionnez au moins une classe")
    .max(300),
});

export const assignmentQuerySchema = z.object({
  academicYear: academicYearField.optional(),
  classId: z.string().optional(),
});

export const teacherAssignmentParamSchema = z.object({ id: z.string().min(1), assignmentId: z.string().min(1) });

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(2, "Nom de matière requis").max(120),
  code: optionalText(20),
  description: optionalText(500),
});

export const subjectUpdateSchema = subjectCreateSchema.partial().extend({ isActive: z.boolean().optional() });

const teacherImportValues = z.object({
  lastName: z.string().max(200).optional(),
  firstName: z.string().max(200).optional(),
  subject: z.string().max(200).optional(),
  className: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(254).optional(),
  employeeNumber: z.string().max(50).optional(),
});

export const teacherImportRowsSchema = z.object({
  rows: z
    .array(z.object({ line: z.number().int().min(0), values: teacherImportValues }))
    .min(1, "Aucune ligne à importer")
    .max(2000),
});

const attendanceStatus = z.enum(["PRESENT", "ABSENT", "LATE", "JUSTIFIED"]);

export const teacherAttendanceSchema = z
  .object({
    courseId: z.string().min(1).optional(),
    assignmentId: z.string().min(1).optional(),
    durationMinutes: z.number().int().min(15).max(240).optional(),
    records: z.array(z.object({ studentId: z.string().min(1), status: attendanceStatus })).min(1).max(500),
  })
  .refine((v) => !!v.courseId !== !!v.assignmentId, { message: "Indiquez soit un cours, soit une affectation", path: ["courseId"] });

export const teacherSheetQuerySchema = z
  .object({ courseId: z.string().min(1).optional(), assignmentId: z.string().min(1).optional() })
  .refine((v) => !!v.courseId !== !!v.assignmentId, { message: "Indiquez soit un cours, soit une affectation", path: ["courseId"] });

export const teacherCoursesQuerySchema = z.object({ from: dateField.optional(), to: dateField.optional() });

export const teacherHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  from: dateField.optional(),
  to: dateField.optional(),
  status: attendanceStatus.optional(),
});

export const classIdParamSchema = z.object({ classId: z.string().min(1) });

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

/** Un cours se planifie à partir d'une affectation (enseignant + matière + classe) ou librement pour soi */
export const courseSchemaExtended = courseSchema
  .extend({
    subject: z.string().min(2).max(120).optional(),
    classId: z.string().min(1).optional(),
    assignmentId: z.string().min(1).optional(),
    room: z.string().max(50).optional(),
  })
  .refine((v) => !!v.assignmentId || (!!v.subject && !!v.classId), {
    message: "Choisissez une affectation, ou indiquez la classe et la matière",
    path: ["assignmentId"],
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

// ─── Notes ──────────────────────────────────────────────────────────────────

export const EVALUATION_TYPES = ["DEVOIR", "INTERROGATION", "COMPOSITION", "EXAMEN", "AUTRE"] as const;
const evaluationType = z.enum(EVALUATION_TYPES);

/** Note sur le barème : 0 minimum, 2 décimales au plus ; le maximum dépend de l'évaluation (vérifié par le service) */
const scoreField = z
  .number({ error: "Note invalide" })
  .min(0, "Une note ne peut pas être négative")
  .max(1000)
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "2 décimales maximum");

const evaluationFields = {
  title: z.string().trim().min(2, "Intitulé requis").max(120),
  type: evaluationType.default("DEVOIR"),
  date: dateField,
  maxScore: z.number().positive("Le barème doit être positif").max(100, "Barème trop élevé").default(20),
  coefficient: z.number().positive("Le coefficient doit être positif").max(20, "Coefficient trop élevé").default(1),
};

export const evaluationCreateSchema = z.object({
  classId: z.string().min(1, "Classe requise"),
  subjectId: z.string().min(1, "Matière requise"),
  ...evaluationFields,
});

export const evaluationUpdateSchema = z
  .object({
    title: evaluationFields.title.optional(),
    type: evaluationType.optional(),
    date: dateField.optional(),
    maxScore: z.number().positive("Le barème doit être positif").max(100, "Barème trop élevé").optional(),
    coefficient: z.number().positive("Le coefficient doit être positif").max(20, "Coefficient trop élevé").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Aucune modification" });

/** score null = effacer la note de cet élève */
const gradeEntries = z
  .array(z.object({ studentId: z.string().min(1), score: scoreField.nullable() }))
  .max(500)
  .refine((rows) => new Set(rows.map((r) => r.studentId)).size === rows.length, "Un élève apparaît plusieurs fois");

export const gradesSaveSchema = z.object({ grades: gradeEntries });

/** Saisie en une fois : évaluation existante (evaluationId) ou nouvelle (evaluation), puis les notes */
export const teacherGradesPostSchema = z
  .object({
    evaluationId: z.string().min(1).optional(),
    evaluation: evaluationCreateSchema.optional(),
    grades: gradeEntries,
  })
  .refine((v) => !!v.evaluationId !== !!v.evaluation, { message: "Indiquez soit une évaluation existante, soit une nouvelle", path: ["evaluationId"] });

export const gradeUpdateSchema = z.object({ score: scoreField });

const listFilters = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  type: evaluationType.optional(),
  from: dateField.optional(),
  to: dateField.optional(),
};

export const evaluationQuerySchema = z.object(listFilters);

export const adminGradeQuerySchema = z.object({
  ...listFilters,
  teacherId: z.string().optional(),
  studentId: z.string().optional(),
});

export const studentGradeQuerySchema = z.object({
  subjectId: z.string().optional(),
  type: evaluationType.optional(),
  from: dateField.optional(),
  to: dateField.optional(),
});

// ─── Emploi du temps ────────────────────────────────────────────────────────

const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure au format HH:mm");

const timetableFields = {
  subjectId: z.string().min(1, "Matière requise"),
  teacherId: z.string().min(1, "Enseignant requis"),
  dayOfWeek: z.number().int().min(1, "Jour invalide").max(7, "Jour invalide"),
  startTime: timeField,
  endTime: timeField,
  room: z.string().trim().max(50).nullable().optional(),
};

const startBeforeEnd = (v: { startTime?: string; endTime?: string }) => !v.startTime || !v.endTime || v.startTime < v.endTime;
const timeOrderIssue = { message: "L'heure de fin doit être après l'heure de début", path: ["endTime"] };

export const timetableEntryCreateSchema = z
  .object({ classId: z.string().min(1, "Classe requise"), ...timetableFields })
  .refine(startBeforeEnd, timeOrderIssue);

export const timetableEntryUpdateSchema = z
  .object({
    subjectId: timetableFields.subjectId.optional(),
    teacherId: timetableFields.teacherId.optional(),
    dayOfWeek: timetableFields.dayOfWeek.optional(),
    startTime: timeField.optional(),
    endTime: timeField.optional(),
    room: timetableFields.room,
  })
  .refine(startBeforeEnd, timeOrderIssue);

export const timetableQuerySchema = z
  .object({ classId: z.string().optional(), teacherId: z.string().optional() })
  .refine((v) => !!v.classId !== !!v.teacherId, { message: "Indiquez une classe ou un enseignant", path: ["classId"] });

export const studentAccountsSchema = z.object({
  classId: z.string().min(1).optional(),
  studentIds: z.array(z.string().min(1)).max(500).optional(),
});
