import { validatePhone } from "../../utils/phone.js";
import type { NormalizedStudentData } from "./normalizer.js";

export type RowStatus = "VALID" | "ERROR" | "WARNING" | "DUPLICATE";

export interface ValidatedStudentRow {
  lineIndex: number;
  data: NormalizedStudentData;
  rawOriginal: Record<string, unknown>;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  confidenceScore: number; // 0 to 100
  isDuplicateInternal?: boolean;
  isDuplicateDb?: boolean;
  duplicateInfo?: string;
  needsManualReview?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStudentRow(
  data: NormalizedStudentData,
  rawOriginal: Record<string, unknown>,
  lineIndex: number,
  baseConfidence = 100
): ValidatedStudentRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidenceScore = baseConfidence;

  // Check required fields
  if (!data.lastName || data.lastName === "VALEUR NON DÉTECTÉE" || data.lastName === "UNREADABLE") {
    errors.push("Nom manquant ou illisible");
    confidenceScore -= 40;
  }

  if (!data.firstName || data.firstName === "Valeur Non Détectée" || data.firstName === "Unreadable") {
    errors.push("Prénom manquant ou illisible");
    confidenceScore -= 40;
  }

  // Validate phone numbers
  if (data.phone) {
    if (!validatePhone(data.phone)) {
      errors.push(`Numéro de téléphone invalide (${rawOriginal.phone ?? data.phone})`);
      confidenceScore -= 20;
    }
  }

  if (data.parentPhone) {
    if (!validatePhone(data.parentPhone)) {
      errors.push(`Téléphone parent invalide (${rawOriginal.parentPhone ?? data.parentPhone})`);
      confidenceScore -= 20;
    }
  }

  // Validate email
  if (data.email) {
    if (!EMAIL_REGEX.test(data.email)) {
      errors.push(`Format d'email invalide (${data.email})`);
      confidenceScore -= 15;
    }
  }

  // Warnings for low confidence
  if (baseConfidence < 85 && errors.length === 0) {
    warnings.push("Extrait via OCR : vérification recommandée par l'administrateur");
  }

  confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)));

  let status: RowStatus = "VALID";
  if (errors.length > 0) {
    status = "ERROR";
  } else if (warnings.length > 0 || confidenceScore < 85) {
    status = "WARNING";
  }

  const needsManualReview = status === "ERROR" || status === "WARNING" || confidenceScore < 85;

  return {
    lineIndex,
    data,
    rawOriginal,
    status,
    errors,
    warnings,
    confidenceScore,
    needsManualReview,
  };
}
