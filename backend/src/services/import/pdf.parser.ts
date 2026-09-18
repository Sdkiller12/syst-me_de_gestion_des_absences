import pdfParse from "pdf-parse";
import { AppError } from "../../utils/errors";
import { detectColumns } from "./column-mapper";
import type { ParsedFileResult } from "./excel.parser";

export interface PdfParseResult extends ParsedFileResult {
  isScannedPdf?: boolean;
  pageCount?: number;
}

export async function parsePdfFile(buffer: Buffer): Promise<PdfParseResult> {
  let pdfData: { text: string; numpages: number };
  try {
    // pdf-parse fallback invocation
    const parse = typeof pdfParse === "function" ? pdfParse : (pdfParse as unknown as { default: (b: Buffer) => Promise<{ text: string; numpages: number }> }).default;
    pdfData = await parse(buffer);
  } catch {
    throw new AppError(400, "Impossible de lire le fichier PDF. Il est peut-être corrompu.", "INVALID_PDF");
  }

  const rawText = pdfData.text ? pdfData.text.trim() : "";
  const pageCount = pdfData.numpages || 1;

  // If minimal or no text extracted, flag as scanned PDF for OCR processing
  if (!rawText || rawText.length < 15 || rawText.replace(/\s/g, "").length < 10) {
    return {
      headers: [],
      rawRows: [],
      mappedRows: [],
      columnMapping: { mappedHeaders: {}, missingRequired: ["lastName", "firstName"], fieldConfidence: {} },
      fileType: "PDF_OCR",
      isScannedPdf: true,
      pageCount,
    };
  }

  // Split lines and filter empty ones
  const lines: string[] = rawText
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      rawRows: [],
      mappedRows: [],
      columnMapping: { mappedHeaders: {}, missingRequired: ["lastName", "firstName"], fieldConfidence: {} },
      fileType: "PDF_OCR",
      isScannedPdf: true,
      pageCount,
    };
  }

  // Try to find header line in top 15 lines
  let headerLineIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const l = lines[i];
    const lower = l.toLowerCase();
    if (lower.includes("nom") || lower.includes("prenom") || lower.includes("prénom") || lower.includes("matricule")) {
      headerLineIndex = i;
      // Split header by pipe, tab, semicolon, comma or multiple spaces
      headers = l.includes("|")
        ? l.split("|").map((h: string) => h.trim())
        : l.includes(";")
        ? l.split(";").map((h: string) => h.trim())
        : l.includes("\t")
        ? l.split("\t").map((h: string) => h.trim())
        : l.split(/\s{2,}/).map((h: string) => h.trim());
      break;
    }
  }

  // Fallback headers if no explicit header line found
  if (headers.length === 0) {
    headers = ["Matricule", "Nom", "Prénom", "Téléphone", "Téléphone parent", "Email"];
  }

  const columnMapping = detectColumns(headers);

  const rawRows: Array<Record<string, unknown>> = [];
  const mappedRows: Array<Record<string, unknown>> = [];

  const startIndex = headerLineIndex >= 0 ? headerLineIndex + 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    // Ignore total lines, footer lines, or page header lines
    if (/^(page|total|liste|classe|école|etablissement|année)/i.test(line)) continue;

    // Split line into cells
    let cells: string[] = [];
    if (line.includes("|")) {
      cells = line.split("|").map((c: string) => c.trim());
    } else if (line.includes(";")) {
      cells = line.split(";").map((c: string) => c.trim());
    } else if (line.includes("\t")) {
      cells = line.split("\t").map((c: string) => c.trim());
    } else {
      cells = line.split(/\s{2,}/).map((c: string) => c.trim());
      if (cells.length < 2) {
        // Fallback space split
        cells = line.split(/\s+/).map((c: string) => c.trim());
      }
    }

    // Filter out row index (e.g. "01", "1", "N°")
    if (cells.length > 0 && /^\d{1,3}$/.test(cells[0])) {
      cells.shift();
    }

    if (cells.length < 2) continue; // Skip lines with insufficient columns

    const rawObj: Record<string, unknown> = {};
    const mappedObj: Record<string, unknown> = {};

    cells.forEach((cellVal: string, colIdx: number) => {
      const headerName = headers[colIdx] || `Col_${colIdx + 1}`;
      rawObj[headerName] = cellVal;

      const stdField = columnMapping.mappedHeaders[headerName];
      if (stdField) {
        mappedObj[stdField] = cellVal;
      }
    });

    // Heuristic assignment if column mapping is incomplete
    if (!mappedObj.lastName && !mappedObj.firstName) {
      if (cells.length >= 4) {
        if (/^\d+$/.test(cells[0])) {
          mappedObj.studentNumber = cells[0];
          mappedObj.lastName = cells[1];
          mappedObj.firstName = cells[2];
          mappedObj.phone = cells[3];
        } else {
          mappedObj.lastName = cells[0];
          mappedObj.firstName = cells[1];
          mappedObj.studentNumber = cells[2];
          mappedObj.phone = cells[3];
        }
      } else if (cells.length >= 2) {
        mappedObj.lastName = cells[0];
        mappedObj.firstName = cells[1];
        if (cells[2]) mappedObj.phone = cells[2];
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
    fileType: "PDF",
    isScannedPdf: false,
    pageCount,
  };
}
