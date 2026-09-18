export type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER";

export interface User {
  id: string;
  schoolId: string | null;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive?: boolean;
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

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
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
