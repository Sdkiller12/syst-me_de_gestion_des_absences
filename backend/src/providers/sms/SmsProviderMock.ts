import type { SmsProvider, SmsProviderResponse } from "./SmsProvider.js";
import { logger } from "../../config/logger.js";

export class MockSmsProvider implements SmsProvider {
  async sendSms(phone: string, message: string): Promise<SmsProviderResponse> {
    // Deterministic: phones ending with 0000 simulate failure
    const fail = phone.endsWith("0000");
    logger.info({ phone, preview: message.slice(0, 40) }, "MockSms send");
    await new Promise((r) => setTimeout(r, 30));
    if (fail) return { success: false, errorMessage: "Numéro invalide (mock)" };
    return { success: true, providerMessageId: `mock-${Date.now()}-${phone.slice(-4)}` };
  }
}
