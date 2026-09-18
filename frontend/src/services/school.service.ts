import { api, unwrap } from "./api";
import type { School } from "../types";

export const schoolService = {
  async me(): Promise<School> {
    const res = await api.get("/schools/me");
    return unwrap<School>(res);
  },

  async update(payload: Partial<{ name: string; email: string | null; phone: string | null; address: string | null; city: string | null; country: string | null }>): Promise<School> {
    const res = await api.patch("/schools/me", payload);
    return unwrap<School>(res);
  },
};
