import { api, unwrap } from "./api";
import type { DashboardStats } from "../types";

export const dashboardService = {
  async stats(): Promise<DashboardStats> {
    const res = await api.get("/dashboard/stats");
    return unwrap<DashboardStats>(res);
  },
};
