import { normalizePhone } from "../../utils/phone.js";

export interface NormalizedStudentData {
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  phone: string;
  parentPhone: string | null;
  parentName: string | null;
  email: string | null;
  className: string | null;
}

/**
 * Normalizes strings by removing extra spaces, formatting names, phones, and emails
 */
export function normalizeStudentData(raw: Record<string, unknown>): NormalizedStudentData {
  const getStr = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    return String(val).trim();
  };

  const rawFirstName = getStr(raw.firstName);
  const rawLastName = getStr(raw.lastName);
  const rawStudentNumber = getStr(raw.studentNumber);
  const rawPhone = getStr(raw.phone);
  const rawParentPhone = getStr(raw.parentPhone);
  const rawParentName = getStr(raw.parentName);
  const rawEmail = getStr(raw.email);
  const rawClass = getStr(raw.class ?? raw.className);

  // Capitalize last name in UPPERCASE (e.g. KOUASSI)
  const lastName = rawLastName.toUpperCase().replace(/\s+/g, " ");

  // Title case for first names (e.g. Jean-Paul, Aminata)
  const firstName = rawFirstName
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  const studentNumber = rawStudentNumber ? rawStudentNumber.toUpperCase().replace(/\s+/g, "") : null;

  const phone = rawPhone ? normalizePhone(rawPhone) : "";
  const parentPhone = rawParentPhone ? normalizePhone(rawParentPhone) : null;
  const parentName = rawParentName ? rawParentName.replace(/\s+/g, " ") : null;
  const email = rawEmail ? rawEmail.toLowerCase().replace(/\s+/g, "") : null;
  const className = rawClass ? rawClass.replace(/\s+/g, " ") : null;

  return {
    firstName,
    lastName,
    studentNumber,
    phone,
    parentPhone,
    parentName,
    email,
    className,
  };
}
