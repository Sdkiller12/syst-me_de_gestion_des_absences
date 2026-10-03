import { api, unwrap } from "./api";
import type { Subject } from "../types";

export interface SubjectInput {
  name: string;
  code?: string | null;
  description?: string | null;
}

export const subjectService = {
  async list(params?: { search?: string; active?: boolean }): Promise<Subject[]> {
    const res = await api.get("/subjects", { params: { search: params?.search || undefined, active: params?.active ? "true" : undefined } });
    return unwrap<Subject[]>(res);
  },

  async create(payload: SubjectInput): Promise<Subject> {
    return unwrap<Subject>(await api.post("/subjects", payload));
  },

  async update(id: string, payload: Partial<SubjectInput> & { isActive?: boolean }): Promise<Subject> {
    return unwrap<Subject>(await api.patch(`/subjects/${id}`, payload));
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/subjects/${id}`);
  },
};
