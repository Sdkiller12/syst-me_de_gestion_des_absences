import { api, unwrap } from "./api";
import type { AuditEntry } from "../types";

export const auditService = {
  async list(): Promise<AuditEntry[]> {
    const res = await api.get("/audit-logs", { params: { limit: 100 } });
    return unwrap<AuditEntry[]>(res);
  },
};

export const smsConfigService = {
  async get(): Promise<{ provider: string; apiUrl?: string | null; senderId?: string | null; isActive: boolean } | null> {
    const res = await api.get("/sms-config");
    return unwrap(res);
  },

  async save(payload: { provider: "mock" | "production"; apiUrl?: string | null; apiKey?: string | null; senderId?: string | null; isActive?: boolean }) {
    const res = await api.put("/sms-config", payload);
    return unwrap(res);
  },
};
