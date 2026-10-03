/**
 * Génère un vrai PDF texte (police Helvetica, encodage WinAnsi) contenant un tableau :
 * chaque cellule est un objet texte positionné, comme dans un PDF exporté par un tableur.
 */
export function buildTablePdf(rows: string[][], colWidth = 130): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const ops: string[] = ["BT", "/F1 10 Tf"];
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) ops.push(`1 0 0 1 ${40 + c * colWidth} ${550 - r * 18} Tm (${esc(cell)}) Tj`);
    });
  });
  ops.push("ET");
  const content = Buffer.from(ops.join("\n"), "latin1");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null, // flux de contenu
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [];
  let size = parts[0].length;
  objects.forEach((obj, i) => {
    offsets.push(size);
    const chunk =
      obj === null
        ? Buffer.concat([
            Buffer.from(`${i + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n`, "latin1"),
            content,
            Buffer.from("\nendstream\nendobj\n", "latin1"),
          ])
        : Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, "latin1");
    parts.push(chunk);
    size += chunk.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}

/**
 * Génère un PDF "scanné" : le tableau est dessiné dans une image JPEG, sans aucun texte
 * sélectionnable. Seul l'OCR peut le lire.
 */
export async function buildScannedPdf(rows: string[][], colWidth = 300): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const width = 1700;
  const height = 1000;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.font = "36px sans-serif";
  rows.forEach((row, r) => row.forEach((cell, c) => ctx.fillText(cell, 60 + c * colWidth, 90 + r * 70)));
  const jpeg = Buffer.from(await canvas.encode("jpeg", 95));

  const pageW = 842;
  const pageH = Math.round((height / width) * pageW);
  const content = Buffer.from(`q ${pageW} 0 0 ${pageH} 0 0 cm /Im1 Do Q`, "latin1");
  const objects: Array<Buffer> = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>`, "latin1"),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream", "latin1")]),
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "latin1"),
      jpeg,
      Buffer.from("\nendstream", "latin1"),
    ]),
  ];
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [];
  let size = parts[0].length;
  objects.forEach((obj, i) => {
    offsets.push(size);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), obj, Buffer.from("\nendobj\n", "latin1")]);
    parts.push(chunk);
    size += chunk.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}
