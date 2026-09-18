import type { SmsProvider, SmsProviderResponse } from "./SmsProvider.js";
import { getEnv } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export class ProductionSmsProvider implements SmsProvider {
  constructor(
    private overrideUrl?: string,
    private overrideKey?: string,
    private overrideSender?: string,
  ) {}

  async sendSms(phone: string, message: string): Promise<SmsProviderResponse> {
    const env = getEnv();
    const url = this.overrideUrl || env.SMS_API_URL;
    const key = this.overrideKey || env.SMS_API_KEY;
    const sender = this.overrideSender || env.SMS_SENDER_ID || env.SMS_SENDER;
    if (!url || !key) return { success: false, errorMessage: "Fournisseur SMS non configuré" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ to: phone, from: sender, text: message }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const err = (body.error as string) ?? (body.message as string) ?? `HTTP ${res.status}`;
        logger.warn({ phone, status: res.status }, "SMS provider error");
        return { success: false, errorMessage: err };
      }
      const id = (body.id as string) ?? (body.messageId as string) ?? undefined;
      return { success: true, providerMessageId: id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur réseau SMS";
      logger.error({ phone, err: msg }, "SMS provider exception");
      return { success: false, errorMessage: msg };
    } finally {
      clearTimeout(timeout);
    }
  }
}
