import { api, unwrap, unwrapPaginated } from "./api";
import type { Teacher } from "../types";

export const teacherService = {
  async list(search?: string): Promise<Teacher[]> {
    const res = await api.get("/teachers", { params: { search, limit: 100 } });
    return unwrapPaginated<Teacher>(res).data;
  },

  async create(payload: { firstName: string; lastName: string; email: string; password: string; phone?: string }): Promise<Teacher> {
    const res = await api.post("/teachers", payload);
    return unwrap<Teacher>(res);
  },

  async update(id: string, payload: Partial<{ firstName: string; lastName: string; phone: string | null; isActive: boolean }>): Promise<Teacher> {
    const res = await api.patch(`/teachers/${id}`, payload);
    return unwrap<Teacher>(res);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/teachers/${id}`);
  },
};
