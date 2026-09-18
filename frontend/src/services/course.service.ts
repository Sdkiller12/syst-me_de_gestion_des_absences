import { api, unwrap, unwrapPaginated } from "./api";
import type { Course } from "../types";

export const courseService = {
  async list(classId?: string): Promise<Course[]> {
    const res = await api.get("/courses", { params: { classId, limit: 100 } });
    return unwrapPaginated<Course>(res).data;
  },

  async get(id: string): Promise<Course> {
    const res = await api.get(`/courses/${id}`);
    return unwrap<Course>(res);
  },

  async create(payload: { subject: string; classId: string; teacherId?: string; date: string; startTime: string; endTime: string; room?: string }): Promise<Course> {
    const res = await api.post("/courses", payload);
    return unwrap<Course>(res);
  },

  async update(id: string, payload: Partial<{ subject: string; date: string; startTime: string; endTime: string; room: string }>): Promise<Course> {
    const res = await api.patch(`/courses/${id}`, payload);
    return unwrap<Course>(res);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/courses/${id}`);
  },
};
