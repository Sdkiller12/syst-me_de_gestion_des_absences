import { createWorker } from "tesseract.js";
import { logger } from "../../config/logger.js";
import { detectColumns } from "./column-mapper.js";
import type { ParsedFileResult } from "./excel.parser.js";

export interface OcrResult extends ParsedFileResult {
  ocrConfidence: number;
}

export async function processScannedDocumentWithOcr(buffer: Buffer): Promise<OcrResult> {
  let worker;
  try {
    worker = await createWorker("fra+eng");
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    const text = data.text ? data.text.trim() : "";
    const overallConfidence = data.confidence || 70;

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const headers = ["Matricule", "Nom", "Prénom", "Téléphone", "Téléphone parent", "Email"];
    const columnMapping = detectColumns(headers);

    const rawRows: Array<Record<string, unknown>> = [];
    const mappedRows: Array<Record<string, unknown>> = [];

    for (const line of lines) {
      if (/^(liste|classe|école|etablissement|page|total)/i.test(line)) continue;

      const cells = line.split(/\s{2,}|[|;,]/).map((c) => c.trim());
      if (cells.length < 2) continue;

      const rawObj: Record<string, unknown> = {};
      const mappedObj: Record<string, unknown> = {};

      cells.forEach((cell, idx) => {
        const headerName = headers[idx] || `Col_${idx + 1}`;
        rawObj[headerName] = cell;
      });

      // Heuristic parsing for OCR extracted text lines
      if (/^\d{6,}$/.test(cells[0])) {
        mappedObj.studentNumber = cells[0];
        mappedObj.lastName = cells[1] || "VALEUR NON DÉTECTÉE";
        mappedObj.firstName = cells[2] || "Valeur Non Détectée";
        mappedObj.phone = cells[3] || "";
      } else {
        mappedObj.lastName = cells[0] || "VALEUR NON DÉTECTÉE";
        mappedObj.firstName = cells[1] || "Valeur Non Détectée";
        if (cells[2]) {
          if (/^\d{8,}$/.test(cells[2].replace(/\s/g, ""))) {
            mappedObj.phone = cells[2];
          } else {
            mappedObj.studentNumber = cells[2];
          }
        }
        if (cells[3] && !mappedObj.phone) {
          mappedObj.phone = cells[3];
        }
      }

      if (mappedObj.lastName || mappedObj.firstName) {
        rawRows.push(rawObj);
        mappedRows.push(mappedObj);
      }
    }

    return {
      headers,
      rawRows,
      mappedRows,
      columnMapping,
      fileType: "PDF_OCR",
      ocrConfidence: Math.round(overallConfidence),
    };
  } catch (error) {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
    logger.error({ error }, "Erreur lors du traitement OCR Tesseract");
    return {
      headers: ["Matricule", "Nom", "Prénom", "Téléphone"],
      rawRows: [],
      mappedRows: [],
      columnMapping: { mappedHeaders: {}, missingRequired: ["lastName", "firstName"], fieldConfidence: {} },
      fileType: "PDF_OCR",
      ocrConfidence: 0,
    };
  }
}
