import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import {
  BookMarked,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { useTeacherList, useTeacherStats, useInvalidateTeachers } from "../hooks/useTeacherModule";
import { teacherService } from "../services/teacher.service";
import { useDebounce } from "../hooks/useDebounce";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { SearchInput } from "../components/ui/SearchInput";
import { StatCard } from "../components/ui/StatCard";
import { Table } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { CredentialsDialog } from "../components/CredentialsDialog";
import { teacherSchema } from "../schemas";
import type { TeacherInput } from "../schemas";
import type { IssuedCredentials, Teacher } from "../types";

type AccountFilter = "" | "none" | "active" | "disabled";

function AccountBadge({ t }: { t: Teacher }) {
  if (!t.account) return <Badge tone="slate" dot={false}>Non configuré</Badge>;
  if (!t.account.isActive) return <Badge tone="red" dot={false}>Désactivé</Badge>;
  if (t.account.mustChangePassword) return <Badge tone="amber" dot={false}>1re connexion attendue</Badge>;
  return <Badge tone="green" dot={false}>Actif</Badge>;
}

const iconBtn = "rounded-lg p-1.5 transition-colors disabled:opacity-40";

export function Teachers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState<AccountFilter>("");
  const debounced = useDebounce(search);
  const list = useTeacherList({ search: debounced || undefined, account: account || undefined });
  const stats = useTeacherStats();
  const invalidate = useInvalidateTeachers();
  const { notify } = useToast();

  const [editing, setEditing] = useState<Teacher | "new" | null>(null);
  const [credentials, setCredentials] = useState<{ title: string; list: IssuedCredentials[] } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<TeacherInput>({ resolver: zodResolver(teacherSchema) });

  function openForm(t: Teacher | "new") {
    form.reset(
      t === "new"
        ? { firstName: "", lastName: "", phone: "", email: "", employeeNumber: "" }
        : { firstName: t.firstName, lastName: t.lastName, phone: t.phone ?? "", email: t.email ?? "", employeeNumber: t.employeeNumber ?? "" },
    );
    setEditing(t);
  }

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const out = await action();
      await invalidate();
      if (success) notify(success);
      return out;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(values: TeacherInput) {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone || null,
      email: values.email || null,
      employeeNumber: values.employeeNumber || null,
    };
    const saved = await run(
      () => (editing && editing !== "new" ? teacherService.update(editing.id, payload) : teacherService.create(payload)),
      editing === "new" ? "Enseignant enregistré" : "Fiche mise à jour",
    );
    if (saved) setEditing(null);
  }

  async function createMissingAccounts() {
    const res = await run(() => teacherService.createAccounts());
    if (res) setCredentials({ title: `${res.created.length} compte(s) créé(s)`, list: res.created });
  }

  const teachers = list.data?.data ?? [];
  const s = stats.data;
  const filtering = !!debounced || !!account;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <GraduationCap className="text-indigo-600" size={24} /> Enseignants
          </h1>
          <p className="mt-1 text-sm text-slate-500">Profils, comptes d'accès et affectations pédagogiques de votre établissement.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/subjects")}>
            <BookMarked size={16} /> Matières
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/teachers/import?format=excel")}>
            <FileSpreadsheet size={16} /> Importer Excel
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/teachers/import?format=pdf")}>
            <FileText size={16} /> Importer PDF
          </Button>
          <Button onClick={() => openForm("new")}>
            <Plus size={16} /> Ajouter un enseignant
          </Button>
        </div>
      </div>

      {s && s.total > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total enseignants" value={s.total} icon={Users} color="indigo" />
          <StatCard label="Comptes actifs" value={s.activeAccounts} icon={UserCheck} color="emerald" hint={s.pendingFirstLogin ? `dont ${s.pendingFirstLogin} en attente de 1re connexion` : undefined} />
          <StatCard label="Comptes non configurés" value={s.withoutAccount} icon={UserPlus} color="amber" />
          <StatCard label="Sans affectation" value={s.withoutAssignment} icon={Link2} color="rose" hint={s.disabledAccounts ? `${s.disabledAccounts} compte(s) désactivé(s)` : undefined} />
        </div>
      ) : null}

      {s && s.withoutAccount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {s.withoutAccount} enseignant(s) n'ont pas encore de compte de connexion.
          </p>
          <Button size="sm" onClick={() => void createMissingAccounts()} loading={busy}>
            <KeyRound size={14} /> Créer les comptes des enseignants
          </Button>
        </div>
      ) : null}

      {(s?.total ?? 0) > 0 || filtering ? (
        <div className="flex flex-wrap gap-3">
          <div className="min-w-0 flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Nom, email, matricule, identifiant…" />
          </div>
          <select
            aria-label="Filtrer par compte"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={account}
            onChange={(e) => setAccount(e.target.value as AccountFilter)}
          >
            <option value="">Tous les comptes</option>
            <option value="active">Comptes actifs</option>
            <option value="none">Non configurés</option>
            <option value="disabled">Désactivés</option>
          </select>
        </div>
      ) : null}

      {list.isLoading ? <LoadingState /> : null}
      {list.isError ? <ErrorState message="Impossible de charger les enseignants." onRetry={() => void list.refetch()} /> : null}

      {list.data && teachers.length === 0 && !filtering ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <GraduationCap className="mx-auto text-indigo-500" size={32} />
          <p className="mt-3 text-base font-bold text-slate-900">Aucun enseignant enregistré.</p>
          <p className="mt-1 text-sm text-slate-500">Importez la liste de vos enseignants (Excel ou PDF) ou ajoutez-les un par un.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate("/admin/teachers/import")}>
              <FileSpreadsheet size={16} /> Importer des enseignants
            </Button>
            <Button variant="outline" onClick={() => openForm("new")}>
              <Plus size={16} /> Ajouter un enseignant
            </Button>
          </div>
        </div>
      ) : null}
      {list.data && teachers.length === 0 && filtering ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Aucun enseignant ne correspond à ces critères.</p>
      ) : null}

      {teachers.length > 0 ? (
        <Table headers={["Enseignant", "Matières", "Classes", "Compte", "Statut", "Actions"]}>
          {teachers.map((t) => (
            <tr key={t.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-bold text-slate-900">
                  {t.lastName} {t.firstName}
                </p>
                <p className="text-xs text-slate-500">{[t.employeeNumber, t.phone, t.email].filter(Boolean).join(" · ") || "—"}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-56 flex-wrap gap-1">
                  {t.subjects.length ? t.subjects.map((sub) => <Badge key={sub.id} tone="indigo" dot={false}>{sub.name}</Badge>) : <span className="text-xs text-slate-400">—</span>}
                </div>
              </td>
              <td className="px-4 py-3">
                <Link to={`/admin/teachers/${t.id}/assignments`} className="text-sm font-semibold text-indigo-600 hover:underline">
                  {t.classCount} classe(s)
                </Link>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.account?.username ?? "—"}</td>
              <td className="px-4 py-3">
                <AccountBadge t={t} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-0.5">
                  <Link to={`/admin/teachers/${t.id}/assignments`} aria-label={`Affectations de ${t.fullName}`} title="Voir les affectations" className={`${iconBtn} text-indigo-600 hover:bg-indigo-50`}>
                    <Link2 size={16} />
                  </Link>
                  <button type="button" aria-label={`Modifier ${t.fullName}`} title="Modifier" className={`${iconBtn} text-slate-600 hover:bg-slate-100`} onClick={() => openForm(t)}>
                    <Pencil size={16} />
                  </button>
                  {!t.account ? (
                    <button
                      type="button"
                      aria-label={`Créer le compte de ${t.fullName}`}
                      title="Créer le compte"
                      disabled={busy}
                      className={`${iconBtn} text-emerald-600 hover:bg-emerald-50`}
                      onClick={() =>
                        void run(() => teacherService.createAccount(t.id)).then((c) => c && setCredentials({ title: "Compte créé", list: [c] }))
                      }
                    >
                      <UserPlus size={16} />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label={`Réinitialiser le mot de passe de ${t.fullName}`}
                        title="Réinitialiser le mot de passe"
                        className={`${iconBtn} text-amber-600 hover:bg-amber-50`}
                        onClick={() =>
                          setConfirm({
                            title: "Réinitialiser le mot de passe",
                            message: `Un nouveau mot de passe temporaire sera généré pour ${t.fullName}. Ses sessions ouvertes seront fermées.`,
                            label: "Réinitialiser",
                            run: async () => {
                              const c = await run(() => teacherService.resetPassword(t.id));
                              if (c) setCredentials({ title: "Mot de passe réinitialisé", list: [c] });
                            },
                          })
                        }
                      >
                        <KeyRound size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${t.account.isActive ? "Désactiver" : "Activer"} le compte de ${t.fullName}`}
                        title={t.account.isActive ? "Désactiver le compte" : "Activer le compte"}
                        className={`${iconBtn} ${t.account.isActive ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                        onClick={() =>
                          t.account!.isActive
                            ? setConfirm({
                                title: "Désactiver le compte",
                                message: `${t.fullName} ne pourra plus se connecter. Ses présences déjà enregistrées sont conservées.`,
                                label: "Désactiver",
                                run: async () => void (await run(() => teacherService.setAccountStatus(t.id, false), "Compte désactivé")),
                              })
                            : void run(() => teacherService.setAccountStatus(t.id, true), "Compte réactivé")
                        }
                      >
                        {t.account.isActive ? <UserX size={16} /> : <Power size={16} />}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label={`Supprimer ${t.fullName}`}
                    title="Supprimer"
                    className={`${iconBtn} text-rose-600 hover:bg-rose-50`}
                    onClick={() =>
                      setConfirm({
                        title: "Supprimer l'enseignant",
                        message: `La fiche de ${t.fullName}, son compte et ses affectations seront supprimés. Impossible s'il a déjà fait des appels : désactivez alors son compte.`,
                        label: "Supprimer",
                        run: async () => void (await run(() => teacherService.remove(t.id), "Enseignant supprimé")),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {editing ? (
        <Modal title={editing === "new" ? "Ajouter un enseignant" : `Modifier ${editing.fullName}`} onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nom" error={form.formState.errors.lastName?.message} {...form.register("lastName")} />
              <Input label="Prénom" error={form.formState.errors.firstName?.message} {...form.register("firstName")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Téléphone" placeholder="0707070707" error={form.formState.errors.phone?.message} {...form.register("phone")} />
              <Input label="Matricule enseignant" error={form.formState.errors.employeeNumber?.message} {...form.register("employeeNumber")} />
            </div>
            <Input label="Email professionnel" type="email" hint="Facultatif. Il pourra aussi servir d'identifiant de connexion." error={form.formState.errors.email?.message} {...form.register("email")} />
            <p className="text-xs text-slate-500">
              Le compte de connexion se crée ensuite depuis la liste : un identifiant et un mot de passe temporaire seront générés.
            </p>
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

      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          pending={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void confirm.run().finally(() => setConfirm(null))}
        />
      ) : null}

      {credentials ? <CredentialsDialog title={credentials.title} credentials={credentials.list} onClose={() => setCredentials(null)} /> : null}
    </div>
  );
}
