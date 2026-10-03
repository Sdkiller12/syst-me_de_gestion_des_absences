import { api, unwrap, unwrapPaginated } from "./api";
import type {
  IssuedCredentials,
  Teacher,
  TeacherImportPreview,
  TeacherImportResult,
  TeacherImportRow,
  TeacherImportSummary,
  TeacherImportValues,
  TeacherStats,
  TeachingAssignment,
} from "../types";

export interface TeacherProfileInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  employeeNumber?: string | null;
}

type ImportRowPayload = { line: number; values: TeacherImportValues };

/** Gestion des enseignants (administration de l'établissement) */
export const teacherService = {
  async list(params?: { search?: string; account?: "none" | "active" | "disabled"; page?: number }) {
    const res = await api.get("/teachers", { params: { ...params, limit: 100 } });
    return unwrapPaginated<Teacher>(res);
  },

  async stats(): Promise<TeacherStats> {
    return unwrap<TeacherStats>(await api.get("/teachers/stats"));
  },

  async get(id: string): Promise<Teacher> {
    return unwrap<Teacher>(await api.get(`/teachers/${id}`));
  },

  async create(payload: TeacherProfileInput): Promise<Teacher> {
    return unwrap<Teacher>(await api.post("/teachers", payload));
  },

  async update(id: string, payload: Partial<TeacherProfileInput>): Promise<Teacher> {
    return unwrap<Teacher>(await api.patch(`/teachers/${id}`, payload));
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/teachers/${id}`);
  },

  async createAccount(id: string): Promise<IssuedCredentials> {
    return unwrap<IssuedCredentials>(await api.post(`/teachers/${id}/account`));
  },

  async createAccounts(teacherIds?: string[]): Promise<{ created: IssuedCredentials[]; skipped: number }> {
    return unwrap(await api.post("/teachers/accounts", { teacherIds }));
  },

  async resetPassword(id: string): Promise<IssuedCredentials> {
    return unwrap<IssuedCredentials>(await api.post(`/teachers/${id}/reset-password`));
  },

  async setAccountStatus(id: string, isActive: boolean): Promise<Teacher> {
    return unwrap<Teacher>(await api.patch(`/teachers/${id}/account-status`, { isActive }));
  },

  async assignments(id: string): Promise<TeachingAssignment[]> {
    return unwrap<TeachingAssignment[]>(await api.get(`/teachers/${id}/assignments`));
  },

  async createAssignments(id: string, payload: { academicYear: string; items: Array<{ subjectId: string; classId: string }> }) {
    return unwrap<{ created: number; skipped: number }>(await api.post(`/teachers/${id}/assignments`, payload));
  },

  async deleteAssignment(id: string, assignmentId: string): Promise<void> {
    await api.delete(`/teachers/${id}/assignments/${assignmentId}`);
  },

  async schoolAssignments(params?: { classId?: string; academicYear?: string }): Promise<TeachingAssignment[]> {
    return unwrap<TeachingAssignment[]>(await api.get("/assignments", { params }));
  },

  async importPreview(file: File): Promise<TeacherImportPreview> {
    const form = new FormData();
    form.append("file", file);
    // L'analyse d'un PDF scanné (OCR) peut prendre du temps
    return unwrap<TeacherImportPreview>(await api.post("/teachers/import/preview", form, { timeout: 180_000 }));
  },

  async importRevalidate(rows: ImportRowPayload[]): Promise<{ summary: TeacherImportSummary; rows: TeacherImportRow[] }> {
    return unwrap(await api.post("/teachers/import/revalidate", { rows }));
  },

  async importConfirm(rows: ImportRowPayload[]): Promise<TeacherImportResult> {
    return unwrap<TeacherImportResult>(await api.post("/teachers/import/confirm", { rows }, { timeout: 120_000 }));
  },
};
