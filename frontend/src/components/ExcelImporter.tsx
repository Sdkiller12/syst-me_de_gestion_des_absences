import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "./ui/Button";
import { downloadTemplate } from "../utils/excel";
import { studentService } from "../services/student.service";
import type { ImportReport } from "../types";

export function ExcelImporter({
  classId,
  onDone,
}: {
  classId: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  function handleFile(f: File | undefined) {
    if (!f) return;
    setError("");
    setReport(null);
    if (!/\.xlsx?$|\.xls$/i.test(f.name)) {
      setError("Format invalide. Utilisez .xlsx ou .xls.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 5 Mo).");
      return;
    }
    setFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setPending(true);
    setError("");
    try {
      // Envoi réel au backend : persistance PostgreSQL + rapport détaillé
      const r = await studentService.importFile(classId, file);
      setReport(r);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-slate-50 p-6 text-center">
        <Upload className="mx-auto text-[#64748B]" size={24} />
        <p className="mt-2 text-sm font-medium text-[#0F172A]">Sélectionnez votre fichier Excel réel</p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]">
          Choisir un fichier
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        <p className="mt-2 text-xs text-[#64748B]">
          Colonnes : Prénom | Nom | Matricule | Téléphone | Téléphone parent | Email | Classe
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline"
        >
          <Download size={14} /> Télécharger le modèle
        </button>
      </div>

      {file ? <p className="text-sm text-[#0F172A]">Fichier : <strong>{file.name}</strong></p> : null}
      {error ? <p className="text-sm text-[#DC2626]">{error}</p> : null}

      {report ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm">
          <p className="font-semibold text-[#0F172A]">
            {report.analyzed} étudiants analysés — {report.imported} importés, {report.duplicates} doublons, {report.invalid} lignes invalides
          </p>
          {report.errors.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-[#DC2626]">
              {report.errors.slice(0, 20).map((e, i) => (
                <li key={i}>Ligne {e.row} : {e.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setFile(null); setReport(null); }}>
          Annuler
        </Button>
        <Button loading={pending} disabled={!file} onClick={() => void handleImport()}>
          Importer vers PostgreSQL
        </Button>
      </div>
    </div>
  );
}
