import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useClasses } from "../hooks/useApi";
import { useAuth } from "../hooks/AuthContext";
import { useSchoolAssignments, useTeacherList } from "../hooks/useTeacherModule";
import { useClassTimetable, useTeacherTimetableAdmin } from "../hooks/useGradesTimetable";
import { timetableService } from "../services/timetable.service";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { useToast } from "../components/ui/Toast";
import { TimetableView } from "../components/TimetableView";
import { DAYS, dayLabel } from "../utils/timetable";
import type { TimetableEntry } from "../types";

type Mode = "class" | "teacher";

interface SlotForm {
  id?: string;
  classId: string;
  className: string;
  assignment: string; // "subjectId|teacherId"
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
}

/** Créneau : la matière et l'enseignant se choisissent parmi les affectations de la classe */
function SlotModal({ form: initial, onClose, onSaved }: { form: SlotForm; onClose: () => void; onSaved: () => Promise<void> }) {
  const { notify } = useToast();
  const assignments = useSchoolAssignments(initial.classId);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof SlotForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Une même paire matière/enseignant peut exister sur plusieurs années : on la propose une fois
  const options = [
    ...new Map(
      (assignments.data ?? [])
        .filter((a) => a.teacher)
        .map((a) => [`${a.subject.id}|${a.teacher!.id}`, `${a.subject.name} — ${a.teacher!.fullName}`]),
    ),
  ].map(([value, label]) => ({ value, label }));

  const timeError = form.startTime && form.endTime && form.startTime >= form.endTime ? "La fin doit être après le début" : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.assignment || timeError || !form.startTime || !form.endTime) return;
    const [subjectId, teacherId] = form.assignment.split("|");
    const payload = { subjectId, teacherId, dayOfWeek: Number(form.dayOfWeek), startTime: form.startTime, endTime: form.endTime, room: form.room.trim() || null };
    setSaving(true);
    setError("");
    try {
      if (form.id) await timetableService.update(form.id, payload);
      else await timetableService.create({ ...payload, classId: form.classId });
      await onSaved();
      notify(form.id ? "Créneau modifié" : "Créneau ajouté");
      onClose();
    } catch (err) {
      // Les conflits (classe, enseignant, salle) sont détectés par le serveur
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`${form.id ? "Modifier le créneau" : "Nouveau créneau"} · ${form.className}`} onClose={onClose}>
      {assignments.isLoading ? <LoadingState /> : null}
      {assignments.data && options.length === 0 ? (
        <EmptyState
          title="Aucune affectation"
          description="Aucun enseignant n'est affecté à cette classe. Affectez d'abord les enseignants à leurs matières pour cette classe."
          action={
            <Link to="/admin/teachers">
              <Button size="sm">Gérer les enseignants</Button>
            </Link>
          }
        />
      ) : null}
      {options.length > 0 ? (
        <form className="space-y-3" onSubmit={(e) => void submit(e)} noValidate>
          <Select
            label="Matière et enseignant"
            value={form.assignment}
            onChange={set("assignment")}
            options={[{ value: "", label: "Choisir…" }, ...options]}
            error={!form.assignment && error ? "Requis" : undefined}
          />
          <Select label="Jour" value={form.dayOfWeek} onChange={set("dayOfWeek")} options={DAYS.map((d) => ({ value: String(d.value), label: d.label }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Début" type="time" value={form.startTime} onChange={set("startTime")} required />
            <Input label="Fin" type="time" value={form.endTime} onChange={set("endTime")} error={timeError || undefined} required />
          </div>
          <Input label="Salle (facultative)" placeholder="Salle 12" value={form.room} onChange={set("room")} maxLength={50} />
          {error ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={saving} disabled={!form.assignment || !!timeError}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

export function AdminTimetable() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const classes = useClasses();
  const teachers = useTeacherList({});
  const [mode, setMode] = useState<Mode>("class");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [editing, setEditing] = useState<SlotForm | null>(null);
  const [toDelete, setToDelete] = useState<TimetableEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const byClass = useClassTimetable(mode === "class" ? classId : "");
  const byTeacher = useTeacherTimetableAdmin(mode === "teacher" ? teacherId : "");
  const current = mode === "class" ? byClass : byTeacher;
  const selectedClass = (classes.data ?? []).find((c) => c.id === classId);

  const refresh = () => qc.invalidateQueries({ queryKey: ["timetable"] });

  function openNew() {
    if (!selectedClass) return;
    setEditing({ classId: selectedClass.id, className: selectedClass.name, assignment: "", dayOfWeek: "1", startTime: "08:00", endTime: "10:00", room: "" });
  }

  function openEdit(e: TimetableEntry) {
    setEditing({
      id: e.id,
      classId: e.class.id,
      className: e.class.name,
      assignment: `${e.subject.id}|${e.teacher.id}`,
      dayOfWeek: String(e.dayOfWeek),
      startTime: e.startTime,
      endTime: e.endTime,
      room: e.room ?? "",
    });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await timetableService.remove(toDelete.id);
      await refresh();
      notify("Créneau supprimé");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Suppression impossible", "error");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  function copyPublicLink() {
    if (!user?.schoolId) return;
    void navigator.clipboard.writeText(`${window.location.origin}/schools/${user.schoolId}/timetable`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const actions = (e: TimetableEntry) => (
    <div className="-mr-1 -mt-1 flex shrink-0">
      <button type="button" aria-label={`Modifier ${e.subject.name} ${dayLabel(e.dayOfWeek)} ${e.startTime}`} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => openEdit(e)}>
        <Pencil size={14} />
      </button>
      <button type="button" aria-label={`Supprimer ${e.subject.name} ${dayLabel(e.dayOfWeek)} ${e.startTime}`} className="rounded-lg p-1 text-rose-600 hover:bg-rose-50" onClick={() => setToDelete(e)}>
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <CalendarDays className="text-indigo-600" size={22} /> Emploi du temps
          </h1>
          <p className="mt-1 text-sm text-slate-500">Créneaux hebdomadaires des classes. Les conflits de classe, d'enseignant et de salle sont refusés.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyPublicLink} title="Lien de consultation sans compte, à communiquer aux élèves">
            {copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? "Lien copié" : "Lien pour les élèves"}
          </Button>
          {mode === "class" ? (
            <Button onClick={openNew} disabled={!selectedClass}>
              <Plus size={16} /> Ajouter un créneau
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Affichage" className="flex gap-2">
          <Button role="tab" aria-selected={mode === "class"} size="sm" variant={mode === "class" ? "primary" : "outline"} onClick={() => setMode("class")}>
            Par classe
          </Button>
          <Button role="tab" aria-selected={mode === "teacher"} size="sm" variant={mode === "teacher" ? "primary" : "outline"} onClick={() => setMode("teacher")}>
            Par enseignant
          </Button>
        </div>
        <div className="w-full sm:w-72">
          {mode === "class" ? (
            <Select
              aria-label="Classe"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              options={[{ value: "", label: "Choisir une classe" }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.academicYear})` }))]}
            />
          ) : (
            <Select
              aria-label="Enseignant"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              options={[{ value: "", label: "Choisir un enseignant" }, ...(teachers.data?.data ?? []).map((t) => ({ value: t.id, label: t.fullName }))]}
            />
          )}
        </div>
      </div>

      {(mode === "class" ? !classId : !teacherId) ? (
        <EmptyState
          title={mode === "class" ? "Choisissez une classe" : "Choisissez un enseignant"}
          description={mode === "class" ? "Sélectionnez une classe pour consulter et construire son emploi du temps." : "Sélectionnez un enseignant pour consulter son emploi du temps."}
        />
      ) : null}
      {current.isLoading ? <LoadingState /> : null}
      {current.isError ? <ErrorState message="Impossible de charger l'emploi du temps." onRetry={() => void current.refetch()} /> : null}
      {current.data && current.data.entries.length === 0 ? (
        <EmptyState
          title="Aucun créneau"
          description={mode === "class" ? "Cette classe n'a encore aucun cours programmé." : "Aucun cours n'est programmé pour cet enseignant."}
          action={mode === "class" ? <Button onClick={openNew}>Ajouter un créneau</Button> : undefined}
        />
      ) : null}
      {current.data && current.data.entries.length > 0 ? (
        <TimetableView entries={current.data.entries} show={mode === "class" ? "teacher" : "class"} renderActions={actions} />
      ) : null}

      {editing ? <SlotModal form={editing} onClose={() => setEditing(null)} onSaved={refresh} /> : null}
      {toDelete ? (
        <ConfirmDialog
          title="Supprimer le créneau"
          message={`${toDelete.subject.name} (${toDelete.class.name}) le ${dayLabel(toDelete.dayOfWeek).toLowerCase()} de ${toDelete.startTime} à ${toDelete.endTime} sera retiré de l'emploi du temps.`}
          confirmLabel="Supprimer"
          pending={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
