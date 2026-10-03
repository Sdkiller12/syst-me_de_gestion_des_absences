export type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "STUDENT";

export interface User {
  id: string;
  schoolId: string | null;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string | null;
  username?: string | null;
  phone?: string | null;
  role: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
}

export interface School {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  logo?: string | null;
}

export interface TeacherAccount {
  userId: string;
  username: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  employeeNumber: string | null;
  isActive: boolean;
  createdAt: string;
  account: TeacherAccount | null;
  subjects: Array<{ id: string; name: string }>;
  assignmentCount: number;
  classCount: number;
}

export interface TeacherStats {
  total: number;
  withoutAccount: number;
  activeAccounts: number;
  disabledAccounts: number;
  pendingFirstLogin: number;
  withoutAssignment: number;
}

/** Identifiants remis une seule fois à l'administrateur */
export interface IssuedCredentials {
  teacherId?: string;
  studentId?: string;
  fullName: string;
  username: string;
  email: string | null;
  temporaryPassword: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  assignmentCount: number;
  createdAt: string;
}

export interface TeachingAssignment {
  id: string;
  academicYear: string;
  subject: { id: string; name: string };
  class: { id: string; name: string; academicYear?: string };
  courseCount?: number;
  teacher?: { id: string; fullName: string; hasAccount: boolean };
}

export type TeacherImportField = "lastName" | "firstName" | "subject" | "className" | "phone" | "email" | "employeeNumber";
export type TeacherImportValues = Partial<Record<TeacherImportField, string>>;
export type TeacherImportStatus = "VALID" | "WARNING" | "EXISTING" | "DUPLICATE" | "ERROR";

export interface TeacherImportRow {
  line: number;
  values: TeacherImportValues;
  status: TeacherImportStatus;
  issues: Array<{ field: TeacherImportField | null; message: string; blocking: boolean }>;
  existingTeacherId: string | null;
  subject: { id: string | null; name: string } | null;
  class: { id: string; name: string; academicYear: string } | null;
}

export interface TeacherImportSummary {
  total: number;
  valid: number;
  warnings: number;
  existing: number;
  duplicates: number;
  errors: number;
  teachersToCreate: number;
  subjectsToCreate: number;
  assignmentsDetected: number;
}

export interface TeacherImportPreview {
  fileName: string;
  fileType: "EXCEL" | "PDF" | "PDF_OCR";
  ocrConfidence: number | null;
  columns: Array<{ header: string; field: TeacherImportField | null }>;
  summary: TeacherImportSummary;
  rows: TeacherImportRow[];
}

export interface TeacherImportResult {
  teachersCreated: number;
  teachersUpdated: number;
  subjectsCreated: number;
  assignmentsCreated: number;
  duplicatesSkipped: number;
  createdTeacherIds: string[];
}

// ─── Espace enseignant ──────────────────────────────────────────────────────

export interface AttendanceCounts {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  JUSTIFIED: number;
  total: number;
}

export interface TeacherCourse {
  id: string;
  subject: string;
  subjectId: string | null;
  classId: string;
  className: string;
  assignmentId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  attendanceTaken: boolean;
  counts: AttendanceCounts;
}

export interface TeacherProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  employeeNumber: string | null;
  school: { id: string; name: string; city: string | null };
  account: { username: string | null; email: string | null; lastLoginAt: string | null };
  subjects: Array<{ id: string; name: string }>;
  assignments: TeachingAssignment[];
}

export interface TeacherDashboard {
  date: string;
  teacherName: string;
  classes: number;
  subjects: number;
  assignments: number;
  coursesToday: number;
  callsPending: number;
  absencesToday: number;
  lateToday: number;
  absencesWeek: number;
  sessionsWeek: number;
  todayCourses: TeacherCourse[];
}

export interface TeacherClass {
  id: string;
  name: string;
  academicYear: string;
  level: string | null;
  studentCount: number;
  assignments: Array<{ id: string; subjectId: string; subjectName: string; academicYear: string }>;
}

export interface SheetStudent {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  status: AttendanceStatus | null;
}

export interface AttendanceSheet {
  mode: "COURSE" | "NEW_SESSION";
  course: TeacherCourse | null;
  assignment: { id: string; subjectName: string; className: string };
  date: string;
  time: string;
  alreadyRecorded: boolean;
  todaySessions?: TeacherCourse[];
  students: SheetStudent[];
}

export interface AttendanceSession {
  course: TeacherCourse;
  records: Array<{
    id: string;
    student: { id: string; firstName: string; lastName: string; studentNumber: string | null };
    status: AttendanceStatus;
    recordedAt: string;
    smsStatus: string | null;
  }>;
}

export interface ClassItem {
  id: string;
  name: string;
  academicYear: string;
  level?: string | null;
  section?: string | null;
  studentCount: number;
  createdAt: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber?: string | null;
  phone: string;
  parentName?: string | null;
  parentPhone?: string | null;
  email?: string | null;
  classId: string;
  className?: string;
  account?: { username: string | null; isActive: boolean; mustChangePassword: boolean; lastLoginAt: string | null } | null;
  createdAt: string;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED";

export interface Course {
  id: string;
  subject: string;
  name?: string;
  classId: string;
  className?: string;
  teacherId: string;
  teacherName?: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  courseId: string;
  studentId: string;
  studentName?: string;
  className?: string;
  subject?: string;
  date?: string;
  status: AttendanceStatus;
  absenceTime?: string | null;
  justification?: string | null;
  recordedAt: string;
}

export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

export interface NotificationItem {
  id: string;
  studentId: string;
  studentName: string;
  phone: string;
  recipient?: string;
  attendanceId: string;
  message: string;
  provider?: string;
  status: NotificationStatus;
  errorMessage?: string;
  sentAt: string;
}

export interface DashboardStats {
  students: number;
  classes: number;
  courses: number;
  todayAbsences: number;
  weekAbsences: number;
  todayPresences: number;
  smsSent: number;
  smsFailed: number;
  presenceRate: number;
  recentAbsences: Array<{ id: string; studentName: string; className: string; subject: string; recordedAt: string }>;
  recentNotifications: Array<{ id: string; studentName: string; status: NotificationStatus; sentAt: string }>;
}

export interface ImportReport {
  analyzed: number;
  imported: number;
  duplicates: number;
  invalid: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export interface AuditEntry {
  id: string;
  schoolId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export type EvaluationType = "DEVOIR" | "INTERROGATION" | "COMPOSITION" | "EXAMEN" | "AUTRE";

export interface GradeStats {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
}

export interface Evaluation {
  id: string;
  title: string;
  type: EvaluationType;
  date: string;
  maxScore: number;
  coefficient: number;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  teacher: { id: string; fullName: string };
  stats: GradeStats;
  studentCount?: number;
  editable?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationSheet {
  evaluation: Evaluation;
  editable: boolean;
  students: Array<{ id: string; firstName: string; lastName: string; studentNumber: string | null; gradeId: string | null; score: number | null }>;
}

export interface GradeRow {
  id: string;
  score: number;
  student: { id: string; firstName: string; lastName: string; studentNumber: string | null };
  evaluation: { id: string; title: string; type: EvaluationType; date: string; maxScore: number; coefficient: number };
  class: { id: string; name: string };
  subject: { id: string; name: string };
  teacher: { id: string; fullName: string };
  updatedAt: string;
}

export interface AdminEvaluationDetail {
  evaluation: Evaluation;
  grades: Array<{ id: string; score: number; student: GradeRow["student"]; updatedAt: string }>;
}

export interface GradeOverview {
  evaluations: number;
  grades: number;
  average: number | null;
  bySubject: Array<{ subjectId: string; subjectName: string; count: number; average: number | null }>;
}

export interface ReportGrade {
  id: string;
  evaluationId: string;
  title: string;
  type: EvaluationType;
  date: string;
  score: number;
  maxScore: number;
  coefficient: number;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  updatedAt: string;
}

export interface GradeReport {
  subjects: Array<{ subjectId: string; subjectName: string; average: number | null; count: number; grades: ReportGrade[] }>;
  overallAverage: number | null;
  evaluationCount: number;
  availableSubjects?: Array<{ id: string; name: string }>;
}

// ─── Emploi du temps ────────────────────────────────────────────────────────

export interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  teacher: { id: string | null; name: string };
}

export interface ClassTimetable {
  class: { id: string; name: string; level: string | null; academicYear: string };
  entries: TimetableEntry[];
}

export interface TeacherTimetable {
  teacher: { id: string; fullName: string };
  entries: TimetableEntry[];
}

export interface ClassOption {
  id: string;
  name: string;
  level: string | null;
  academicYear: string;
  slotCount: number;
}

// ─── Espace étudiant ────────────────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  studentNumber: string | null;
  email: string | null;
  class: { id: string; name: string; level: string | null; academicYear: string };
  school: { id: string; name: string; city: string | null };
  account: { username: string | null; lastLoginAt: string | null };
}
