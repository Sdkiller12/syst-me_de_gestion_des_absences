import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Lock, PenLine, Save, Trash2 } from "lucide-react";
import { useTeacherClassStudents, useTeacherMe } from "../../hooks/useTeacherModule";
import { useEvaluationSheet, useTeacherEvaluations } from "../../hooks/useGradesTimetable";
import { teacherGradeService } from "../../services/grade.service";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../utils/cn";
import { todayISODate } from "../../utils/format";
import { EVALUATION_TYPE_LABELS, formatScore, parseScore } from "../../utils/grades";
import type { Evaluation, EvaluationType } from "../../types";

const TYPE_OPTIONS = (Object.keys(EVALUATION_TYPE_LABELS) as EvaluationType[]).map((t) => ({ value: t, label: EVALUATION_TYPE_LABELS[t] }));

interface Meta {
  title: string;
  type: EvaluationType;
  date: string;
  coefficient: string;
  maxScore: string;
}

interface SheetStudent {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  score: number | null;
}

/** Validation locale (confort) ; le serveur revalide barème, coefficient et appartenance à la classe */
function metaErrors(m: Meta) {
  const errors: Partial<Record<keyof Meta, string>> = {};
  if (m.title.trim().length < 2) errors.title = "Intitulé requis";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) errors.date = "Date requise";
  const coef = Number(m.coefficient.replace(",", "."));
  if (!Number.isFinite(coef) || coef <= 0 || coef > 20) errors.coefficient = "Coefficient positif (max 20)";
  const max = Number(m.maxScore.replace(",", "."));
  if (!Number.isFinite(max) || max <= 0 || max > 100) errors.maxScore = "Barème positif (max 100)";
  return errors;
}

function GradeSheet({
  evaluationId,
  classId,
  subjectId,
  initialMeta,
  students,
  editable,
  onSaved,
  onDeleted,
}: {
  evaluationId: string | null;
  classId: string;
  subjectId: string;
  initialMeta: Meta;
  students: SheetStudent[];
  editable: boolean;
  onSaved: (evaluationId: string) => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.score === null ? "" : formatScore(s.score)])),
  );
  const [saving, setSaving] = useState(false);
  // Les erreurs de l'en-tête ne s'affichent qu'après une première tentative d'enregistrement
  const [attempted, setAttempted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const maxScore = Number(meta.maxScore.replace(",", ".")) || 20;
  const allErrors = metaErrors(meta);
  const errors = attempted ? allErrors : {};
  const parsed = useMemo(() => Object.fromEntries(students.map((s) => [s.id, parseScore(scores[s.id] ?? "", maxScore)])), [students, scores, maxScore]);
  const rowErrors = students.filter((s) => parsed[s.id].error).length;
  const graded = students.filter((s) => parsed[s.id].value !== null && !parsed[s.id].error).length;
  const canSave = editable && rowErrors === 0 && !saving;

  async function save() {
    setAttempted(true);
    if (Object.keys(allErrors).length > 0) return;
    setSaving(true);
    try {
      // Seules les lignes renseignées ou vidées sont envoyées ; vider une note existante la supprime
      const grades = students
        .filter((s) => parsed[s.id].value !== null || s.score !== null)
        .map((s) => ({ studentId: s.id, score: parsed[s.id].value }));
      const metaPayload = {
        title: meta.title.trim(),
        type: meta.type,
        date: meta.date,
        coefficient: Number(meta.coefficient.replace(",", ".")),
        maxScore,
      };
      let id = evaluationId;
      if (id) {
        const previousMax = Number(initialMeta.maxScore);
        const changed =
          metaPayload.title !== initialMeta.title ||
          metaPayload.type !== initialMeta.type ||
          metaPayload.date !== initialMeta.date ||
          metaPayload.coefficient !== Number(initialMeta.coefficient) ||
          metaPayload.maxScore !== previousMax;
        const existingId = id;
        const saveMeta = () => (changed ? teacherGradeService.updateEvaluation(existingId, metaPayload) : Promise.resolve());
        const saveGrades = () => teacherGradeService.saveGrades({ evaluationId: existingId, grades });
        // Le serveur contrôle les notes contre le barème en vigueur : on élargit le barème avant
        // d'écrire les notes, et on ne le réduit qu'après les avoir corrigées.
        if (metaPayload.maxScore >= previousMax) {
          await saveMeta();
          await saveGrades();
        } else {
          await saveGrades();
          await saveMeta();
        }
      } else {
        id = (await teacherGradeService.saveGrades({ evaluation: { classId, subjectId, ...metaPayload }, grades })).evaluationId;
      }
      await qc.invalidateQueries({ queryKey: ["teacher-space"] });
      notify("Notes enregistrées");
      onSaved(id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Enregistrement impossible", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!evaluationId) return;
    setSaving(true);
    try {
      await teacherGradeService.removeEvaluation(evaluationId);
      await qc.invalidateQueries({ queryKey: ["teacher-space"] });
      notify("Évaluation supprimée");
      onDeleted();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Suppression impossible", "error");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  const set = (k: keyof Meta) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setMeta((m) => ({ ...m, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {!editable ? (
        <div role="status" className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Lock size={16} className="mt-0.5 shrink-0" />
          Vous n'êtes plus affecté à cette classe pour cette matière : ces notes sont consultables mais ne peuvent plus être modifiées.
        </div>
      ) : null}

      <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2">
          <Input label="Intitulé" placeholder="Devoir 1" value={meta.title} onChange={set("title")} error={errors.title} disabled={!editable} maxLength={120} />
        </div>
        <Select label="Type" options={TYPE_OPTIONS} value={meta.type} onChange={set("type")} disabled={!editable} />
        <Input label="Date" type="date" value={meta.date} onChange={set("date")} error={errors.date} disabled={!editable} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Coef." inputMode="decimal" value={meta.coefficient} onChange={set("coefficient")} error={errors.coefficient} disabled={!editable} />
          <Input label="Barème" inputMode="decimal" value={meta.maxScore} onChange={set("maxScore")} error={errors.maxScore} disabled={!editable} />
        </div>
      </Card>

      {students.length === 0 ? (
        <EmptyState title="Aucun élève" description="Aucun élève actif dans cette classe. L'administration doit d'abord importer la liste des élèves." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            <span>Élève</span>
            <span>Note / {formatScore(maxScore)}</span>
          </div>
          <ol className="divide-y divide-slate-100" aria-label="Notes des élèves">
            {students.map((s, i) => {
              const err = parsed[s.id].error;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <label htmlFor={`score-${s.id}`} className="min-w-0 text-sm">
                    <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                    <span className="font-bold text-slate-900">{s.lastName}</span> <span className="text-slate-700">{s.firstName}</span>
                  </label>
                  <div className="flex shrink-0 flex-col items-end">
                    <input
                      id={`score-${s.id}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={scores[s.id] ?? ""}
                      disabled={!editable}
                      aria-invalid={!!err}
                      onChange={(e) => setScores((m) => ({ ...m, [s.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          document.getElementById(`score-${students[i + 1]?.id}`)?.focus();
                        }
                      }}
                      placeholder="—"
                      className={cn(
                        "w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold text-slate-900 shadow-2xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50",
                        err && "border-red-400 bg-red-50/40",
                      )}
                    />
                    {err ? <span className="mt-0.5 text-[11px] font-semibold text-red-600">{err}</span> : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {editable ? (
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur">
              <p className="text-xs font-semibold text-slate-600">
                {graded} / {students.length} élève(s) noté(s)
                {rowErrors ? <span className="ml-2 text-red-600">— {rowErrors} note(s) invalide(s)</span> : null}
              </p>
              <div className="flex gap-2">
                {evaluationId ? (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                    <Trash2 size={14} /> Supprimer
                  </Button>
                ) : null}
                <Button onClick={() => void save()} disabled={!canSave} loading={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  <Save size={16} /> Enregistrer
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {confirmDelete ? (
        <ConfirmDialog
          title="Supprimer l'évaluation"
          message={`« ${meta.title} » et toutes ses notes seront définitivement supprimées.`}
          confirmLabel="Supprimer"
          pending={saving}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </div>
  );
}

const newMeta = (): Meta => ({ title: "", type: "DEVOIR", date: todayISODate(), coefficient: "1", maxScore: "20" });

const metaOf = (e: Evaluation): Meta => ({
  title: e.title,
  type: e.type,
  date: e.date,
  coefficient: String(e.coefficient),
  maxScore: String(e.maxScore),
});

/** Feuille d'une évaluation existante (notes déjà saisies) */
function ExistingSheet(props: { evaluationId: string; onSaved: (id: string) => void; onDeleted: () => void }) {
  const sheet = useEvaluationSheet(props.evaluationId);
  if (sheet.isLoading) return <LoadingState label="Chargement des notes…" />;
  if (sheet.isError || !sheet.data) return <ErrorState message="Évaluation inaccessible." onRetry={() => void sheet.refetch()} />;
  const d = sheet.data;
  return (
    <GradeSheet
      key={d.evaluation.updatedAt}
      evaluationId={d.evaluation.id}
      classId={d.evaluation.class.id}
      subjectId={d.evaluation.subject.id}
      initialMeta={metaOf(d.evaluation)}
      students={d.students}
      editable={d.editable}
      onSaved={props.onSaved}
      onDeleted={props.onDeleted}
    />
  );
}

/** Nouvelle évaluation : liste de la classe sans note */
function NewSheet(props: { classId: string; subjectId: string; onSaved: (id: string) => void }) {
  const students = useTeacherClassStudents(props.classId);
  if (students.isLoading) return <LoadingState label="Chargement de la classe…" />;
  if (students.isError || !students.data) return <ErrorState message="Liste de la classe inaccessible." onRetry={() => void students.refetch()} />;
  return (
    <GradeSheet
      evaluationId={null}
      classId={props.classId}
      subjectId={props.subjectId}
      initialMeta={newMeta()}
      students={students.data.map((s) => ({ ...s, score: null }))}
      editable
      onSaved={props.onSaved}
      onDeleted={() => undefined}
    />
  );
}

function History({ onOpen }: { onOpen: (e: Evaluation) => void }) {
  const me = useTeacherMe();
  const [filters, setFilters] = useState({ classId: "", subjectId: "", type: "" as EvaluationType | "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const list = useTeacherEvaluations({ page, ...filters });
  const classes = useMemo(() => [...new Map((me.data?.assignments ?? []).map((a) => [a.class.id, a.class.name]))], [me.data]);
  const select = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
  function set<K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-slate-900">Mes évaluations</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select aria-label="Classe" className={select} value={filters.classId} onChange={(e) => set("classId", e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Matière" className={select} value={filters.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
          <option value="">Toutes les matières</option>
          {(me.data?.subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Type" className={select} value={filters.type} onChange={(e) => set("type", e.target.value as EvaluationType | "")}>
          <option value="">Tous les types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input aria-label="Du" type="date" className={select} value={filters.from} onChange={(e) => set("from", e.target.value)} />
        <input aria-label="Au" type="date" className={select} value={filters.to} onChange={(e) => set("to", e.target.value)} />
      </div>

      {list.isLoading ? <LoadingState /> : null}
      {list.isError ? <ErrorState message="Impossible de charger vos évaluations." onRetry={() => void list.refetch()} /> : null}
      {list.data && list.data.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center text-sm text-slate-500">Aucune évaluation ne correspond.</p>
      ) : null}
      <div className="space-y-2">
        {(list.data?.data ?? []).map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onOpen(e)}
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-4 text-left hover:border-emerald-300"
          >
            <div className="min-w-0">
              <p className="font-bold text-slate-900">
                {e.title} <span className="text-xs font-semibold text-slate-500">· {EVALUATION_TYPE_LABELS[e.type]}</span>
              </p>
              <p className="text-sm text-emerald-700">
                {e.subject.name} · {e.class.name}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(`${e.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · Coef. {formatScore(e.coefficient)} · Sur{" "}
                {formatScore(e.maxScore)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right text-xs text-slate-600">
              {e.editable === false ? <Badge tone="slate" dot={false}>Lecture seule</Badge> : null}
              <p className="font-semibold text-slate-900">
                {e.stats.count} / {e.studentCount ?? "?"} noté(s)
              </p>
              <p>Moyenne : {formatScore(e.stats.average)}</p>
            </div>
          </button>
        ))}
      </div>
      {list.data ? <Pagination page={page} totalPages={list.data.pagination.totalPages} onChange={setPage} /> : null}
    </section>
  );
}

export function TeacherGrades() {
  const me = useTeacherMe();
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [evaluationId, setEvaluationId] = useState<string>("new");
  const evaluations = useTeacherEvaluations({ classId, subjectId, page: 1 });

  const assignments = me.data?.assignments ?? [];
  const subjects = [...new Map(assignments.map((a) => [a.subject.id, a.subject.name]))];
  const classes = assignments.filter((a) => a.subject.id === subjectId).map((a) => a.class);
  const ready = !!subjectId && !!classId;

  function open(e: Evaluation) {
    setSubjectId(e.subject.id);
    setClassId(e.class.id);
    setEvaluationId(e.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (me.isLoading) return <LoadingState />;
  if (me.isError) return <ErrorState message="Impossible de charger vos affectations." onRetry={() => void me.refetch()} />;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <BookOpenCheck className="text-emerald-600" size={22} /> Notes
        </h1>
        <p className="text-sm text-slate-500">Saisissez et modifiez les notes de vos classes, pour les matières qui vous sont affectées.</p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState title="Aucune affectation" description="Aucune classe ne vous est affectée : l'administration doit d'abord vous attribuer vos classes et matières." />
      ) : (
        <>
          <Card className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Matière"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setClassId("");
                setEvaluationId("new");
              }}
              options={[{ value: "", label: "Choisir une matière" }, ...subjects.map(([id, name]) => ({ value: id, label: name }))]}
            />
            <Select
              label="Classe"
              value={classId}
              disabled={!subjectId}
              onChange={(e) => {
                setClassId(e.target.value);
                setEvaluationId("new");
              }}
              options={[{ value: "", label: "Choisir une classe" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Select
              label="Évaluation"
              value={evaluationId}
              disabled={!ready}
              onChange={(e) => setEvaluationId(e.target.value)}
              options={[
                { value: "new", label: "+ Nouvelle évaluation" },
                ...(ready ? evaluations.data?.data ?? [] : []).map((e) => ({ value: e.id, label: `${e.title} — ${new Date(`${e.date}T12:00:00`).toLocaleDateString("fr-FR")}` })),
                // Évaluation ouverte depuis l'historique mais hors de la première page
                ...(evaluationId !== "new" && !(evaluations.data?.data ?? []).some((e) => e.id === evaluationId) ? [{ value: evaluationId, label: "Évaluation sélectionnée" }] : []),
              ]}
            />
          </Card>

          {ready ? (
            evaluationId === "new" ? (
              <NewSheet key={`${classId}:${subjectId}`} classId={classId} subjectId={subjectId} onSaved={setEvaluationId} />
            ) : (
              <ExistingSheet key={evaluationId} evaluationId={evaluationId} onSaved={setEvaluationId} onDeleted={() => setEvaluationId("new")} />
            )
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center text-sm text-slate-500">
              <PenLine size={16} /> Choisissez une matière puis une classe pour saisir des notes.
            </p>
          )}

          <History onOpen={open} />
        </>
      )}
    </div>
  );
}
