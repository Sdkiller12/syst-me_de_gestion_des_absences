import * as XLSX from "xlsx";
import { AppError } from "../../utils/errors.js";
import { detectColumns, type ColumnMappingResult } from "./column-mapper.js";

export interface ParsedFileResult {
  headers: string[];
  rawRows: Array<Record<string, unknown>>;
  mappedRows: Array<Record<string, unknown>>;
  columnMapping: ColumnMappingResult;
  fileType: "EXCEL" | "PDF" | "PDF_OCR";
}

export function parseExcelFile(buffer: Buffer): ParsedFileResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new AppError(400, "Fichier Excel corrompu ou illisible.", "INVALID_EXCEL");
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new AppError(400, "Le fichier Excel ne contient aucune feuille.", "EMPTY_EXCEL");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (jsonRows.length === 0) {
    throw new AppError(400, "Le fichier Excel est vide ou ne contient aucune donnée.", "EMPTY_EXCEL");
  }

  // Extract raw column headers from first row keys
  const headers = Object.keys(jsonRows[0] || {});
  const columnMapping = detectColumns(headers);

  // Map raw row fields to standard field keys
  const mappedRows = jsonRows.map((row) => {
    const mappedObj: Record<string, unknown> = {};
    for (const [rawKey, val] of Object.entries(row)) {
      const standardField = columnMapping.mappedHeaders[rawKey];
      if (standardField) {
        mappedObj[standardField] = String(val ?? "").trim();
      } else {
        mappedObj[rawKey] = val;
      }
    }
    return mappedObj;
  });

  return {
    headers,
    rawRows: jsonRows,
    mappedRows,
    columnMapping,
    fileType: "EXCEL",
  };
}
