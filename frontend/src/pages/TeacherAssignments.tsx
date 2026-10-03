import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookMarked, Link2, Plus, Trash2 } from "lucide-react";
import { useClasses } from "../hooks/useApi";
import { useInvalidateTeachers, useSubjects, useTeacher, useTeacherAssignments } from "../hooks/useTeacherModule";
import { teacherService } from "../services/teacher.service";
import { subjectService } from "../services/subject.service";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { useToast } from "../components/ui/Toast";
import { currentAcademicYear } from "../utils/format";
import { cn } from "../utils/cn";
import type { TeachingAssignment } from "../types";

function toggle(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function TeacherAssignments() {
  const { teacherId = "" } = useParams();
  const teacher = useTeacher(teacherId);
  const assignments = useTeacherAssignments(teacherId);
  const subjects = useSubjects({ active: true });
  const classes = useClasses();
  const invalidate = useInvalidateTeachers();
  const { notify } = useToast();

  const [year, setYear] = useState(currentAcademicYear());
  const [subjectIds, setSubjectIds] = useState<Set<string>>(new Set());
  const [classIds, setClassIds] = useState<Set<string>>(new Set());
  const [newSubject, setNewSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<TeachingAssignment | null>(null);

  const yearClasses = useMemo(() => (classes.data ?? []).filter((c) => c.academicYear === year), [classes.data, year]);
  const existing = useMemo(() => new Set((assignments.data ?? []).map((a) => `${a.subject.id}|${a.class.id}|${a.academicYear}`)), [assignments.data]);
  const byYear = useMemo(() => {
    const groups = new Map<string, TeachingAssignment[]>();
    for (const a of assignments.data ?? []) groups.set(a.academicYear, [...(groups.get(a.academicYear) ?? []), a]);
    return [...groups].sort((a, b) => b[0].localeCompare(a[0]));
  }, [assignments.data]);

  const pairs = [...subjectIds].flatMap((s) => [...classIds].map((c) => ({ subjectId: s, classId: c })));
  const fresh = pairs.filter((p) => !existing.has(`${p.subjectId}|${p.classId}|${year}`));

  async function addSubject() {
    if (newSubject.trim().length < 2) return;
    setBusy(true);
    try {
      const s = await subjectService.create({ name: newSubject });
      await invalidate();
      setSubjectIds((set) => new Set(set).add(s.id));
      setNewSubject("");
      notify(`Matière « ${s.name} » créée`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await teacherService.createAssignments(teacherId, { academicYear: year, items: pairs });
      await invalidate();
      notify(`${res.created} affectation(s) créée(s)${res.skipped ? `, ${res.skipped} déjà existante(s)` : ""}`);
      setClassIds(new Set());
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  if (teacher.isLoading) return <LoadingState />;
  if (teacher.isError || !teacher.data) return <ErrorState message="Enseignant introuvable." onRetry={() => void teacher.refetch()} />;
  const t = teacher.data;

  return (
    <div className="space-y-6 pb-12">
      <div className="border-b border-slate-200/80 pb-4">
        <Link to="/admin/teachers" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} /> Enseignants
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold text-slate-900">
          <Link2 className="text-indigo-600" size={22} /> {t.firstName} {t.lastName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          L'enseignant n'accède qu'aux classes et matières affectées ici.{" "}
          {t.account ? (
            <>
              Identifiant : <span className="font-mono">{t.account.username}</span>
            </>
          ) : (
            <span className="font-semibold text-amber-700">Pas encore de compte de connexion.</span>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3" aria-labelledby="new-assignment">
          <h2 id="new-assignment" className="text-base font-bold text-slate-900">
            Nouvelles affectations
          </h2>
          <Input label="Année académique" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026-2027" className="max-w-40" />

          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Matière(s)</legend>
            {subjects.data && subjects.data.length === 0 ? <p className="text-sm text-slate-500">Aucune matière : créez-en une ci-dessous.</p> : null}
            <div className="flex flex-wrap gap-2">
              {(subjects.data ?? []).map((s) => (
                <label
                  key={s.id}
                  className={cn(
                    "cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-semibold",
                    subjectIds.has(s.id) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <input type="checkbox" className="sr-only" checked={subjectIds.has(s.id)} onChange={() => setSubjectIds((set) => toggle(set, s.id))} />
                  {s.name}
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                aria-label="Nouvelle matière"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addSubject();
                  }
                }}
                placeholder="Nouvelle matière (ex. Réseaux)"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => void addSubject()} disabled={newSubject.trim().length < 2 || busy}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
              <span>Classe(s) {year}</span>
              {yearClasses.length > 0 ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold normal-case text-indigo-600 hover:underline"
                  onClick={() => setClassIds(classIds.size === yearClasses.length ? new Set() : new Set(yearClasses.map((c) => c.id)))}
                >
                  {classIds.size === yearClasses.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              ) : null}
            </legend>
            {yearClasses.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune classe pour l'année {year}. <Link to="/classes" className="font-semibold text-indigo-600 hover:underline">Créer une classe</Link>
              </p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {yearClasses.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={classIds.has(c.id)} onChange={() => setClassIds((set) => toggle(set, c.id))} />
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span className="text-xs text-slate-400">{c.studentCount} élève(s)</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {pairs.length === 0
                ? "Sélectionnez au moins une matière et une classe."
                : `${fresh.length} nouvelle(s) affectation(s)${pairs.length - fresh.length ? `, ${pairs.length - fresh.length} déjà existante(s)` : ""}`}
            </p>
            <Button onClick={() => void save()} disabled={fresh.length === 0 || !/^\d{4}-\d{4}$/.test(year)} loading={busy}>
              Créer les affectations
            </Button>
          </div>
        </section>

        <section className="space-y-3 lg:col-span-2" aria-labelledby="current-assignments">
          <h2 id="current-assignments" className="text-base font-bold text-slate-900">
            Affectations actuelles
          </h2>
          {assignments.isLoading ? <LoadingState /> : null}
          {assignments.data && assignments.data.length === 0 ? (
            <EmptyState title="Aucune affectation" description="Cet enseignant ne voit encore aucune classe dans son espace." />
          ) : null}
          {byYear.map(([y, list]) => (
            <div key={y} className="rounded-2xl border border-slate-200 bg-white">
              <p className="border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase text-slate-500">{y}</p>
              <ul className="divide-y divide-slate-100">
                {list.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <BookMarked size={14} className="text-indigo-500" /> {a.subject.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {a.class.name}
                        {a.courseCount ? ` · ${a.courseCount} cours` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Retirer ${a.subject.name} en ${a.class.name}`}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                      onClick={() => setToDelete(a)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {t.account && !t.account.isActive ? <Badge tone="red" dot={false}>Compte désactivé</Badge> : null}
        </section>
      </div>

      {toDelete ? (
        <ConfirmDialog
          title="Retirer l'affectation"
          message={`${t.firstName} ${t.lastName} n'aura plus accès à ${toDelete.class.name} pour ${toDelete.subject.name}. Les appels déjà enregistrés sont conservés.`}
          confirmLabel="Retirer"
          pending={busy}
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            setBusy(true);
            void teacherService
              .deleteAssignment(teacherId, toDelete.id)
              .then(async () => {
                await invalidate();
                notify("Affectation retirée");
              })
              .catch((e: Error) => notify(e.message, "error"))
              .finally(() => {
                setBusy(false);
                setToDelete(null);
              });
          }}
        />
      ) : null}
    </div>
  );
}
