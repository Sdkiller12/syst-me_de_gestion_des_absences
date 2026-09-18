import { api, unwrap, unwrapPaginated } from "./api";
import type { ImportReport, Student } from "../types";
import type { Paginated } from "./api";

export interface PreviewImportResult {
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
  rows: Array<{
    lineIndex: number;
    data: {
      firstName: string;
      lastName: string;
      studentNumber: string | null;
      phone: string;
      parentPhone: string | null;
      parentName: string | null;
      email: string | null;
      className: string | null;
    };
    rawOriginal: Record<string, unknown>;
    status: "VALID" | "ERROR" | "WARNING" | "DUPLICATE";
    errors: string[];
    warnings: string[];
    confidenceScore: number;
    isDuplicateInternal?: boolean;
    isDuplicateDb?: boolean;
    duplicateInfo?: string;
    needsManualReview?: boolean;
  }>;
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
    data: {
      firstName: string;
      lastName: string;
      studentNumber?: string | null;
      phone?: string;
      parentPhone?: string | null;
      parentName?: string | null;
      email?: string | null;
    };
  }>;
}

export interface ImportResultSummary {
  success: boolean;
  totalAnalyzed: number;
  insertedRows: number;
  updatedRows: number;
  duplicateSkipped: number;
  rejectedRows: number;
  className: string;
  errors: Array<{ line: number; message: string }>;
}

export interface ImportHistoryRecord {
  id: string;
  schoolId: string;
  userId: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  insertedRows: number;
  updatedRows: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export const studentService = {
  async list(params?: { search?: string; classId?: string; page?: number; limit?: number }): Promise<Student[]> {
    const res = await api.get("/students", { params: { ...params, limit: params?.limit ?? 100 } });
    return unwrapPaginated<Student>(res).data;
  },

  async listPaginated(params?: { search?: string; classId?: string; page?: number; limit?: number }): Promise<Paginated<Student>> {
    const res = await api.get("/students", { params });
    return unwrapPaginated<Student>(res);
  },

  async get(id: string): Promise<Student> {
    const res = await api.get(`/students/${id}`);
    return unwrap<Student>(res);
  },

  async create(payload: { firstName: string; lastName: string; phone?: string; classId: string; studentNumber?: string; parentName?: string; parentPhone?: string; email?: string }): Promise<Student> {
    const res = await api.post("/students", payload);
    return unwrap<Student>(res);
  },

  async update(id: string, payload: Partial<{ firstName: string; lastName: string; phone: string; classId: string; studentNumber: string; parentName: string; parentPhone: string; email: string }>): Promise<Student> {
    const res = await api.patch(`/students/${id}`, payload);
    return unwrap<Student>(res);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/students/${id}`);
  },

  /** Prévisualisation d'import (sans écriture en BDD) */
  async previewImport(classId: string, file: File): Promise<PreviewImportResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("classId", classId);
    const res = await api.post(`/students/import/preview`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90000,
    });
    return unwrap<PreviewImportResult>(res);
  },

  /** Confirmation & Insertion réelle en base PostgreSQL */
  async confirmImport(payload: ConfirmImportPayload): Promise<ImportResultSummary> {
    const res = await api.post(`/students/import/confirm`, payload, {
      timeout: 90000,
    });
    return unwrap<ImportResultSummary>(res);
  },

  /** Historique des imports de l'école */
  async getImportHistory(): Promise<ImportHistoryRecord[]> {
    const res = await api.get(`/students/import/history`);
    return unwrap<ImportHistoryRecord[]>(res);
  },

  /** Rapport d'importation Excel */
  getExportReportUrl(importId: string): string {
    const token = localStorage.getItem("token") ?? "";
    return `${api.defaults.baseURL}/students/import/export-report/${importId}?token=${encodeURIComponent(token)}`;
  },

  /** Compatibilité import direct */
  async importFile(classId: string, file: File): Promise<ImportReport> {
    const preview = await this.previewImport(classId, file);
    const confirmRes = await this.confirmImport({
      classId,
      fileName: preview.fileName,
      fileType: preview.fileType,
      fileSize: preview.fileSize,
      duplicateStrategy: "SKIP",
      rows: preview.rows.map((r) => ({ lineIndex: r.lineIndex, data: r.data })),
    });
    return {
      analyzed: confirmRes.totalAnalyzed,
      imported: confirmRes.insertedRows,
      duplicates: confirmRes.duplicateSkipped,
      invalid: confirmRes.rejectedRows,
      failed: confirmRes.rejectedRows,
      errors: confirmRes.errors.map((e) => ({ row: e.line, message: e.message })),
    };
  },
};
