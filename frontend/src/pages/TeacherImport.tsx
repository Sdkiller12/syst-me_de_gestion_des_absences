import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, FileText, KeyRound, Loader2, RefreshCw, ScanText, Trash2, Upload } from "lucide-react";
import { teacherService } from "../services/teacher.service";
import { useInvalidateTeachers } from "../hooks/useTeacherModule";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { CredentialsDialog } from "../components/CredentialsDialog";
import { cn } from "../utils/cn";
import type {
  IssuedCredentials,
  TeacherImportField,
  TeacherImportPreview,
  TeacherImportResult,
  TeacherImportRow,
  TeacherImportStatus,
  TeacherImportSummary,
} from "../types";

const FIELDS: Array<{ key: TeacherImportField; label: string; width: string }> = [
  { key: "lastName", label: "Nom", width: "w-32" },
  { key: "firstName", label: "Prénom", width: "w-32" },
  { key: "subject", label: "Matière", width: "w-36" },
  { key: "className", label: "Classe", width: "w-32" },
  { key: "phone", label: "Téléphone", width: "w-32" },
  { key: "email", label: "Email", width: "w-44" },
  { key: "employeeNumber", label: "Matricule", width: "w-28" },
];

const STATUS: Record<TeacherImportStatus, { label: string; tone: "green" | "amber" | "blue" | "slate" | "red" }> = {
  VALID: { label: "Valide", tone: "green" },
  WARNING: { label: "Attention", tone: "amber" },
  EXISTING: { label: "Déjà enregistré", tone: "blue" },
  DUPLICATE: { label: "Doublon", tone: "slate" },
  ERROR: { label: "Erreur", tone: "red" },
};

const FILE_TYPE: Record<TeacherImportPreview["fileType"], string> = { EXCEL: "Excel", PDF: "PDF (texte)", PDF_OCR: "PDF scanné (OCR)" };

type Filter = "ALL" | "ERROR" | "WARNING" | "DUPLICATE";
const PAGE = 100;

export function TeacherImport() {
  const [params] = useSearchParams();
  const format = params.get("format");
  const navigate = useNavigate();
  const invalidate = useInvalidateTeachers();
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<TeacherImportPreview | null>(null);
  const [rows, setRows] = useState<TeacherImportRow[]>([]);
  const [summary, setSummary] = useState<TeacherImportSummary | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [shown, setShown] = useState(PAGE);
  const [result, setResult] = useState<TeacherImportResult | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredentials[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function analyze(file: File) {
    if (!/\.(xlsx|xls|pdf)$/i.test(file.name)) {
      notify("Format non pris en charge. Utilisez .xlsx, .xls ou .pdf", "error");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const p = await teacherService.importPreview(file);
      setPreview(p);
      setRows(p.rows);
      setSummary(p.summary);
      setDirty(false);
      setFilter(p.summary.errors > 0 ? "ERROR" : "ALL");
      setShown(PAGE);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Analyse impossible", "error");
    } finally {
      setAnalyzing(false);
    }
  }

  const payload = () => rows.map((r) => ({ line: r.line, values: r.values }));

  function edit(line: number, field: TeacherImportField, value: string) {
    setRows((rs) => rs.map((r) => (r.line === line ? { ...r, values: { ...r.values, [field]: value } } : r)));
    setDirty(true);
  }

  function removeRow(line: number) {
    setRows((rs) => rs.filter((r) => r.line !== line));
    setDirty(true);
  }

  async function revalidate() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const res = await teacherService.importRevalidate(payload());
      setRows(res.rows);
      setSummary(res.summary);
      setDirty(false);
      if (res.summary.errors === 0 && filter === "ERROR") setFilter("ALL");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Validation impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    setBusy(true);
    try {
      const res = await teacherService.importConfirm(payload());
      setResult(res);
      await invalidate();
      notify(`${res.teachersCreated} enseignant(s) enregistré(s)`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Import impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  async function createAccounts() {
    if (!result) return;
    setBusy(true);
    try {
      const res = await teacherService.createAccounts(result.createdTeacherIds);
      await invalidate();
      setCredentials(res.created);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Création des comptes impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () =>
      rows.filter((r) =>
        filter === "ALL" ? true : filter === "DUPLICATE" ? r.status === "DUPLICATE" || r.status === "EXISTING" : r.status === filter,
      ),
    [rows, filter],
  );
  const canImport = !!summary && summary.errors === 0 && !dirty && rows.length > 0 && !busy;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <Link to="/admin/teachers" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft size={14} /> Enseignants
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">Importer des enseignants</h1>
          <p className="mt-1 text-sm text-slate-500">
            Excel (.xlsx, .xls) ou PDF, y compris scanné. Colonnes reconnues dans n'importe quel ordre : Nom, Prénom, Matière, Classe,
            Téléphone, Email, Matricule.
          </p>
        </div>
      </div>

      {!result ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void analyze(f);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white p-8 text-center transition-colors",
            dragOver ? "border-indigo-500 bg-indigo-50/50" : "border-slate-300",
          )}
        >
          {analyzing ? (
            <>
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-sm font-semibold text-slate-700">Analyse du fichier…</p>
              <p className="text-xs text-slate-500">Un PDF scanné passe par la reconnaissance de caractères (OCR) : cela peut prendre une minute.</p>
            </>
          ) : (
            <>
              <div className="flex gap-2 text-indigo-600">
                {format !== "pdf" ? <FileSpreadsheet size={30} /> : null}
                {format !== "excel" ? <FileText size={30} /> : null}
              </div>
              <p className="text-sm font-semibold text-slate-700">Glissez votre fichier ici ou</p>
              <Button onClick={() => inputRef.current?.click()}>
                <Upload size={16} /> Choisir un fichier
              </Button>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={format === "pdf" ? ".pdf" : format === "excel" ? ".xlsx,.xls" : ".xlsx,.xls,.pdf"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void analyze(f);
                  e.target.value = "";
                }}
              />
              <p className="text-xs text-slate-400">10 Mo maximum · 2000 lignes maximum</p>
            </>
          )}
        </div>
      ) : null}

      {preview && summary && !result ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="font-bold text-slate-900">{preview.fileName}</span>
              <Badge tone="indigo" dot={false}>{FILE_TYPE[preview.fileType]}</Badge>
              {preview.ocrConfidence !== null ? (
                <Badge tone={preview.ocrConfidence >= 80 ? "green" : "amber"} dot={false}>
                  <ScanText size={12} /> Lecture OCR : {preview.ocrConfidence} %
                </Badge>
              ) : null}
            </div>
            <p className="mt-4 text-2xl font-extrabold text-slate-900">{summary.total} ligne(s) détectée(s)</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xl font-bold text-emerald-700">{summary.valid}</p>
                <p className="text-xs font-semibold text-emerald-800">données valides{summary.warnings ? ` (dont ${summary.warnings} à vérifier)` : ""}</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xl font-bold text-slate-700">{summary.duplicates}</p>
                <p className="text-xs font-semibold text-slate-700">doublons{summary.existing ? ` (dont ${summary.existing} déjà enregistrés)` : ""}</p>
              </div>
              <div className={cn("rounded-xl p-3", summary.errors ? "bg-rose-50" : "bg-slate-50")}>
                <p className={cn("text-xl font-bold", summary.errors ? "text-rose-700" : "text-slate-500")}>{summary.errors}</p>
                <p className={cn("text-xs font-semibold", summary.errors ? "text-rose-800" : "text-slate-500")}>erreurs bloquantes</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3 text-xs font-semibold text-indigo-900">
                <p>{summary.teachersToCreate} enseignant(s) à créer</p>
                <p>{summary.subjectsToCreate} matière(s) nouvelle(s)</p>
                <p>{summary.assignmentsDetected} affectation(s) détectée(s)</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-500">
              Colonnes reconnues :
              {preview.columns.map((c, i) =>
                c.header ? (
                  <span key={i} className={cn("rounded-md px-1.5 py-0.5", c.field ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500 line-through")}>
                    {c.header}
                  </span>
                ) : null,
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              {(
                [
                  ["ALL", `Toutes (${rows.length})`],
                  ["ERROR", `Erreurs (${summary.errors})`],
                  ["WARNING", `À vérifier (${summary.warnings})`],
                  ["DUPLICATE", `Doublons (${summary.duplicates})`],
                ] as Array<[Filter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn("rounded-lg px-3 py-1.5", filter === key ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900")}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void revalidate()} disabled={!dirty || busy}>
                <RefreshCw size={16} /> Revalider les corrections
              </Button>
              <Button onClick={() => void confirmImport()} disabled={!canImport} loading={busy && !dirty}>
                <CheckCircle2 size={16} /> Importer
              </Button>
            </div>
          </div>
          {!canImport ? (
            <p className="text-xs font-semibold text-slate-500">
              {dirty
                ? "Vous avez modifié des lignes : revalidez-les avant d'importer."
                : summary.errors > 0
                  ? "Corrigez ou retirez les lignes en erreur pour activer l'import."
                  : null}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-2 py-2">Ligne</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-2">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-2 py-2">Statut</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.slice(0, shown).map((r) => {
                  const fieldIssue = (f: TeacherImportField) => r.issues.find((i) => i.field === f);
                  return (
                    <tr key={r.line} className={cn("align-top", r.status === "ERROR" && "bg-rose-50/40", r.status === "DUPLICATE" && "opacity-60")}>
                      <td className="px-2 py-2 text-xs text-slate-400">{r.line}</td>
                      {FIELDS.map((f) => {
                        const issue = fieldIssue(f.key);
                        return (
                          <td key={f.key} className="px-1 py-1.5">
                            <input
                              aria-label={`${f.label}, ligne ${r.line}`}
                              title={issue?.message}
                              value={r.values[f.key] ?? ""}
                              onChange={(e) => edit(r.line, f.key, e.target.value)}
                              className={cn(
                                "rounded-lg border px-2 py-1 text-xs",
                                f.width,
                                issue?.blocking ? "border-rose-400 bg-rose-50" : issue ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
                              )}
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-2">
                        <Badge tone={STATUS[r.status].tone} dot={false}>{STATUS[r.status].label}</Badge>
                        {r.issues.length ? (
                          <ul className="mt-1 max-w-64 space-y-0.5">
                            {r.issues.map((i, k) => (
                              <li key={k} className={cn("text-[11px] leading-tight", i.blocking ? "text-rose-700" : "text-slate-500")}>
                                {i.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {r.class && r.subject ? (
                          <p className="mt-1 text-[11px] text-indigo-700">
                            Affectation : {r.subject.name} · {r.class.name}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" aria-label={`Retirer la ligne ${r.line}`} title="Retirer cette ligne" onClick={() => removeRow(r.line)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length > shown ? (
              <div className="border-t border-slate-100 p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                  Afficher {Math.min(PAGE, visible.length - shown)} ligne(s) de plus
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {result ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={22} />
            <h2 className="text-lg font-bold">Import terminé</h2>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            <li>{result.teachersCreated} enseignant(s) créé(s)</li>
            {result.teachersUpdated ? <li>{result.teachersUpdated} fiche(s) existante(s) complétée(s)</li> : null}
            <li>{result.subjectsCreated} matière(s) créée(s)</li>
            <li>{result.assignmentsCreated} affectation(s) créée(s)</li>
            {result.duplicatesSkipped ? <li>{result.duplicatesSkipped} doublon(s) ignoré(s)</li> : null}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            {result.createdTeacherIds.length > 0 ? (
              <Button onClick={() => void createAccounts()} loading={busy}>
                <KeyRound size={16} /> Créer les comptes des {result.createdTeacherIds.length} nouveaux enseignants
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => navigate("/admin/teachers")}>
              Voir les enseignants
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setResult(null);
                setPreview(null);
                setRows([]);
                setSummary(null);
              }}
            >
              Importer un autre fichier
            </Button>
          </div>
        </div>
      ) : null}

      {credentials ? (
        <CredentialsDialog
          title={`${credentials.length} compte(s) créé(s)`}
          credentials={credentials}
          onClose={() => {
            setCredentials(null);
            navigate("/admin/teachers");
          }}
        />
      ) : null}
    </div>
  );
}
