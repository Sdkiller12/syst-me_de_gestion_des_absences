import { prisma } from "../../config/database.js";
import { AppError, notFound, forbidden } from "../../utils/errors.js";
import { logger } from "../../config/logger.js";
import { parseExcelFile, type ParsedFileResult } from "./excel.parser.js";
import { parsePdfFile } from "./pdf.parser.js";
import { processScannedDocumentWithOcr } from "./ocr.service.js";
import { normalizeStudentData, type NormalizedStudentData } from "./normalizer.js";
import { validateStudentRow, type ValidatedStudentRow } from "./validator.js";
import { detectDuplicates } from "./duplicate-detector.js";

export interface ImportPreviewResult {
  fileName: string;
  fileType: "EXCEL" | "PDF" | "PDF_OCR";
  fileSize: number;
  classId: string;
  className: string;
  headers: string[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  warningCount: number;
  rows: ValidatedStudentRow[];
  columnMapping: {
    mappedHeaders: Record<string, string>;
    missingRequired: string[];
    fieldConfidence: Record<string, number>;
  };
  isScannedPdf?: boolean;
}

export interface ConfirmImportPayload {
  classId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  duplicateStrategy: "SKIP" | "UPDATE" | "OVERWRITE";
  rows: Array<{
    lineIndex: number;
    data: NormalizedStudentData;
    status?: string;
  }>;
}

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export const importService = {
  async previewImport(
    fileBuffer: Buffer,
    fileName: string,
    fileSize: number,
    classId: string,
    schoolId: string | null
  ): Promise<ImportPreviewResult> {
    const sid = scope(schoolId);

    if (!classId) {
      throw new AppError(400, "Veuillez sélectionner une classe avant de procéder à l'importation.", "CLASS_REQUIRED");
    }

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls || cls.schoolId !== sid) {
      throw notFound("Classe cible introuvable ou non autorisée.", "CLASS_NOT_FOUND");
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError(400, "Fichier d'importation manquant ou vide.", "FILE_EMPTY");
    }

    if (fileSize > 10 * 1024 * 1024) {
      throw new AppError(400, "Le fichier est trop volumineux (maximum 10 Mo).", "FILE_TOO_LARGE");
    }

    const lowerName = fileName.toLowerCase();
    let parsed: ParsedFileResult;

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      parsed = parseExcelFile(fileBuffer);
    } else if (lowerName.endsWith(".pdf")) {
      const pdfRes = await parsePdfFile(fileBuffer);
      if (pdfRes.isScannedPdf) {
        logger.info({ fileName }, "PDF scanné détecté. Basculement vers le moteur OCR Tesseract...");
        parsed = await processScannedDocumentWithOcr(fileBuffer);
      } else {
        parsed = pdfRes;
      }
    } else {
      throw new AppError(400, "Format de fichier non pris en charge. Utilisez .xlsx, .xls ou .pdf", "UNSUPPORTED_FORMAT");
    }

    if (parsed.mappedRows.length === 0) {
      throw new AppError(400, "Aucune donnée d'étudiant n'a pu être extraite de ce fichier.", "NO_DATA_EXTRACTED");
    }

    if (parsed.mappedRows.length > 2000) {
      throw new AppError(400, "Le fichier contient trop de lignes (maximum 2000 par import).", "TOO_MANY_ROWS");
    }

    // Process & validate each row
    let validatedRows: ValidatedStudentRow[] = parsed.mappedRows.map((rawMapped, idx) => {
      const lineIndex = idx + 2;
      const normalized = normalizeStudentData(rawMapped);
      const rawOriginal = parsed.rawRows[idx] || {};
      const baseConfidence = (parsed as { ocrConfidence?: number }).ocrConfidence ?? 100;
      return validateStudentRow(normalized, rawOriginal, lineIndex, baseConfidence);
    });

    // Detect internal and database duplicates
    validatedRows = await detectDuplicates(validatedRows, sid, classId);

    const totalRows = validatedRows.length;
    const validCount = validatedRows.filter((r) => r.status === "VALID").length;
    const invalidCount = validatedRows.filter((r) => r.status === "ERROR").length;
    const duplicateCount = validatedRows.filter((r) => r.status === "DUPLICATE").length;
    const warningCount = validatedRows.filter((r) => r.status === "WARNING").length;

    return {
      fileName,
      fileType: parsed.fileType,
      fileSize,
      classId,
      className: cls.name,
      headers: parsed.headers,
      totalRows,
      validCount,
      invalidCount,
      duplicateCount,
      warningCount,
      rows: validatedRows,
      columnMapping: parsed.columnMapping,
    };
  },

  async confirmImport(
    payload: ConfirmImportPayload,
    schoolId: string | null,
    userId: string | null
  ) {
    const sid = scope(schoolId);

    const { classId, fileName, fileType, fileSize, duplicateStrategy, rows } = payload;

    if (!classId) throw new AppError(400, "classId requis.", "VALIDATION_ERROR");
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls || cls.schoolId !== sid) throw notFound("Classe introuvable.", "CLASS_NOT_FOUND");

    if (!rows || rows.length === 0) {
      throw new AppError(400, "Aucun étudiant à importer.", "VALIDATION_ERROR");
    }

    let insertedRows = 0;
    let updatedRows = 0;
    let duplicateSkipped = 0;
    let rejectedRows = 0;
    const reportErrors: Array<{ line: number; message: string }> = [];

    // Execute atomic PostgreSQL database transaction
    await prisma.$transaction(async (tx) => {
      for (const rowItem of rows) {
        const line = rowItem.lineIndex;
        const normalized = normalizeStudentData(rowItem.data as unknown as Record<string, unknown>);

        // Validate strictly before inserting
        if (!normalized.lastName || !normalized.firstName) {
          rejectedRows++;
          reportErrors.push({ line, message: "Nom ou prénom manquant" });
          continue;
        }

        // Check DB duplicate
        let existingStudent = null;
        if (normalized.studentNumber) {
          existingStudent = await tx.student.findUnique({
            where: { schoolId_studentNumber: { schoolId: sid, studentNumber: normalized.studentNumber } },
          }).catch(() => null);
        }

        if (!existingStudent) {
          existingStudent = await tx.student.findFirst({
            where: {
              schoolId: sid,
              classId,
              lastName: { equals: normalized.lastName, mode: "insensitive" },
              firstName: { equals: normalized.firstName, mode: "insensitive" },
            },
          });
        }

        if (existingStudent) {
          if (duplicateStrategy === "SKIP") {
            duplicateSkipped++;
            continue;
          } else if (duplicateStrategy === "UPDATE" || duplicateStrategy === "OVERWRITE") {
            await tx.student.update({
              where: { id: existingStudent.id },
              data: {
                firstName: normalized.firstName,
                lastName: normalized.lastName,
                phone: normalized.phone || existingStudent.phone,
                studentNumber: normalized.studentNumber || existingStudent.studentNumber,
                parentName: normalized.parentName || existingStudent.parentName,
                parentPhone: normalized.parentPhone || existingStudent.parentPhone,
                email: normalized.email || existingStudent.email,
                classId,
              },
            });
            updatedRows++;
            continue;
          }
        }

        // Insert new student record into PostgreSQL
        await tx.student.create({
          data: {
            schoolId: sid,
            classId,
            firstName: normalized.firstName,
            lastName: normalized.lastName,
            studentNumber: normalized.studentNumber || null,
            phone: normalized.phone || "",
            parentName: normalized.parentName || null,
            parentPhone: normalized.parentPhone || null,
            email: normalized.email || null,
          },
        });
        insertedRows++;
      }

      // Log StudentImport audit history record
      await tx.studentImport.create({
        data: {
          schoolId: sid,
          userId: userId || null,
          fileName: fileName || "import_etudiants.file",
          fileType: fileType || "UNKNOWN",
          fileSize: fileSize || 0,
          totalRows: rows.length,
          validRows: insertedRows + updatedRows,
          invalidRows: rejectedRows,
          duplicates: duplicateSkipped,
          insertedRows,
          updatedRows,
          status: "COMPLETED",
          completedAt: new Date(),
          reportData: {
            className: cls.name,
            duplicateStrategy,
            errors: reportErrors,
          },
        },
      });
    });

    logger.info(
      { classId, total: rows.length, insertedRows, updatedRows, duplicateSkipped, rejectedRows },
      "Importation réelle d'étudiants terminée avec succès"
    );

    return {
      success: true,
      totalAnalyzed: rows.length,
      insertedRows,
      updatedRows,
      duplicateSkipped,
      rejectedRows,
      className: cls.name,
      errors: reportErrors,
    };
  },

  async getImportHistory(schoolId: string | null) {
    const sid = scope(schoolId);
    const history = await prisma.studentImport.findMany({
      where: { schoolId: sid },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return history;
  },

  async getImportReport(importId: string, schoolId: string | null) {
    const sid = scope(schoolId);
    const item = await prisma.studentImport.findUnique({
      where: { id: importId },
    });
    if (!item || item.schoolId !== sid) {
      throw notFound("Rapport d'importation introuvable.", "IMPORT_NOT_FOUND");
    }
    return item;
  },
};
