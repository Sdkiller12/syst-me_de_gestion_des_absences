import { AppError } from "./errors.js";

// Signatures binaires ("magic bytes") des formats acceptés à l'import
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // .xlsx = archive OOXML (zip)
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // .xls = Compound File Binary
const PDF = Buffer.from("%PDF-", "ascii");

function startsWith(buf: Buffer, sig: Buffer) {
  return buf.length >= sig.length && buf.subarray(0, sig.length).equals(sig);
}

/**
 * Vérifie que le contenu réel du fichier correspond à son extension,
 * pour qu'un fichier arbitraire renommé en .xlsx/.pdf soit rejeté avant parsing.
 */
export function assertFileSignature(buffer: Buffer, fileName: string) {
  const name = fileName.toLowerCase();
  let ok: boolean;
  if (name.endsWith(".xlsx")) {
    // Un zip quelconque ne suffit pas : le classeur Excel doit y figurer
    ok = startsWith(buffer, ZIP) && buffer.includes("xl/workbook");
  } else if (name.endsWith(".xls")) {
    ok = startsWith(buffer, OLE2);
  } else if (name.endsWith(".pdf")) {
    // La norme PDF tolère quelques octets avant l'en-tête
    ok = buffer.subarray(0, 1024).includes(PDF);
  } else {
    ok = false;
  }
  if (!ok) {
    throw new AppError(400, "Le contenu du fichier ne correspond pas à un fichier .xlsx, .xls ou .pdf valide.", "INVALID_FILE");
  }
}
