import { api, unwrap } from "./api";
import type { AttendanceRecord, AttendanceStatus } from "../types";

export const attendanceService = {
  async byCourse(courseId: string): Promise<AttendanceRecord[]> {
    const res = await api.get(`/attendance/course/${courseId}`);
    return unwrap<AttendanceRecord[]>(res);
  },

  async list(params?: { status?: string; studentId?: string; classId?: string }): Promise<AttendanceRecord[]> {
    const res = await api.get("/attendance", { params: { ...params, limit: 100 } });
    const body = res.data as { success: boolean; data: AttendanceRecord[] };
    return body.data;
  },

  async save(courseId: string, records: Array<{ studentId: string; status: AttendanceStatus; justification?: string }>): Promise<AttendanceRecord[]> {
    const res = await api.post("/attendance", { courseId, records });
    return unwrap<AttendanceRecord[]>(res);
  },
};
