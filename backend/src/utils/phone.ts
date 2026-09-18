/**
 * Côte d'Ivoire: préfixes 01, 05, 07 (10 chiffres nationaux).
 * Stockage en format international E.164: +225XXXXXXXXXX (sans le 0 initial).
 */
const LOCAL_REGEX = /^0[157]\d{8}$/;
const E164_REGEX = /^\+225[157]\d{8}$/;

export function normalizePhone(raw: string): string {
  const s = String(raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (!s) return "";
  // already E164
  if (E164_REGEX.test(s)) return s;
  // +225 without plus or with spaces: digits = "225" + national(10 chiffres avec 0 initial)
  const digits = s.replace(/[^\d]/g, "");
  if (digits.startsWith("225") && digits.length === 13) {
    const national = digits.slice(3); // ex: "0700000001"
    if (LOCAL_REGEX.test(national)) return "+225" + national.slice(1);
  }
  // local 10 digits
  const cleaned = digits.startsWith("0") ? digits : "0" + digits;
  if (LOCAL_REGEX.test(cleaned)) return "+225" + cleaned.slice(1);
  // fallback: if starts with 0 and 10 digits but invalid prefix, return as-is for validation to fail
  if (/^0\d{9}$/.test(digits)) return "+225" + digits.slice(1);
  return s;
}

export function validatePhone(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return E164_REGEX.test(normalized);
}

export function toDisplay(raw: string): string {
  // Store E164, but display can remain local if needed; keep E164 for provider
  return raw;
}
