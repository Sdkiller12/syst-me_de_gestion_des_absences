import { api, unwrap, unwrapPaginated } from "./api";
import type { NotificationItem } from "../types";

export const notificationService = {
  async list(): Promise<NotificationItem[]> {
    const res = await api.get("/notifications", { params: { limit: 100 } });
    return unwrapPaginated<NotificationItem>(res).data;
  },

  async retry(id: string): Promise<NotificationItem> {
    const res = await api.post(`/notifications/${id}/retry`);
    return unwrap<NotificationItem>(res);
  },
};
