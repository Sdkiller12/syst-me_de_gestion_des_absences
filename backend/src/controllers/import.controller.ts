import type { NextFunction, Response } from "express";
import * as XLSX from "xlsx";
import { importService } from "../services/import/import.service.js";
import type { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";

export const importController = {
  async preview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const file = (req as unknown as { file?: Express.Multer.File }).file;
      if (!file) {
        throw new AppError(400, "Veuillez sélectionner un fichier (.xlsx, .xls ou .pdf)", "VALIDATION_ERROR");
      }

      const classId = (req.body?.classId as string) || (req.query?.classId as string) || "";
      const result = await importService.previewImport(
        file.buffer,
        file.originalname,
        file.size,
        classId,
        req.user!.schoolId
      );

      return res.json({ success: true, data: result });
    } catch (e) {
      return next(e);
    }
  },

  async confirm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payload = req.body;
      const result = await importService.confirmImport(
        payload,
        req.user!.schoolId,
        req.user!.id
      );

      await audit(req, "IMPORT", "Student", payload.classId, {
        inserted: result.insertedRows,
        updated: result.updatedRows,
        skipped: result.duplicateSkipped,
      });

      return res.json({ success: true, data: result });
    } catch (e) {
      return next(e);
    }
  },

  async history(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const history = await importService.getImportHistory(req.user!.schoolId);
      return res.json({ success: true, data: history });
    } catch (e) {
      return next(e);
    }
  },

  async exportReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const importId = req.params.id as string;
      const report = await importService.getImportReport(importId, req.user!.schoolId);

      const wb = XLSX.utils.book_new();
      const summaryData = [
        { Paramètre: "ID d'import", Valeur: report.id },
        { Paramètre: "Fichier", Valeur: report.fileName },
        { Paramètre: "Type", Valeur: report.fileType },
        { Paramètre: "Date", Valeur: report.createdAt.toISOString() },
        { Paramètre: "Total Lignes", Valeur: report.totalRows },
        { Paramètre: "Étudiants Ajoutés", Valeur: report.insertedRows },
        { Paramètre: "Étudiants Mis à jour", Valeur: report.updatedRows },
        { Paramètre: "Doublons Ignorés", Valeur: report.duplicates },
        { Paramètre: "Lignes Rejetées", Valeur: report.invalidRows },
      ];

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Résumé Import");

      const reportBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=rapport-import-${report.id.slice(-6)}.xlsx`);
      return res.send(reportBuffer);
    } catch (e) {
      return next(e);
    }
  },
};
