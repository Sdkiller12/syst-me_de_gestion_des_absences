import os from "os";
import path from "path";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import { AppError } from "../../utils/errors.js";
import { logger } from "../../config/logger.js";

/**
 * Extraction générique d'un tableau (lignes × cellules) depuis Excel, PDF texte ou PDF scanné.
 * Aucune valeur n'est inventée : une cellule illisible reste vide, une lecture OCR douteuse
 * est signalée, et la validation métier se charge du reste.
 */

export type TabularSource = "EXCEL" | "PDF" | "PDF_OCR";

export interface Cell {
  text: string;
  /** Position horizontale (PDF/OCR) : sert à rattacher la cellule à la bonne colonne */
  x?: number;
  xEnd?: number;
  /** Confiance OCR 0-100 (PDF scanné uniquement) */
  confidence?: number;
}

export interface ExtractedTable {
  source: TabularSource;
  rows: Cell[][];
  /** Confiance moyenne de l'OCR (0-100), uniquement pour les PDF scannés */
  ocrConfidence?: number;
  pageCount?: number;
}

/** En dessous de ce score, un mot lu par OCR est signalé comme à vérifier */
export const OCR_UNCERTAIN_BELOW = 60;
const MAX_OCR_PAGES = 15;

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const nonEmpty = (row: Cell[]) => row.some((c) => c.text !== "");

// ─── Reconstruction positionnelle (PDF texte et OCR) ─────────────────────────

interface PositionedItem {
  str: string;
  x: number;
  /** Axe vertical orienté vers le bas (haut de page = 0) */
  y: number;
  w: number;
  h: number;
  confidence?: number;
}

/**
 * Regroupe des fragments positionnés en lignes (même hauteur) puis en cellules
 * (écart horizontal supérieur à ~une largeur de caractère).
 */
function itemsToRows(items: PositionedItem[]): Cell[][] {
  const sorted = items.filter((i) => i.str.trim() !== "").sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PositionedItem[][] = [];
  for (const it of sorted) {
    const line = lines[lines.length - 1];
    const ref = line?.[0];
    if (ref && Math.abs(it.y - ref.y) <= Math.max(2, Math.min(it.h, ref.h) * 0.5)) line.push(it);
    else lines.push([it]);
  }
  return lines.map((line) => {
    const byX = line.sort((a, b) => a.x - b.x);
    const cells: Array<Cell & { parts: number[] }> = [];
    for (const it of byX) {
      const last = cells[cells.length - 1];
      const gap = last ? it.x - (last.xEnd ?? it.x) : Infinity;
      // Un espace entre deux mots d'une même cellule fait ~0.3 em ; une colonne, bien plus
      if (last && gap <= Math.max(3, it.h * 0.8)) {
        last.text = clean(`${last.text} ${it.str}`);
        last.xEnd = it.x + it.w;
        if (it.confidence !== undefined) last.parts.push(it.confidence);
      } else {
        cells.push({ text: clean(it.str), x: it.x, xEnd: it.x + it.w, parts: it.confidence !== undefined ? [it.confidence] : [] });
      }
    }
    return cells.map(({ parts, ...c }) => (parts.length ? { ...c, confidence: Math.min(...parts) } : c));
  });
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(p: { scale: number }): { height: number };
    getTextContent(): Promise<{ items: Array<PdfTextItem | { type: string }> }>;
  }>;
}

/** Fragments de texte positionnés via pdf.js (document chargé par pdf-parse) */
async function pdfTextRows(parser: PDFParse): Promise<{ rows: Cell[][]; pages: number } | null> {
  const load = (parser as unknown as { load?: () => Promise<PdfDocument> }).load;
  if (typeof load !== "function") return null;
  const doc = await load.call(parser);
  const rows: Cell[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();
    const items = content.items
      .filter((i): i is PdfTextItem => "str" in i)
      .map((i) => ({
        str: i.str,
        x: i.transform[4],
        y: height - i.transform[5],
        w: i.width,
        h: i.height || Math.abs(i.transform[3]) || 10,
      }));
    rows.push(...itemsToRows(items));
  }
  return { rows, pages: doc.numPages };
}

async function ocrRows(images: Uint8Array[]): Promise<{ rows: Cell[][]; confidence: number }> {
  // Données de langue mises en cache hors du projet (téléchargées au premier usage)
  const worker = await createWorker("fra+eng", 1, { cachePath: path.join(os.tmpdir(), "tesseract-cache") });
  try {
    const rows: Cell[][] = [];
    let confidenceSum = 0;
    for (const img of images) {
      const { data } = await worker.recognize(Buffer.from(img), {}, { blocks: true });
      confidenceSum += data.confidence ?? 0;
      const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
      rows.push(
        ...itemsToRows(
          words.map((w) => ({
            str: w.text,
            x: w.bbox.x0,
            y: (w.bbox.y0 + w.bbox.y1) / 2,
            w: w.bbox.x1 - w.bbox.x0,
            h: w.bbox.y1 - w.bbox.y0,
            confidence: w.confidence,
          })),
        ),
      );
    }
    return { rows, confidence: images.length ? Math.round(confidenceSum / images.length) : 0 };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

// ─── Sources ─────────────────────────────────────────────────────────────────

function fromExcel(buffer: Buffer): ExtractedTable {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new AppError(400, "Fichier Excel corrompu ou illisible.", "INVALID_EXCEL");
  }
  const sheet = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined;
  if (!sheet) throw new AppError(400, "Le fichier Excel ne contient aucune feuille.", "EMPTY_FILE");
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  return { source: "EXCEL", rows: raw.map((r) => r.map((v) => ({ text: clean(v) }))).filter(nonEmpty) };
}

async function fromPdf(buffer: Buffer): Promise<ExtractedTable> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    // 1. Tableaux tracés (grilles vectorielles) : la structure la plus fiable
    try {
      const tables = await parser.getTable();
      const rows = tables.pages
        .flatMap((p) => p.tables)
        .flatMap((t) => t.map((r) => r.map((v) => ({ text: clean(v) }))))
        .filter(nonEmpty);
      if (rows.length >= 2) return { source: "PDF", rows, pageCount: tables.total };
    } catch (e) {
      logger.debug({ err: e }, "Détection de tableaux PDF impossible, repli sur le texte positionné");
    }

    // 2. Texte positionné : lignes et colonnes reconstruites depuis les coordonnées
    const positioned = await pdfTextRows(parser);
    const textLength = positioned?.rows.flat().reduce((n, c) => n + c.text.replace(/\s/g, "").length, 0) ?? 0;
    if (positioned && textLength >= 20) return { source: "PDF", rows: positioned.rows, pageCount: positioned.pages };

    // 3. PDF scanné : rendu des pages en images puis OCR avec positions des mots
    const shots = await parser.getScreenshot({ scale: 2, imageBuffer: true, imageDataUrl: false, last: MAX_OCR_PAGES });
    const images = shots.pages.map((p) => p.data).filter((d): d is Uint8Array => !!d && d.length > 0);
    if (images.length === 0) throw new AppError(400, "Aucune page lisible dans ce PDF.", "PDF_UNREADABLE");
    const ocr = await ocrRows(images);
    return { source: "PDF_OCR", rows: ocr.rows.filter(nonEmpty), ocrConfidence: ocr.confidence, pageCount: shots.total };
  } catch (e) {
    if (e instanceof AppError) throw e;
    logger.warn({ err: e }, "Lecture PDF impossible");
    throw new AppError(400, "Impossible de lire ce PDF. Il est peut-être protégé ou corrompu.", "INVALID_PDF");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function extractTable(buffer: Buffer, fileName: string): Promise<ExtractedTable> {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return fromExcel(buffer);
  if (name.endsWith(".pdf")) return fromPdf(buffer);
  throw new AppError(400, "Format non pris en charge. Utilisez .xlsx, .xls ou .pdf", "UNSUPPORTED_FORMAT");
}

// ─── Reconnaissance des en-têtes ─────────────────────────────────────────────

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Associe chaque colonne à un champ. Score : égalité exacte (1), l'en-tête commence par
 * l'alias (0.9), l'alias apparaît comme mot entier (0.8). "Prénom" ne correspond donc pas à "nom".
 * Les meilleures correspondances sont attribuées en premier, un champ n'est pris qu'une fois.
 */
export function matchHeaders(headers: string[], aliases: Record<string, string[]>): Record<number, string> {
  const candidates: Array<{ col: number; field: string; score: number }> = [];
  headers.forEach((raw, col) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    for (const [field, list] of Object.entries(aliases)) {
      let best = 0;
      for (const alias of list.map(normalizeHeader)) {
        if (h === alias) best = Math.max(best, 1);
        else if (h.startsWith(`${alias} `)) best = Math.max(best, 0.9);
        else if (` ${h} `.includes(` ${alias} `)) best = Math.max(best, 0.8);
      }
      if (best > 0) candidates.push({ col, field, score: best });
    }
  });
  candidates.sort((a, b) => b.score - a.score);
  const byCol: Record<number, string> = {};
  const usedFields = new Set<string>();
  for (const c of candidates) {
    if (byCol[c.col] || usedFields.has(c.field)) continue;
    byCol[c.col] = c.field;
    usedFields.add(c.field);
  }
  return byCol;
}

/**
 * Rattache chaque cellule positionnée à la colonne d'en-tête la plus proche (bord gauche ou
 * centre) : une cellule vide ne décale donc pas les colonnes suivantes.
 */
function alignToHeader(cells: Cell[], header: Cell[]): Array<Cell | undefined> {
  const out: Array<Cell | undefined> = new Array(header.length).fill(undefined);
  for (const cell of cells) {
    if (cell.x === undefined) continue;
    const center = (cell.x + (cell.xEnd ?? cell.x)) / 2;
    let best = -1;
    let bestDist = Infinity;
    header.forEach((h, i) => {
      if (h.x === undefined) return;
      const hCenter = (h.x + (h.xEnd ?? h.x)) / 2;
      const d = Math.min(Math.abs(cell.x! - h.x), Math.abs(center - hCenter));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best < 0) continue;
    const prev = out[best];
    out[best] = prev ? { ...prev, text: clean(`${prev.text} ${cell.text}`), confidence: Math.min(prev.confidence ?? 100, cell.confidence ?? 100) } : cell;
  }
  return out;
}

export interface MappedTable {
  /** Colonne du fichier → champ reconnu */
  columns: Array<{ header: string; field: string | null }>;
  missingRequired: string[];
  rows: Array<{ line: number; values: Record<string, string>; uncertain: string[] }>;
}

/**
 * Trouve la ligne d'en-tête (dans les 20 premières lignes) puis transforme les lignes suivantes
 * en objets. Les en-têtes répétés (haut de page d'un PDF) et pieds de page sont ignorés.
 */
export function mapTable(table: ExtractedTable, aliases: Record<string, string[]>, required: string[]): MappedTable {
  let headerIdx = -1;
  let mapping: Record<number, string> = {};
  let bestFound = -1;
  for (let i = 0; i < Math.min(table.rows.length, 20); i++) {
    const m = matchHeaders(table.rows[i].map((c) => c.text), aliases);
    const fields = Object.values(m);
    const found = required.filter((r) => fields.includes(r)).length;
    if (found > bestFound || (found === bestFound && fields.length > Object.keys(mapping).length)) {
      bestFound = found;
      headerIdx = i;
      mapping = m;
    }
    if (found === required.length) break;
  }
  const header = headerIdx >= 0 ? table.rows[headerIdx] : [];
  const mappedFields = Object.values(mapping);
  const missingRequired = required.filter((r) => !mappedFields.includes(r));
  const headerKey = header.map((c) => normalizeHeader(c.text)).join("|");
  const positional = header.every((c) => c.x !== undefined) && header.length > 0;

  const rows: MappedTable["rows"] = [];
  if (missingRequired.length === 0) {
    for (let i = headerIdx + 1; i < table.rows.length; i++) {
      const raw = table.rows[i];
      if (raw.map((c) => normalizeHeader(c.text)).join("|") === headerKey) continue;
      if (raw.length === 1 && /^-+\s*\d+\s*(of|sur|\/)\s*\d+\s*-+$/i.test(raw[0].text)) continue;
      const cells = positional ? alignToHeader(raw, header) : raw;
      const values: Record<string, string> = {};
      const uncertain: string[] = [];
      for (const [col, field] of Object.entries(mapping)) {
        const cell = cells[Number(col)];
        values[field] = cell?.text ?? "";
        if (cell?.confidence !== undefined && cell.confidence < OCR_UNCERTAIN_BELOW && cell.text) uncertain.push(field);
      }
      if (Object.values(values).every((v) => v === "")) continue;
      rows.push({ line: i + 1, values, uncertain });
    }
  }
  return {
    columns: header.map((c, col) => ({ header: c.text, field: mapping[col] ?? null })),
    missingRequired,
    rows,
  };
}
