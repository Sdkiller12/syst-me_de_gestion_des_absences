import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, RotateCcw, Trash2, Upload, UserPlus } from "lucide-react";
import { useClasses, useStudentMutations, useStudents } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { CredentialsDialog } from "../components/CredentialsDialog";
import { studentService } from "../services/student.service";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { Select } from "../components/ui/Select";
import { Table } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { studentSchema } from "../schemas";
import type { StudentInput } from "../schemas";
import type { IssuedCredentials, Student } from "../types";

const PAGE_SIZE = 15;

export function Students() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState(params.get("classId") ?? "");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | { id?: string; values: StudentInput }>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const debounced = useDebounce(search);
  const query = useStudents({ search: debounced, classId: classId || undefined });
  const classes = useClasses();
  const mutations = useStudentMutations();
  const { notify } = useToast();
  const qc = useQueryClient();
  const [credentials, setCredentials] = useState<{ title: string; list: IssuedCredentials[] } | null>(null);
  const [accountBusy, setAccountBusy] = useState<string | null>(null);

  /** Comptes de l'espace étudiant : identifiants affichés une seule fois à l'administrateur */
  async function issue(key: string, title: string, action: () => Promise<IssuedCredentials[]>) {
    setAccountBusy(key);
    try {
      const list = await action();
      await qc.invalidateQueries({ queryKey: ["students"] });
      setCredentials({ title, list });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setAccountBusy(null);
    }
  }

  function accountBadge(s: Student) {
    if (!s.account) return <Badge tone="slate" dot={false}>Aucun</Badge>;
    if (s.account.mustChangePassword) return <Badge tone="amber" dot={false}>1re connexion</Badge>;
    return <Badge tone={s.account.isActive ? "green" : "red"} dot={false}>{s.account.isActive ? "Actif" : "Désactivé"}</Badge>;
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.length ?? 0) / PAGE_SIZE));
  const pageData = useMemo(
    () => (query.data ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [query.data, page],
  );

  function openCreate() {
    reset({ firstName: "", lastName: "", phone: "", classId: classId || classes.data?.[0]?.id || "" });
    setModal({ values: { firstName: "", lastName: "", phone: "", classId: "" } });
  }

  function openEdit(id: string, v: StudentInput) {
    reset(v);
    setModal({ id, values: v });
  }

  async function onSubmit(values: StudentInput) {
    try {
      if (modal?.id) {
        await mutations.update.mutateAsync({ id: modal.id, ...values });
        notify("Étudiant modifié");
      } else {
        await mutations.create.mutateAsync(values);
        notify("Étudiant ajouté");
      }
      setModal(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Étudiants</h1>
        <div className="flex flex-wrap gap-2">
          {classId ? (
            <Button
              variant="outline"
              loading={accountBusy === "bulk"}
              onClick={() => void issue("bulk", "Comptes élèves créés", async () => (await studentService.createAccounts({ classId })).created)}
              title="Crée un compte pour chaque élève de la classe qui n'en a pas encore"
            >
              <UserPlus size={16} /> Comptes de la classe
            </Button>
          ) : null}
          <Link to="/students/import">
            <Button variant="secondary">
              <Upload size={16} /> Importer (Excel / PDF)
            </Button>
          </Link>
          <Button onClick={openCreate}>
            <Plus size={16} /> Ajouter
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher un étudiant…" />
        <select
          aria-label="Filtrer par classe"
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setParams(e.target.value ? { classId: e.target.value } : {}); setPage(1); }}
        >
          <option value="">Toutes les classes</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message="Impossible de charger les étudiants." onRetry={() => void query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title="Aucun étudiant" description="Ajoutez un étudiant ou importez un fichier Excel." action={<Button onClick={openCreate}>Ajouter un étudiant</Button>} />
      ) : null}
      {pageData.length > 0 ? (
        <>
          <Table headers={["Nom", "Prénom", "Téléphone", "Classe", "Compte élève", "Actions"]}>
            {pageData.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">
                  <Link to={`/students/${s.id}`} className="font-medium text-[#2563EB] hover:underline">{s.lastName}</Link>
                </td>
                <td className="px-4 py-2">{s.firstName}</td>
                <td className="px-4 py-2">{s.phone}</td>
                <td className="px-4 py-2">{s.className}</td>
                <td className="px-4 py-2">
                  {accountBadge(s)}
                  {s.account?.username ? <p className="mt-0.5 font-mono text-[11px] text-slate-500">{s.account.username}</p> : null}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    {s.account ? (
                      <button type="button" aria-label={`Réinitialiser le mot de passe de ${s.lastName}`} title="Réinitialiser le mot de passe" disabled={accountBusy === s.id} className="rounded p-1 text-amber-600 hover:bg-amber-50 disabled:opacity-50" onClick={() => void issue(s.id, "Nouveau mot de passe temporaire", async () => [await studentService.resetPassword(s.id)])}>
                        <RotateCcw size={16} />
                      </button>
                    ) : (
                      <button type="button" aria-label={`Créer le compte de ${s.lastName}`} title="Créer le compte élève" disabled={accountBusy === s.id} className="rounded p-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50" onClick={() => void issue(s.id, "Compte élève créé", async () => [await studentService.createAccount(s.id)])}>
                        <KeyRound size={16} />
                      </button>
                    )}
                    <button type="button" aria-label={`Modifier ${s.lastName}`} className="rounded p-1 hover:bg-slate-100" onClick={() => openEdit(s.id, { firstName: s.firstName, lastName: s.lastName, phone: s.phone, classId: s.classId })}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" aria-label={`Supprimer ${s.lastName}`} className="rounded p-1 text-[#DC2626] hover:bg-red-50" onClick={() => setToDelete(s.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      ) : null}

      {modal ? (
        <Modal title={modal.id ? "Modifier l'étudiant" : "Ajouter un étudiant"} onClose={() => setModal(null)}>
          <form className="space-y-3" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
            <Input label="Nom" error={errors.lastName?.message} {...register("lastName")} />
            <Input label="Prénom" error={errors.firstName?.message} {...register("firstName")} />
            <Input label="Téléphone" placeholder="0700000000" error={errors.phone?.message} {...register("phone")} />
            <Select label="Classe" error={errors.classId?.message} options={[{ value: "", label: "Choisir…" }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} {...register("classId")} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setModal(null)}>Annuler</Button>
              <Button type="submit" loading={mutations.create.isPending || mutations.update.isPending}>Enregistrer</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {credentials ? (
        <CredentialsDialog audience="student" title={credentials.title} credentials={credentials.list} onClose={() => setCredentials(null)} />
      ) : null}

      {toDelete ? (
        <ConfirmDialog title="Supprimer l'étudiant" message="Cette action est irréversible." confirmLabel="Supprimer" pending={mutations.remove.isPending} onCancel={() => setToDelete(null)} onConfirm={() => { void mutations.remove.mutateAsync(toDelete).then(() => { notify("Étudiant supprimé"); setToDelete(null); }).catch((e: Error) => notify(e.message, "error")); }} />
      ) : null}
    </div>
  );
}
