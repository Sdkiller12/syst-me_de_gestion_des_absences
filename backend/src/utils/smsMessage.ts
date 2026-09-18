/**
 * SMS message helpers — GSM-7 safe encoding.
 *
 * GSM-7 supports 160 chars per single segment. Characters outside the GSM-7
 * charset trigger UCS-2 encoding, which drops the limit to 70 chars/segment
 * and can cause extra billing. To stay predictable and cost-efficient we
 * strip diacritics (accented chars → ASCII equivalent) before building messages.
 *
 * Security: user-supplied strings (names, subjects) are sanitised to remove
 * newlines and control characters that could be used for SMS injection.
 */

/** GSM-7 diacritic map — most common French/African accented chars */
const DIACRITIC_MAP: Record<string, string> = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  î: "i", ï: "i", í: "i", ì: "i",
  ô: "o", ö: "o", ó: "o", ò: "o", õ: "o",
  ù: "u", û: "u", ü: "u", ú: "u",
  ç: "c", ñ: "n",
  À: "A", Â: "A", Ä: "A", Á: "A",
  È: "E", É: "E", Ê: "E", Ë: "E",
  Î: "I", Ï: "I",
  Ô: "O", Ö: "O",
  Ù: "U", Û: "U", Ü: "U",
  Ç: "C", Ñ: "N",
  "œ": "oe", "Œ": "OE", "æ": "ae", "Æ": "AE",
};

/**
 * Sanitise a user-supplied string for safe inclusion in an SMS message:
 * 1. Strip/replace diacritics → GSM-7 compatible ASCII.
 * 2. Remove control characters (newlines, tabs, null bytes) to prevent SMS injection.
 * 3. Trim whitespace.
 */
export function sanitizeSmsField(value: string): string {
  // Replace known diacritics
  let result = value.replace(/[^\u0000-\u007F]/g, (ch) => DIACRITIC_MAP[ch] ?? "");
  // Remove control characters (ASCII < 0x20 except space, and DEL 0x7F)
  result = result.replace(/[\x00-\x1F\x7F]/g, " ");
  return result.trim();
}

/**
 * Build the absence SMS notification message.
 * All user-supplied fields are sanitised before interpolation.
 */
export function buildAbsenceMessage(params: {
  firstName: string;
  lastName: string;
  subject: string;
  date: string;   // ISO date string YYYY-MM-DD
  startTime: string;
}): string {
  const firstName = sanitizeSmsField(params.firstName);
  const lastName = sanitizeSmsField(params.lastName);
  const subject = sanitizeSmsField(params.subject);
  const startTime = sanitizeSmsField(params.startTime);
  // Format date as DD/MM/YYYY for readability
  const [year, month, day] = params.date.split("-");
  const formattedDate = `${day}/${month}/${year}`;

  return `Bonjour, votre enfant ${firstName} ${lastName} a ete signale absent au cours de ${subject} le ${formattedDate} a ${startTime}. Contactez l'etablissement pour toute information.`;
}

/**
 * Build the justification confirmation SMS.
 */
export function buildJustificationMessage(params: {
  firstName: string;
  lastName: string;
  subject: string;
  date: string;
}): string {
  const firstName = sanitizeSmsField(params.firstName);
  const lastName = sanitizeSmsField(params.lastName);
  const subject = sanitizeSmsField(params.subject);
  const [year, month, day] = params.date.split("-");
  const formattedDate = `${day}/${month}/${year}`;

  return `Bonjour, l'absence de votre enfant ${firstName} ${lastName} au cours de ${subject} le ${formattedDate} a ete justifiee.`;
}
