import { api, unwrap, unwrapPaginated } from "./api";
import type { ClassItem } from "../types";
import type { Paginated } from "./api";

export const classService = {
  async list(search?: string): Promise<ClassItem[]> {
    const res = await api.get("/classes", { params: { search, limit: 100 } });
    const page = unwrapPaginated<ClassItem>(res);
    return page.data;
  },

  async listPaginated(params?: { search?: string; page?: number; limit?: number }): Promise<Paginated<ClassItem>> {
    const res = await api.get("/classes", { params });
    return unwrapPaginated<ClassItem>(res);
  },

  async get(id: string): Promise<ClassItem> {
    const res = await api.get(`/classes/${id}`);
    return unwrap<ClassItem>(res);
  },

  async create(payload: { name: string; academicYear: string; level?: string; section?: string }): Promise<ClassItem> {
    const res = await api.post("/classes", payload);
    return unwrap<ClassItem>(res);
  },

  async update(id: string, payload: { name: string; academicYear: string; level?: string; section?: string }): Promise<ClassItem> {
    const res = await api.patch(`/classes/${id}`, payload);
    return unwrap<ClassItem>(res);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/classes/${id}`);
  },
};
