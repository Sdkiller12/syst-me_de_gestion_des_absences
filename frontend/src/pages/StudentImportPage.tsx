import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Edit2,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Upload,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { useClasses, useStudentMutations } from "../hooks/useApi";
import {
  studentService,
  type PreviewImportResult,
  type ImportResultSummary,
} from "../services/student.service";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";

type ImportStep = "SELECT" | "ANALYZING" | "MAPPING" | "PREVIEW" | "CONFIRM" | "RESULT";

export function StudentImportPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const classesQuery = useClasses();
  const studentMutations = useStudentMutations();

  const [step, setStep] = useState<ImportStep>("SELECT");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewImportResult | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "VALID" | "ERROR" | "DUPLICATE">("ALL");

  // Duplicate action strategy: SKIP | UPDATE | OVERWRITE
  const [duplicateStrategy, setDuplicateStrategy] = useState<"SKIP" | "UPDATE">("SKIP");

  // Editing row modal state
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    studentNumber: "",
    phone: "",
    parentPhone: "",
    parentName: "",
    email: "",
  });

  // Final result state
  const [importSummary, setImportSummary] = useState<ImportResultSummary | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Column Mapping state
  const [customMapping, setCustomMapping] = useState<Record<string, string>>({});

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  }

  function validateAndSetFile(f: File) {
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (![".xlsx", ".xls", ".pdf"].includes(ext)) {
      notify("Format de fichier non valide. Utilisez .xlsx, .xls ou .pdf", "error");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      notify("Fichier trop volumineux. Taille maximale : 10 Mo", "error");
      return;
    }
    setFile(f);
  }

  async function startAnalysis() {
    if (!selectedClassId) {
      notify("Veuillez d'abord choisir une classe pour l'importation.", "error");
      return;
    }
    if (!file) {
      notify("Veuillez sélectionner un fichier à téléverser.", "error");
      return;
    }

    setStep("ANALYZING");
    try {
      const res = await studentService.previewImport(selectedClassId, file);
      setPreviewResult(res);
      setCustomMapping(res.columnMapping.mappedHeaders);

      if (res.columnMapping.missingRequired.length > 0) {
        setStep("MAPPING");
      } else {
        setStep("PREVIEW");
      }
    } catch (e) {
      setStep("SELECT");
      notify(e instanceof Error ? e.message : "Erreur lors de l'analyse du fichier.", "error");
    }
  }

  function openEditModal(lineIndex: number) {
    if (!previewResult) return;
    const row = previewResult.rows.find((r) => r.lineIndex === lineIndex);
    if (!row) return;

    setEditingRowIndex(lineIndex);
    setEditFormData({
      firstName: row.data.firstName === "Valeur Non Détectée" ? "" : row.data.firstName,
      lastName: row.data.lastName === "VALEUR NON DÉTECTÉE" ? "" : row.data.lastName,
      studentNumber: row.data.studentNumber ?? "",
      phone: row.data.phone ?? "",
      parentPhone: row.data.parentPhone ?? "",
      parentName: row.data.parentName ?? "",
      email: row.data.email ?? "",
    });
  }

  function saveRowEdit() {
    if (editingRowIndex === null || !previewResult) return;

    const updatedRows = previewResult.rows.map((r) => {
      if (r.lineIndex === editingRowIndex) {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: "VALID" | "ERROR" | "WARNING" | "DUPLICATE" = "VALID";

        const lastName = editFormData.lastName.trim().toUpperCase();
        const firstName = editFormData.firstName.trim();
        const phone = editFormData.phone.trim();
        const parentPhone = editFormData.parentPhone.trim();
        const email = editFormData.email.trim();

        if (!lastName) errors.push("Nom manquant");
        if (!firstName) errors.push("Prénom manquant");

        if (errors.length > 0) {
          status = "ERROR";
        } else {
          status = "VALID";
        }

        return {
          ...r,
          data: {
            ...r.data,
            lastName: lastName || "VALEUR NON DÉTECTÉE",
            firstName: firstName || "Valeur Non Détectée",
            studentNumber: editFormData.studentNumber.trim() || null,
            phone,
            parentPhone: parentPhone || null,
            parentName: editFormData.parentName.trim() || null,
            email: email || null,
          },
          errors,
          warnings,
          status,
          confidenceScore: 100,
          needsManualReview: false,
        };
      }
      return r;
    });

    const validCount = updatedRows.filter((r) => r.status === "VALID").length;
    const invalidCount = updatedRows.filter((r) => r.status === "ERROR").length;
    const duplicateCount = updatedRows.filter((r) => r.status === "DUPLICATE").length;
    const warningCount = updatedRows.filter((r) => r.status === "WARNING").length;

    setPreviewResult({
      ...previewResult,
      rows: updatedRows,
      validCount,
      invalidCount,
      duplicateCount,
      warningCount,
    });

    setEditingRowIndex(null);
    notify("Ligne corrigée et validée avec succès");
  }

  async function handleConfirmImport() {
    if (!previewResult) return;

    setIsConfirming(true);
    try {
      const payloadRows = previewResult.rows
        .filter((r) => r.status !== "ERROR")
        .map((r) => ({
          lineIndex: r.lineIndex,
          data: r.data,
        }));

      const summary = await studentService.confirmImport({
        classId: previewResult.classId,
        fileName: previewResult.fileName,
        fileType: previewResult.fileType,
        fileSize: previewResult.fileSize,
        duplicateStrategy,
        rows: payloadRows,
      });

      setImportSummary(summary);
      setStep("RESULT");
      notify("Importation effectuée avec succès !");
      void studentMutations.create.reset(); // trigger refetch
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur lors de la confirmation de l'import", "error");
    } finally {
      setIsConfirming(false);
    }
  }

  const filteredRows = (previewResult?.rows ?? []).filter((r) => {
    if (activeTab === "VALID") return r.status === "VALID";
    if (activeTab === "ERROR") return r.status === "ERROR";
    if (activeTab === "DUPLICATE") return r.status === "DUPLICATE";
    return true;
  });

  const hasBlockingErrors = (previewResult?.invalidCount ?? 0) > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/students" className="text-slate-500 hover:text-slate-800 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="text-blue-600" size={24} />
              Importation d'Étudiants par Fichier
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Importez de véritables listes d'étudiants à partir de vos fichiers Excel (.xlsx, .xls) ou PDF (.pdf).
          </p>
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs font-medium text-slate-600">
        <div className={`flex items-center gap-2 p-2 rounded-lg ${step === "SELECT" ? "bg-blue-50 text-blue-700 font-semibold" : ""}`}>
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
          Sélection Fichier & Classe
        </div>
        <div className={`flex items-center gap-2 p-2 rounded-lg ${step === "ANALYZING" || step === "MAPPING" ? "bg-blue-50 text-blue-700 font-semibold" : ""}`}>
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
          Analyse & Structure
        </div>
        <div className={`flex items-center gap-2 p-2 rounded-lg ${step === "PREVIEW" || step === "CONFIRM" ? "bg-blue-50 text-blue-700 font-semibold" : ""}`}>
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
          Validation & Corrections
        </div>
        <div className={`flex items-center gap-2 p-2 rounded-lg ${step === "RESULT" ? "bg-emerald-50 text-emerald-700 font-semibold" : ""}`}>
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">4</span>
          Rapport d'Importation
        </div>
      </div>

      {/* STEP 1: SELECT FILE AND CLASS */}
      {step === "SELECT" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900">
              Classe de destination <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">-- Sélectionner une classe --</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.academicYear})
                </option>
              ))}
            </select>
          </div>

          {/* Drag & Drop Zone */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900">Fichier de liste d'étudiants (.xlsx, .xls, .pdf)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isDragOver ? "border-blue-500 bg-blue-50/50" : file ? "border-emerald-400 bg-emerald-50/30" : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.pdf"
                className="hidden"
                id="student-file-input"
                onChange={handleFileInputChange}
              />
              <label htmlFor="student-file-input" className="cursor-pointer flex flex-col items-center">
                {file ? (
                  <>
                    {file.name.endsWith(".pdf") ? (
                      <FileText className="text-red-500 mb-2" size={44} />
                    ) : (
                      <FileSpreadsheet className="text-emerald-600 mb-2" size={44} />
                    )}
                    <p className="text-base font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024).toFixed(1)} KB — {file.type || "Fichier détecté"}
                    </p>
                    <p className="text-xs text-blue-600 font-medium mt-2 hover:underline">Cliquer pour changer de fichier</p>
                  </>
                ) : (
                  <>
                    <Upload className="text-blue-600 mb-3" size={48} />
                    <p className="text-base font-semibold text-slate-800">
                      Glissez-déposez votre fichier ici
                    </p>
                    <p className="text-xs text-slate-500 mt-1">ou cliquez pour choisir un fichier depuis votre ordinateur</p>
                    <div className="mt-4 px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-600">
                      Formats acceptés : Excel (.xlsx, .xls) et PDF (.pdf) — Max 10 Mo
                    </div>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              onClick={startAnalysis}
              disabled={!file || !selectedClassId}
              className="px-6 py-2.5 text-sm font-semibold"
            >
              Lancer l'analyse du fichier
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: ANALYZING LOADING STATE */}
      {step === "ANALYZING" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-12 text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <h3 className="text-lg font-semibold text-slate-900">Analyse du document en cours…</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Extraction du texte, reconstruction des colonnes, vérification de la validité des téléphones et contrôle des doublons PostgreSQL.
          </p>
        </div>
      )}

      {/* STEP 3: MAPPING COLUMN VERIFICATION */}
      {step === "MAPPING" && previewResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <AlertTriangle className="shrink-0 text-amber-600" size={20} />
            <div>
              <p className="font-semibold">Vérification de la structure des colonnes</p>
              <p className="text-xs mt-0.5">
                Certains noms de colonnes nécessitent une confirmation. Vérifiez l'association ci-dessous avant de poursuivre.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">Colonnes détectées dans votre fichier</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {previewResult.headers.map((header) => (
                <div key={header} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                  <span className="font-mono text-slate-700">{header}</span>
                  <span className="text-slate-400">&rarr;</span>
                  <select
                    className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                    value={customMapping[header] || ""}
                    onChange={(e) => setCustomMapping({ ...customMapping, [header]: e.target.value })}
                  >
                    <option value="">-- Non mappé --</option>
                    <option value="lastName">Nom (Obligatoire)</option>
                    <option value="firstName">Prénom (Obligatoire)</option>
                    <option value="studentNumber">Matricule</option>
                    <option value="phone">Téléphone Étudiant</option>
                    <option value="parentPhone">Téléphone Parent</option>
                    <option value="parentName">Nom Parent</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setStep("SELECT")}>
              Retour
            </Button>
            <Button onClick={() => setStep("PREVIEW")}>Valider et prévisualiser</Button>
          </div>
        </div>
      )}

      {/* STEP 4 & 5: PREVIEW AND VALIDATION TABLE */}
      {(step === "PREVIEW" || step === "CONFIRM") && previewResult && (
        <div className="space-y-6">
          {/* File summary stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-xs text-slate-500 font-medium">Total Lignes</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{previewResult.totalRows}</p>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
              <p className="text-xs text-emerald-700 font-medium">Données Valides</p>
              <p className="text-xl font-bold text-emerald-800 mt-1">{previewResult.validCount}</p>
            </div>
            <div className="bg-red-50/50 p-4 rounded-xl border border-red-200">
              <p className="text-xs text-red-700 font-medium">Erreurs Bloquantes</p>
              <p className="text-xl font-bold text-red-800 mt-1">{previewResult.invalidCount}</p>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
              <p className="text-xs text-amber-700 font-medium">Doublons Détectés</p>
              <p className="text-xl font-bold text-amber-800 mt-1">{previewResult.duplicateCount}</p>
            </div>
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 col-span-2 md:col-span-1">
              <p className="text-xs text-blue-700 font-medium">Type Fichier</p>
              <p className="text-sm font-bold text-blue-900 mt-1">{previewResult.fileType}</p>
            </div>
          </div>

          {/* Filtering tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "ALL" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Tous ({previewResult.totalRows})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("VALID")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "VALID" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                Valides ({previewResult.validCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ERROR")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "ERROR" ? "bg-red-600 text-white" : "text-red-700 hover:bg-red-50"
                }`}
              >
                Erreurs ({previewResult.invalidCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("DUPLICATE")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "DUPLICATE" ? "bg-amber-600 text-white" : "text-amber-700 hover:bg-amber-50"
                }`}
              >
                Doublons ({previewResult.duplicateCount})
              </button>
            </div>

            <div className="text-xs text-slate-500 px-2">
              Classe : <strong className="text-slate-800">{previewResult.className}</strong>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
                  <tr>
                    <th className="px-3 py-2.5"># Line</th>
                    <th className="px-3 py-2.5">Statut</th>
                    <th className="px-3 py-2.5">Nom</th>
                    <th className="px-3 py-2.5">Prénom</th>
                    <th className="px-3 py-2.5">Matricule</th>
                    <th className="px-3 py-2.5">Téléphone</th>
                    <th className="px-3 py-2.5">Téléphone Parent</th>
                    <th className="px-3 py-2.5">Détails / Erreurs</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Aucune ligne correspondant au filtre sélectionné.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.lineIndex} className={row.status === "ERROR" ? "bg-red-50/40" : row.status === "DUPLICATE" ? "bg-amber-50/30" : "hover:bg-slate-50/80"}>
                        <td className="px-3 py-2.5 font-mono text-slate-500">{row.lineIndex}</td>
                        <td className="px-3 py-2.5">
                          {row.status === "VALID" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                              <CheckCircle2 size={12} /> Valide
                            </span>
                          )}
                          {row.status === "ERROR" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">
                              <AlertCircle size={12} /> Erreur
                            </span>
                          )}
                          {row.status === "DUPLICATE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                              <AlertTriangle size={12} /> Doublon
                            </span>
                          )}
                          {row.status === "WARNING" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
                              <Sparkles size={12} /> À vérifier
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{row.data.lastName}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{row.data.firstName}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-600">{row.data.studentNumber || "—"}</td>
                        <td className="px-3 py-2.5">{row.data.phone || "—"}</td>
                        <td className="px-3 py-2.5">{row.data.parentPhone || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {row.errors.length > 0 ? (
                            <span className="text-red-600 font-medium">{row.errors.join(", ")}</span>
                          ) : row.duplicateInfo ? (
                            <span className="text-amber-700">{row.duplicateInfo}</span>
                          ) : (
                            <span className="text-slate-400">OK</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(row.lineIndex)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                          >
                            <Edit2 size={12} /> Corriger
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* STEP 6: CONFIRMATION & STRATEGY CHOICE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">Stratégie de gestion des doublons</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                  duplicateStrategy === "SKIP" ? "border-blue-500 bg-blue-50/40" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="dup-strategy"
                  value="SKIP"
                  checked={duplicateStrategy === "SKIP"}
                  onChange={() => setDuplicateStrategy("SKIP")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ignorer les doublons (Recommandé)</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Les étudiants déjà présents dans la base de données ne seront pas réinscrits ni modifiés.
                  </p>
                </div>
              </label>

              <label
                className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                  duplicateStrategy === "UPDATE" ? "border-blue-500 bg-blue-50/40" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="dup-strategy"
                  value="UPDATE"
                  checked={duplicateStrategy === "UPDATE"}
                  onChange={() => setDuplicateStrategy("UPDATE")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Mettre à jour les existants</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Si le matricule ou (nom, prénom) existe déjà, mettre à jour ses coordonnées.
                  </p>
                </div>
              </label>
            </div>

            {hasBlockingErrors && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                Des erreurs bloquantes ({previewResult.invalidCount}) doivent être corrigées avant de lancer l'importation. Cliquez sur « Corriger » sur les lignes en rouge.
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setStep("SELECT")}>
                <RotateCcw size={14} className="mr-1" /> Recommencer
              </Button>
              <Button
                onClick={() => void handleConfirmImport()}
                disabled={hasBlockingErrors || isConfirming}
                loading={isConfirming}
                className="px-6 py-2.5"
              >
                Confirmer l'importation de {previewResult.validCount} étudiants
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 7: FINAL REPORT */}
      {step === "RESULT" && importSummary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <FileCheck size={36} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Importation terminée avec succès !</h2>
            <p className="text-sm text-slate-600">
              Les étudiants de la classe <strong className="text-slate-800">{importSummary.className}</strong> ont été enregistrés dans PostgreSQL.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Analysés</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{importSummary.totalAnalyzed}</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs text-emerald-700">Ajoutés</p>
              <p className="text-xl font-bold text-emerald-900 mt-0.5">{importSummary.insertedRows}</p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-700">Mis à jour</p>
              <p className="text-xl font-bold text-blue-900 mt-0.5">{importSummary.updatedRows}</p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700">Doublons ignorés</p>
              <p className="text-xl font-bold text-amber-900 mt-0.5">{importSummary.duplicateSkipped}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Button
              onClick={() => {
                setStep("SELECT");
                setFile(null);
                setPreviewResult(null);
                setImportSummary(null);
              }}
              variant="secondary"
            >
              Importer un autre fichier
            </Button>
            <Button onClick={() => navigate("/students")}>
              <Users size={16} className="mr-1.5" /> Voir la liste des étudiants
            </Button>
          </div>
        </div>
      )}

      {/* EDIT MODAL FOR INLINE CORRECTION */}
      {editingRowIndex !== null && (
        <Modal title={`Corriger la ligne #${editingRowIndex}`} onClose={() => setEditingRowIndex(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveRowEdit();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  required
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Matricule</label>
                <input
                  type="text"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={editFormData.studentNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, studentNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone Étudiant</label>
                <input
                  type="text"
                  placeholder="0700000000"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone Parent</label>
                <input
                  type="text"
                  placeholder="0500000000"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={editFormData.parentPhone}
                  onChange={(e) => setEditFormData({ ...editFormData, parentPhone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setEditingRowIndex(null)}>
                Annuler
              </Button>
              <Button type="submit">Valider la correction</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
