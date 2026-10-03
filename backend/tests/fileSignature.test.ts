import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { assertFileSignature } from "../src/utils/fileSignature.js";

function realXlsx(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nom: "KONE" }]), "Feuille1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("assertFileSignature", () => {
  it("accepte un vrai classeur .xlsx", () => {
    expect(() => assertFileSignature(realXlsx(), "eleves.xlsx")).not.toThrow();
  });

  it("accepte un vrai .xls (en-tête OLE2)", () => {
    const xls = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64)]);
    expect(() => assertFileSignature(xls, "eleves.XLS")).not.toThrow();
  });

  it("accepte un PDF", () => {
    expect(() => assertFileSignature(Buffer.from("%PDF-1.7\n..."), "liste.pdf")).not.toThrow();
  });

  it("rejette un exécutable renommé en .xlsx", () => {
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);
    expect(() => assertFileSignature(exe, "eleves.xlsx")).toThrow(/ne correspond pas/);
  });

  it("rejette un zip qui n'est pas un classeur Excel", () => {
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("payload/evil.js")]);
    expect(() => assertFileSignature(zip, "eleves.xlsx")).toThrow();
  });

  it("rejette un PDF déguisé en .xls et une extension inconnue", () => {
    expect(() => assertFileSignature(Buffer.from("%PDF-1.7"), "eleves.xls")).toThrow();
    expect(() => assertFileSignature(Buffer.from("a,b,c"), "eleves.csv")).toThrow();
  });
});
