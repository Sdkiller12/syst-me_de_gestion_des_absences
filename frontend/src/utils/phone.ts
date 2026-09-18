import { IVORIAN_PHONE_REGEX } from "../constants";

/** Normalise vers le format local 10 chiffres (0700000000). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+225")) return "0" + digits.slice(4);
  if (digits.startsWith("225") && digits.length === 13) return "0" + digits.slice(3);
  return digits;
}

export function isValidIvorianPhone(raw: string): boolean {
  return IVORIAN_PHONE_REGEX.test(normalizePhone(raw.trim()));
}

export function toInternational(raw: string): string {
  const local = normalizePhone(raw.trim());
  if (/^0\d{9}$/.test(local)) return "+225" + local.slice(1);
  return raw.trim();
}
