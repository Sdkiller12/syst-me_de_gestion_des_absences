import { api, unwrap, unwrapPaginated } from "./api";
import type {
  AttendanceCounts,
  AttendanceSession,
  AttendanceSheet,
  AttendanceStatus,
  TeacherClass,
  TeacherCourse,
  TeacherDashboard,
  TeacherProfile,
} from "../types";

/**
 * Espace enseignant. Aucun identifiant d'enseignant n'est envoyé : le serveur
 * déduit l'enseignant de la session et vérifie chaque affectation.
 */
export const teacherSpaceService = {
  async me(): Promise<TeacherProfile> {
    return unwrap<TeacherProfile>(await api.get("/teacher/me"));
  },

  async dashboard(): Promise<TeacherDashboard> {
    return unwrap<TeacherDashboard>(await api.get("/teacher/dashboard"));
  },

  async classes(): Promise<TeacherClass[]> {
    return unwrap<TeacherClass[]>(await api.get("/teacher/classes"));
  },

  async classStudents(classId: string) {
    return unwrap<Array<{ id: string; firstName: string; lastName: string; studentNumber: string | null }>>(
      await api.get(`/teacher/classes/${classId}/students`),
    );
  },

  async courses(params?: { from?: string; to?: string }): Promise<TeacherCourse[]> {
    return unwrap<TeacherCourse[]>(await api.get("/teacher/courses", { params }));
  },

  async sheet(params: { courseId?: string; assignmentId?: string }): Promise<AttendanceSheet> {
    return unwrap<AttendanceSheet>(await api.get("/teacher/attendance/sheet", { params }));
  },

  async saveAttendance(payload: {
    courseId?: string;
    assignmentId?: string;
    durationMinutes?: number;
    records: Array<{ studentId: string; status: AttendanceStatus }>;
  }): Promise<{ courseId: string; counts: AttendanceCounts; smsQueued: number }> {
    return unwrap(await api.post("/teacher/attendance", payload));
  },

  async history(params: { page?: number; classId?: string; subjectId?: string; from?: string; to?: string; status?: AttendanceStatus | "" }) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined));
    return unwrapPaginated<TeacherCourse>(await api.get("/teacher/attendance", { params: { ...clean, limit: 20 } }));
  },

  async session(courseId: string): Promise<AttendanceSession> {
    return unwrap<AttendanceSession>(await api.get(`/teacher/attendance/${courseId}`));
  },
};
