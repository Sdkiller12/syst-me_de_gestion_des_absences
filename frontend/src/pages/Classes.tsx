import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  FileSpreadsheet,
  Grid,
  List,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useClasses, useClassMutations } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { SearchInput } from "../components/ui/SearchInput";
import { Table } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { classSchema } from "../schemas";
import type { ClassInput } from "../schemas";

export function Classes() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");
  const debounced = useDebounce(search);
  const query = useClasses(debounced);
  const mutations = useClassMutations();
  const { notify } = useToast();
  const [modal, setModal] = useState<null | { id?: string; name: string; academicYear: string }>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassInput>({ resolver: zodResolver(classSchema) });

  function openCreate() {
    reset({ name: "", academicYear: "2025-2026" });
    setModal({ name: "", academicYear: "2025-2026" });
  }

  function openEdit(id: string, name: string, academicYear: string) {
    reset({ name, academicYear });
    setModal({ id, name, academicYear });
  }

  async function onSubmit(values: ClassInput) {
    try {
      if (modal?.id) {
        await mutations.update.mutateAsync({ id: modal.id, ...values });
        notify("Classe modifiée avec succès");
      } else {
        await mutations.create.mutateAsync(values);
        notify("Nouvelle classe créée");
      }
      setModal(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="text-indigo-600" size={24} />
            Gestion des Classes
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Gérez les promotions, les niveaux et consultez la répartition des étudiants inscrits par classe.
          </p>
        </div>

        <Button variant="gradient" onClick={openCreate}>
          <Plus size={18} /> Nouvelle classe
        </Button>
      </div>

      {/* Search and View Toggle Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une classe par nom ou année…" />

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("GRID")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === "GRID" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Grid size={15} /> Grille
          </button>
          <button
            type="button"
            onClick={() => setViewMode("TABLE")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === "TABLE" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <List size={15} /> Tableau
          </button>
        </div>
      </div>

      {query.isLoading ? <LoadingState label="Chargement des classes…" /> : null}
      {query.isError ? (
        <ErrorState message="Impossible de charger les classes." onRetry={() => void query.refetch()} />
      ) : null}

      {query.data && query.data.length === 0 ? (
        <EmptyState
          title="Aucune classe enregistrée"
          description="Créez votre première classe pour inscrire et importer des étudiants."
          action={<Button variant="primary" onClick={openCreate}><Plus size={16} /> Créer une classe</Button>}
        />
      ) : null}

      {/* Grid Mode Display */}
      {query.data && query.data.length > 0 && viewMode === "GRID" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((c) => (
            <div
              key={c.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-indigo-200"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 group-hover:scale-105 transition-transform">
                    <BookOpen size={20} />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {c.academicYear}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {c.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Users size={14} className="text-slate-400" />
                    <span>{c.studentCount} étudiant(s) inscrit(s)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(c.id, c.name, c.academicYear)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label={`Modifier ${c.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(c.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    aria-label={`Supprimer ${c.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/students/import?classId=${c.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <FileSpreadsheet size={14} /> Import
                  </Link>
                  <Link
                    to={`/classes/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Voir détail <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Table Mode Display */}
      {query.data && query.data.length > 0 && viewMode === "TABLE" ? (
        <Table headers={["Nom de Classe", "Année Académique", "Effectif Étudiants", "Actions"]}>
          {query.data.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-4 py-3 font-bold text-slate-900">
                <Link to={`/classes/${c.id}`} className="text-indigo-600 hover:underline">
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-xs font-semibold text-slate-600">{c.academicYear}</td>
              <td className="px-4 py-3 text-xs font-bold text-slate-800">{c.studentCount} étudiants</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => openEdit(c.id, c.name, c.academicYear)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                    onClick={() => setToDelete(c.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {/* Modal Creation & Edition */}
      {modal ? (
        <Modal title={modal.id ? "Modifier la classe" : "Créer une nouvelle classe"} onClose={() => setModal(null)}>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
            <Input label="Nom de la classe *" error={errors.name?.message} placeholder="ex: L2 Réseaux & Télécoms A" {...register("name")} />
            <Input label="Année académique *" placeholder="ex: 2025-2026" error={errors.academicYear?.message} {...register("academicYear")} />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setModal(null)}>
                Annuler
              </Button>
              <Button type="submit" loading={mutations.create.isPending || mutations.update.isPending}>
                Enregistrer la classe
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title="Supprimer la classe"
          message="Cette action est irréversible. La suppression de la classe détachera les étudiants rattachés."
          confirmLabel="Supprimer la classe"
          pending={mutations.remove.isPending}
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            void mutations.remove
              .mutateAsync(toDelete)
              .then(() => {
                notify("Classe supprimée avec succès");
                setToDelete(null);
              })
              .catch((e: Error) => notify(e.message, "error"));
          }}
        />
      ) : null}
    </div>
  );
}
