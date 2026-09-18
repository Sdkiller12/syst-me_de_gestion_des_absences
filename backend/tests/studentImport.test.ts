import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detectColumns } from "../src/services/import/column-mapper.js";
import { normalizeStudentData } from "../src/services/import/normalizer.js";
import { validateStudentRow } from "../src/services/import/validator.js";
import { parseExcelFile } from "../src/services/import/excel.parser.js";
import { parsePdfFile } from "../src/services/import/pdf.parser.js";

describe("Student Import System Unit Tests", () => {
  describe("detectColumns", () => {
    it("détecte correctement les synonymes et variations de nom de colonnes en français et anglais", () => {
      const headers = ["Matricule", "NOM", "Prénom", "Contact", "Contact Parent", "Courriel"];
      const result = detectColumns(headers);

      expect(result.mappedHeaders["NOM"]).toBe("lastName");
      expect(result.mappedHeaders["Prénom"]).toBe("firstName");
      expect(result.mappedHeaders["Matricule"]).toBe("studentNumber");
      expect(result.mappedHeaders["Contact"]).toBe("phone");
      expect(result.mappedHeaders["Contact Parent"]).toBe("parentPhone");
      expect(result.mappedHeaders["Courriel"]).toBe("email");
      expect(result.missingRequired.length).toBe(0);
    });

    it("détecte l'absence de colonnes obligatoires (Nom/Prénom)", () => {
      const headers = ["Matricule", "Téléphone"];
      const result = detectColumns(headers);

      expect(result.missingRequired).toContain("lastName");
      expect(result.missingRequired).toContain("firstName");
    });
  });

  describe("normalizeStudentData", () => {
    it("met en majuscules le nom, applique la casse au prénom et nettoie les espaces", () => {
      const raw = {
        lastName: "  kouassi  ",
        firstName: "jean - paul",
        phone: "07 00 00 00 00",
        email: "  JEAN@EXAMPLE.COM ",
      };
      const normalized = normalizeStudentData(raw);

      expect(normalized.lastName).toBe("KOUASSI");
      expect(normalized.firstName).toBe("Jean - Paul");
      expect(normalized.email).toBe("jean@example.com");
      expect(normalized.phone).toMatch(/^\+225/);
    });
  });

  describe("validateStudentRow", () => {
    it("valide une ligne correcte", () => {
      const data = {
        firstName: "Jean",
        lastName: "KOUASSI",
        studentNumber: "20260001",
        phone: "+2250700000000",
        parentPhone: "+2250500000000",
        parentName: "Kouassi Sr",
        email: "jean@example.com",
        className: "L2 Réseaux",
      };
      const result = validateStudentRow(data, {}, 2);

      expect(result.status).toBe("VALID");
      expect(result.errors.length).toBe(0);
      expect(result.confidenceScore).toBe(100);
    });

    it("signale une erreur si le nom ou le prénom est manquant", () => {
      const data = {
        firstName: "",
        lastName: "VALEUR NON DÉTECTÉE",
        studentNumber: null,
        phone: "",
        parentPhone: null,
        parentName: null,
        email: null,
        className: null,
      };
      const result = validateStudentRow(data, {}, 2);

      expect(result.status).toBe("ERROR");
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("parseExcelFile", () => {
    it("extrait correctement les données à partir d'un fichier Excel réel généré en mémoire", () => {
      const rowsData = [
        { "Nom de famille": "TRAORE", "First Name": "Aminata", "ID": "20260002", "Mobile": "0500000000" },
        { "Nom de famille": "KONE", "First Name": "Ibrahim", "ID": "20260003", "Mobile": "0700000000" },
      ];

      const ws = XLSX.utils.json_to_sheet(rowsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Etudiants");
      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const parsed = parseExcelFile(excelBuffer);

      expect(parsed.fileType).toBe("EXCEL");
      expect(parsed.mappedRows.length).toBe(2);
      expect(parsed.mappedRows[0].lastName).toBe("TRAORE");
      expect(parsed.mappedRows[0].firstName).toBe("Aminata");
      expect(parsed.mappedRows[0].studentNumber).toBe("20260002");
    });
  });
});
