import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useTeachers } from "../hooks/useApi";
import { teacherService } from "../services/teacher.service";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { SearchInput } from "../components/ui/SearchInput";
import { Table } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { teacherSchema } from "../schemas";
import type { TeacherInput } from "../schemas";
import { useDebounce } from "../hooks/useDebounce";

export function Teachers() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const query = useTeachers(debounced);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { notify } = useToast();
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TeacherInput>({ resolver: zodResolver(teacherSchema) });

  async function onSubmit(values: TeacherInput) {
    setPending(true);
    try {
      await teacherService.create(values);
      await qc.invalidateQueries({ queryKey: ["teachers"] });
      notify("Enseignant créé");
      setOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Enseignants</h1>
          <p className="text-sm text-[#64748B]">Comptes réels de votre établissement.</p>
        </div>
        <Button onClick={() => { reset({ firstName: "", lastName: "", email: "", password: "", phone: "" }); setOpen(true); }}>
          <Plus size={16} /> Nouvel enseignant
        </Button>
      </div>
      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un enseignant…" />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message="Impossible de charger les enseignants." onRetry={() => void query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title="Aucun enseignant" description="Créez le premier compte enseignant de votre école." action={<Button onClick={() => setOpen(true)}>Créer un enseignant</Button>} />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <Table headers={["Nom", "Email", "Téléphone", "Statut", "Actions"]}>
          {query.data.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-2 font-medium">{t.lastName} {t.firstName}</td>
              <td className="px-4 py-2">{t.email}</td>
              <td className="px-4 py-2">{t.phone ?? "—"}</td>
              <td className="px-4 py-2"><Badge tone={t.isActive ? "green" : "slate"}>{t.isActive ? "Actif" : "Inactif"}</Badge></td>
              <td className="px-4 py-2">
                <button type="button" aria-label={`Supprimer ${t.email}`} className="rounded p-1 text-[#DC2626] hover:bg-red-50" onClick={() => setToDelete(t.id)}>
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {open ? (
        <Modal title="Nouvel enseignant" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Prénom" error={errors.firstName?.message} {...register("firstName")} />
              <Input label="Nom" error={errors.lastName?.message} {...register("lastName")} />
            </div>
            <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
            <Input label="Mot de passe (8 caractères min)" type="password" error={errors.password?.message} {...register("password")} />
            <Input label="Téléphone" error={errors.phone?.message} {...register("phone")} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" loading={pending}>Créer</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title="Supprimer l'enseignant"
          message="Le compte sera définitivement supprimé."
          confirmLabel="Supprimer"
          pending={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            setDeleting(true);
            void teacherService.remove(toDelete).then(() => {
              notify("Enseignant supprimé");
              setToDelete(null);
              void qc.invalidateQueries({ queryKey: ["teachers"] });
            }).catch((e: Error) => notify(e.message, "error")).finally(() => setDeleting(false));
          }}
        />
      ) : null}
    </div>
  );
}
