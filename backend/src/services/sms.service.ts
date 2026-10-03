import { validatePhone } from "../utils/phone.js";
import { getEnv } from "../config/env.js";
import { prisma } from "../config/database.js";
import { MockSmsProvider } from "../providers/sms/SmsProviderMock.js";
import { ProductionSmsProvider } from "../providers/sms/SmsProviderProduction.js";
import type { SmsProvider } from "../providers/sms/SmsProvider.js";

function globalProvider(): SmsProvider {
  const env = getEnv();
  if (env.SMS_PROVIDER === "production") return new ProductionSmsProvider();
  return new MockSmsProvider();
}

export const smsService = {
  getProvider: globalProvider,
  /**
   * Sends via the school's configured provider when present,
   * otherwise the global SMS_PROVIDER. Mock is only ever used
   * in dev/test or when explicitly configured per school.
   */
  async sendSms(phone: string, message: string, schoolId?: string | null) {
    if (!validatePhone(phone)) {
      return { success: false, errorMessage: "Numéro invalide" as const };
    }
    let provider: SmsProvider = globalProvider();
    let providerName: "mock" | "production" = getEnv().SMS_PROVIDER;
    if (schoolId) {
      const cfg = await prisma.smsConfig.findUnique({ where: { schoolId } }).catch(() => null);
      if (cfg && cfg.isActive) {
        providerName = cfg.provider as "mock" | "production";
        provider = cfg.provider === "production" ? new ProductionSmsProvider(cfg.apiUrl ?? undefined, cfg.apiKey ?? undefined, cfg.senderId ?? undefined) : new MockSmsProvider();
      }
    }
    // En production, le simulateur ne doit jamais faire croire qu'un SMS est parti :
    // échec définitif et explicite tant qu'aucun vrai fournisseur n'est configuré.
    if (process.env.NODE_ENV === "production" && providerName === "mock") {
      return {
        success: false,
        errorMessage: "Aucun fournisseur SMS configuré : SMS non envoyé",
        provider: "none",
        permanent: true,
      };
    }
    const res = await provider.sendSms(phone, message);
    return { ...res, provider: providerName };
  },
};
