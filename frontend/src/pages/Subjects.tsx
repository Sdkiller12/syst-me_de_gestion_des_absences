import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ArrowLeft, BookMarked, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useInvalidateTeachers, useSubjects } from "../hooks/useTeacherModule";
import { subjectService } from "../services/subject.service";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { Table } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { subjectSchema } from "../schemas";
import type { SubjectInput } from "../schemas";
import type { Subject } from "../types";

export function Subjects() {
  const subjects = useSubjects();
  const invalidate = useInvalidateTeachers();
  const { notify } = useToast();
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<SubjectInput>({ resolver: zodResolver(subjectSchema) });

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      await invalidate();
      notify(message);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function open(s: Subject | "new") {
    form.reset(s === "new" ? { name: "", code: "", description: "" } : { name: s.name, code: s.code ?? "", description: s.description ?? "" });
    setEditing(s);
  }

  async function onSubmit(v: SubjectInput) {
    const payload = { name: v.name, code: v.code || null, description: v.description || null };
    const ok = await run(
      () => (editing && editing !== "new" ? subjectService.update(editing.id, payload) : subjectService.create(payload)),
      editing === "new" ? "Matière créée" : "Matière mise à jour",
    );
    if (ok) setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <Link to="/admin/teachers" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft size={14} /> Enseignants
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <BookMarked className="text-indigo-600" size={22} /> Matières
          </h1>
          <p className="mt-1 text-sm text-slate-500">Les matières enseignées dans votre établissement, utilisées pour les affectations.</p>
        </div>
        <Button onClick={() => open("new")}>
          <Plus size={16} /> Nouvelle matière
        </Button>
      </div>

      {subjects.isLoading ? <LoadingState /> : null}
      {subjects.isError ? <ErrorState message="Impossible de charger les matières." onRetry={() => void subjects.refetch()} /> : null}
      {subjects.data && subjects.data.length === 0 ? (
        <EmptyState
          title="Aucune matière enregistrée"
          description="Créez vos matières ici, ou importez vos enseignants : les matières du fichier seront créées automatiquement."
          action={<Button onClick={() => open("new")}>Créer une matière</Button>}
        />
      ) : null}
      {subjects.data && subjects.data.length > 0 ? (
        <Table headers={["Matière", "Code", "Affectations", "Statut", "Actions"]}>
          {subjects.data.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-slate-900">{s.name}</p>
                {s.description ? <p className="text-xs text-slate-500">{s.description}</p> : null}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{s.code ?? "—"}</td>
              <td className="px-4 py-3">{s.assignmentCount}</td>
              <td className="px-4 py-3">
                <Badge tone={s.isActive ? "green" : "slate"} dot={false}>{s.isActive ? "Active" : "Désactivée"}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-0.5">
                  <button type="button" aria-label={`Modifier ${s.name}`} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" onClick={() => open(s)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${s.isActive ? "Désactiver" : "Activer"} ${s.name}`}
                    title={s.isActive ? "Désactiver" : "Activer"}
                    className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                    onClick={() => void run(() => subjectService.update(s.id, { isActive: !s.isActive }), s.isActive ? "Matière désactivée" : "Matière activée")}
                  >
                    <Power size={16} />
                  </button>
                  <button type="button" aria-label={`Supprimer ${s.name}`} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" onClick={() => setToDelete(s)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {editing ? (
        <Modal title={editing === "new" ? "Nouvelle matière" : `Modifier ${editing.name}`} onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} noValidate>
            <Input label="Nom" placeholder="Mathématiques" error={form.formState.errors.name?.message} {...form.register("name")} />
            <Input label="Code (facultatif)" placeholder="MATH" error={form.formState.errors.code?.message} {...form.register("code")} />
            <Input label="Description (facultative)" error={form.formState.errors.description?.message} {...form.register("description")} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
                Annuler
              </Button>
              <Button type="submit" loading={busy}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title="Supprimer la matière"
          message={
            toDelete.assignmentCount > 0
              ? `« ${toDelete.name} » est utilisée dans ${toDelete.assignmentCount} affectation(s) : elle ne peut pas être supprimée. Désactivez-la plutôt.`
              : `« ${toDelete.name} » sera définitivement supprimée.`
          }
          confirmLabel="Supprimer"
          pending={busy}
          onCancel={() => setToDelete(null)}
          onConfirm={() => void run(() => subjectService.remove(toDelete.id), "Matière supprimée").finally(() => setToDelete(null))}
        />
      ) : null}
    </div>
  );
}
