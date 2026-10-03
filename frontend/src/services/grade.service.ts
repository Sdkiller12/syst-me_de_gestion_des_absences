import { api, unwrap, unwrapPaginated } from "./api";
import type {
  AdminEvaluationDetail,
  Evaluation,
  EvaluationSheet,
  EvaluationType,
  GradeOverview,
  GradeReport,
  GradeRow,
  StudentProfile,
} from "../types";

export interface GradeFilters {
  page?: number;
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  studentId?: string;
  type?: EvaluationType | "";
  from?: string;
  to?: string;
}

export interface EvaluationInput {
  classId: string;
  subjectId: string;
  title: string;
  type: EvaluationType;
  date: string;
  maxScore: number;
  coefficient: number;
}

/** Filtres vides retirés : le serveur ne reçoit que ce qui est réellement choisi */
const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null));

/** Saisie des notes par l'enseignant : le serveur déduit l'enseignant de la session */
export const teacherGradeService = {
  async evaluations(params: GradeFilters) {
    return unwrapPaginated<Evaluation>(await api.get("/teacher/evaluations", { params: { ...clean(params), limit: 20 } }));
  },

  async evaluation(id: string): Promise<EvaluationSheet> {
    return unwrap<EvaluationSheet>(await api.get(`/teacher/evaluations/${id}`));
  },

  async updateEvaluation(id: string, payload: Partial<Omit<EvaluationInput, "classId" | "subjectId">>): Promise<Evaluation> {
    return unwrap<Evaluation>(await api.patch(`/teacher/evaluations/${id}`, payload));
  },

  async removeEvaluation(id: string): Promise<void> {
    await api.delete(`/teacher/evaluations/${id}`);
  },

  /** Nouvelle évaluation + notes, ou notes d'une évaluation existante, en une seule requête atomique */
  async saveGrades(payload: {
    evaluationId?: string;
    evaluation?: EvaluationInput;
    grades: Array<{ studentId: string; score: number | null }>;
  }): Promise<{ evaluationId: string; created: boolean; saved: number; cleared: number }> {
    return unwrap(await api.post("/teacher/grades", payload));
  },
};

/** Consultation administrateur : lecture seule, aucune méthode d'écriture n'existe */
export const adminGradeService = {
  async grades(params: GradeFilters) {
    return unwrapPaginated<GradeRow>(await api.get("/admin/grades", { params: { ...clean(params), limit: 25 } }));
  },

  async evaluations(params: GradeFilters) {
    return unwrapPaginated<Evaluation>(await api.get("/admin/grades/evaluations", { params: { ...clean(params), limit: 20 } }));
  },

  async evaluation(id: string): Promise<AdminEvaluationDetail> {
    return unwrap<AdminEvaluationDetail>(await api.get(`/admin/grades/evaluations/${id}`));
  },

  async stats(params: GradeFilters): Promise<GradeOverview> {
    const { page: _page, ...rest } = params;
    return unwrap<GradeOverview>(await api.get("/admin/grades/stats", { params: clean(rest) }));
  },

  async studentReport(studentId: string, params: Pick<GradeFilters, "subjectId" | "type" | "from" | "to">) {
    return unwrap<GradeReport & { student: Pick<StudentProfile, "id" | "firstName" | "lastName" | "studentNumber"> & { class: { id: string; name: string } } }>(
      await api.get(`/admin/grades/students/${studentId}`, { params: clean(params) }),
    );
  },
};
