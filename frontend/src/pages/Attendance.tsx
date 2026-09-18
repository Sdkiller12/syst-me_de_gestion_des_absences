import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useClasses, useCourses, useSaveAttendance } from "../hooks/useApi";
import { studentService } from "../services/student.service";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  Save,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { SearchInput } from "../components/ui/SearchInput";
import { Select } from "../components/ui/Select";
import { useToast } from "../components/ui/Toast";
import { cn } from "../utils/cn";
import type { AttendanceStatus } from "../types";

export function Attendance() {
  const classes = useClasses();
  const [classId, setClassId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { notify } = useToast();
  const save = useSaveAttendance();

  const courses = useCourses(classId || undefined);
  const studentsQuery = useQuery({
    queryKey: ["students", "", classId],
    queryFn: () => studentService.list({ classId: classId || undefined }),
    enabled: !!classId,
  });

  useEffect(() => {
    if (classes.data && classes.data.length > 0 && !classId) setClassId(classes.data[0].id);
  }, [classes.data, classId]);

  useEffect(() => {
    if (courses.data && courses.data.length > 0 && !courseId) setCourseId(courses.data[0].id);
  }, [courses.data, courseId]);

  useEffect(() => {
    setCourseId("");
    setMarks({});
  }, [classId]);

  const students = useMemo(() => {
    const all = studentsQuery.data ?? [];
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter((s) => `${s.lastName} ${s.firstName}`.toLowerCase().includes(q));
  }, [studentsQuery.data, search]);

  function mark(id: string, status: AttendanceStatus) {
    setMarks((m) => ({ ...m, [id]: status }));
  }

  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    (studentsQuery.data ?? []).forEach((s) => {
      next[s.id] = status;
    });
    setMarks(next);
  }

  const effective = (id: string): AttendanceStatus => marks[id] ?? "PRESENT";

  const counts = useMemo(() => {
    const all = studentsQuery.data ?? [];
    const c: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0 };
    all.forEach((s) => {
      c[effective(s.id)]++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, studentsQuery.data]);

  const absents = useMemo(
    () => (studentsQuery.data ?? []).filter((s) => effective(s.id) === "ABSENT"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marks, studentsQuery.data]
  );

  async function handleSave() {
    if (!courseId) {
      notify("Sélectionnez un cours.", "error");
      return;
    }
    try {
      const records = (studentsQuery.data ?? []).map((s) => ({ studentId: s.id, status: effective(s.id) }));
      await save.mutateAsync({ courseId, records });
      notify(`Présences enregistrées avec succès (${counts.PRESENT} présents, ${counts.ABSENT} absents).`);
      if (absents.length > 0) setConfirmOpen(true);
      setMarks({});
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.", "error");
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="text-indigo-600" size={24} />
            Prise de Présence Directe
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Sélectionnez la classe et le cours pour saisir la feuille d'appel. L'enregistrement déclenche l'envoi de SMS automatiques aux parents d'absents.
          </p>
        </div>
      </div>

      {/* Control Bar: Class & Course Selector */}
      <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:grid-cols-3">
        <Select
          label="Classe Cible"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          options={[{ value: "", label: "Choisir une classe…" }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.academicYear})` }))]}
        />
        <Select
          label="Séance de Cours"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          options={[{ value: "", label: "Choisir un cours…" }, ...(courses.data ?? []).map((c) => ({ value: c.id, label: `${c.subject} (${c.startTime})` }))]}
        />
        <div className="flex items-end justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => markAll("PRESENT")} disabled={!studentsQuery.data?.length}>
            <CheckCircle2 size={15} className="text-emerald-600" /> Tout Présent
          </Button>
          <Button variant="secondary" size="sm" onClick={() => markAll("ABSENT")} disabled={!studentsQuery.data?.length}>
            <AlertTriangle size={15} className="text-rose-600" /> Tout Absent
          </Button>
        </div>
      </div>

      {!classId || !courseId ? (
        <EmptyState
          title="Sélectionnez une classe et un cours"
          description="Choisissez les paramètres ci-dessus pour charger la liste des étudiants et procéder à l'appel."
        />
      ) : studentsQuery.isLoading ? (
        <LoadingState label="Chargement de la liste d'appel…" />
      ) : studentsQuery.isError ? (
        <p className="text-sm font-semibold text-rose-600">Impossible de charger la liste. Vérifiez votre connexion Internet.</p>
      ) : students.length === 0 ? (
        <EmptyState
          title="Aucun étudiant inscrit dans cette classe"
          description="Vous n'avez pas encore inscrit d'étudiants. Utilisez le module d'importation Excel ou PDF."
        />
      ) : (
        <>
          {/* Real-time Summary Pills Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-md">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-white border border-white/10">
                <Users size={14} className="text-indigo-400" /> {studentsQuery.data?.length} Total
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-300 px-3 py-1 border border-emerald-500/30">
                <CheckCircle2 size={14} /> {counts.PRESENT} Présents
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 text-rose-300 px-3 py-1 border border-rose-500/30">
                <AlertTriangle size={14} /> {counts.ABSENT} Absents
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 text-amber-300 px-3 py-1 border border-amber-500/30">
                <Clock size={14} /> {counts.LATE} Retards
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 text-blue-300 px-3 py-1 border border-blue-500/30">
                <HelpCircle size={14} /> {counts.JUSTIFIED} Justifiés
              </span>
            </div>

            <Button
              variant="gradient"
              loading={save.isPending}
              onClick={() => void handleSave()}
              className="px-5 py-2"
            >
              <Save size={16} /> Enregistrer l'Appel
            </Button>
          </div>

          <SearchInput value={search} onChange={setSearch} placeholder="Filtrer par nom ou prénom d'étudiant…" />

          {/* Interactive Attendance Sheet Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5">#</th>
                    <th className="px-4 py-3.5">Étudiant</th>
                    <th className="px-4 py-3.5">Matricule</th>
                    <th className="px-4 py-3.5 text-center">Statut de Présence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s, idx) => {
                    const currentStatus = effective(s.id);
                    return (
                      <tr
                        key={s.id}
                        className={cn(
                          "transition-colors",
                          currentStatus === "ABSENT"
                            ? "bg-rose-50/30"
                            : currentStatus === "LATE"
                            ? "bg-amber-50/20"
                            : "hover:bg-slate-50/60"
                        )}
                      >
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {s.lastName} <span className="font-semibold text-slate-700">{s.firstName}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">{s.studentNumber || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => mark(s.id, "PRESENT")}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150",
                                currentStatus === "PRESENT"
                                  ? "bg-emerald-600 text-white shadow-xs scale-105"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              <CheckCircle2 size={14} /> Présent
                            </button>

                            <button
                              type="button"
                              onClick={() => mark(s.id, "ABSENT")}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150",
                                currentStatus === "ABSENT"
                                  ? "bg-rose-600 text-white shadow-xs scale-105"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              <AlertTriangle size={14} /> Absent
                            </button>

                            <button
                              type="button"
                              onClick={() => mark(s.id, "LATE")}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150",
                                currentStatus === "LATE"
                                  ? "bg-amber-500 text-white shadow-xs scale-105"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              <Clock size={14} /> Retard
                            </button>

                            <button
                              type="button"
                              onClick={() => mark(s.id, "JUSTIFIED")}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150",
                                currentStatus === "JUSTIFIED"
                                  ? "bg-blue-600 text-white shadow-xs scale-105"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              <HelpCircle size={14} /> Justifié
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal for SMS Notifications */}
      {confirmOpen ? (
        <Modal title="Présences enregistrées & SMS programmés" onClose={() => setConfirmOpen(false)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 font-medium">
              <Sparkles size={20} className="shrink-0 text-indigo-600" />
              <p>
                <strong>{absents.length} étudiant(s) absent(s)</strong>. Les notifications SMS d'absence ont été placées en file d'attente d'envoi automatique.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Destinataires des notifications</p>
              <ul className="max-h-48 space-y-1.5 overflow-auto text-xs">
                {absents.map((s) => (
                  <li key={s.id} className="flex justify-between items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-bold text-slate-900">{s.lastName} {s.firstName}</span>
                    <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {s.parentPhone || s.phone || "Non renseigné"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Fermer
              </Button>
              <Link to="/notifications">
                <Button variant="primary">
                  <Send size={15} /> Voir les SMS en cours
                </Button>
              </Link>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
