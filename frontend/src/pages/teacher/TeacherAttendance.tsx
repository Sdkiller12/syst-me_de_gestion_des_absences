import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCheck, CheckCircle2, ClipboardCheck, Keyboard, MessageSquare, Save } from "lucide-react";
import { useAttendanceSheet, useTeacherDashboard, useTeacherMe } from "../../hooks/useTeacherModule";
import { teacherSpaceService } from "../../services/teacherSpace.service";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../utils/cn";
import type { AttendanceCounts, AttendanceSheet, AttendanceStatus } from "../../types";
import { CourseCard } from "./CourseCard";

const OPTIONS: Array<{ status: AttendanceStatus; label: string; key: string; on: string }> = [
  { status: "PRESENT", label: "Présent", key: "P", on: "bg-emerald-600 text-white border-emerald-600" },
  { status: "ABSENT", label: "Absent", key: "A", on: "bg-rose-600 text-white border-rose-600" },
  { status: "LATE", label: "En retard", key: "R", on: "bg-amber-500 text-white border-amber-500" },
  { status: "JUSTIFIED", label: "Justifié", key: "J", on: "bg-sky-600 text-white border-sky-600" },
];
const KEY_TO_STATUS: Record<string, AttendanceStatus> = { p: "PRESENT", a: "ABSENT", r: "LATE", j: "JUSTIFIED" };

/** Choix de la séance quand aucune n'est indiquée dans l'URL */
function SessionPicker() {
  const me = useTeacherMe();
  const dash = useTeacherDashboard();
  if (me.isLoading) return <LoadingState />;
  const pending = (dash.data?.todayCourses ?? []).filter((c) => !c.attendanceTaken);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Faire l'appel</h1>
        <p className="text-sm text-slate-500">Choisissez un cours planifié ou une de vos classes.</p>
      </div>
      {pending.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Cours d'aujourd'hui à faire</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Nouvelle séance</h2>
        {me.data && me.data.assignments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center text-sm text-slate-500">Aucune classe ne vous est affectée.</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {(me.data?.assignments ?? []).map((a) => (
            <Link
              key={a.id}
              to={`/teacher/attendance?assignmentId=${a.id}`}
              className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-white p-4 hover:border-emerald-300"
            >
              <span>
                <span className="block text-sm font-bold text-slate-900">{a.subject.name}</span>
                <span className="block text-sm text-emerald-700">{a.class.name}</span>
              </span>
              <ClipboardCheck className="text-emerald-600" size={20} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TeacherAttendance() {
  const [params] = useSearchParams();
  const courseId = params.get("courseId") ?? undefined;
  const assignmentId = params.get("assignmentId") ?? undefined;
  if (!courseId && !assignmentId) return <SessionPicker />;
  return <AttendanceSheetView key={courseId ?? assignmentId} courseId={courseId} assignmentId={assignmentId} />;
}

function AttendanceSheetView({ courseId, assignmentId }: { courseId?: string; assignmentId?: string }) {
  const sheet = useAttendanceSheet({ courseId, assignmentId });
  if (sheet.isLoading) return <LoadingState label="Chargement de la liste…" />;
  if (sheet.isError || !sheet.data) {
    return <ErrorState message={sheet.error instanceof Error ? sheet.error.message : "Feuille d'appel inaccessible."} onRetry={() => void sheet.refetch()} />;
  }
  return <SheetForm d={sheet.data} courseId={courseId} assignmentId={assignmentId} />;
}

function SheetForm({ d, courseId, assignmentId }: { d: AttendanceSheet; courseId?: string; assignmentId?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  // Statuts déjà enregistrés (modification d'un appel existant), sinon aucun
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(d.students.filter((s) => s.status).map((s) => [s.id, s.status as AttendanceStatus])),
  );
  const [duration, setDuration] = useState(60);
  const [focused, setFocused] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ courseId: string; counts: AttendanceCounts; smsQueued: number } | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  const students = d.students;
  const unmarked = students.filter((s) => !marks[s.id]).length;
  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0 };
    for (const s of students) if (marks[s.id]) c[marks[s.id]]++;
    return c;
  }, [marks, students]);

  function mark(studentId: string, status: AttendanceStatus, advance = false) {
    setMarks((m) => ({ ...m, [studentId]: status }));
    if (advance) {
      const idx = students.findIndex((s) => s.id === studentId);
      const next = Math.min(idx + 1, students.length - 1);
      setFocused(next);
      rowRefs.current[next]?.focus();
    }
  }

  function onRowKey(e: React.KeyboardEvent, index: number) {
    const status = KEY_TO_STATUS[e.key.toLowerCase()];
    if (status) {
      e.preventDefault();
      mark(students[index].id, status, true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, Math.min(students.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
      setFocused(next);
      rowRefs.current[next]?.focus();
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await teacherSpaceService.saveAttendance({
        courseId,
        assignmentId: courseId ? undefined : assignmentId,
        durationMinutes: courseId ? undefined : duration,
        records: students.map((s) => ({ studentId: s.id, status: marks[s.id] })),
      });
      setResult(res);
      await qc.invalidateQueries({ queryKey: ["teacher-space"] });
      notify("Appel enregistré");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Enregistrement impossible", "error");
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = new Date(`${d.date}T12:00:00`).toLocaleDateString("fr-FR");

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-3xl border border-emerald-200 bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
        <h1 className="text-xl font-extrabold text-slate-900">Appel enregistré</h1>
        <p className="text-sm text-slate-600">
          {d.assignment.subjectName} · {d.assignment.className} · {dateLabel}
        </p>
        <div className="grid grid-cols-4 gap-2 text-sm">
          {OPTIONS.map((o) => (
            <div key={o.status} className="rounded-xl bg-slate-50 p-2">
              <p className="text-lg font-bold text-slate-900">{result.counts[o.status]}</p>
              <p className="text-[11px] text-slate-500">{o.label}</p>
            </div>
          ))}
        </div>
        {result.counts.ABSENT > 0 ? (
          <p className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
            <MessageSquare size={14} /> Notification des parents : {result.smsQueued > 0 ? `${result.smsQueued} SMS en cours d'envoi` : "SMS traités"}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate("/teacher/dashboard")}>Retour au tableau de bord</Button>
          <Button variant="outline" onClick={() => navigate("/teacher/history")}>
            Voir l'historique
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <Link to="/teacher/attendance" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} /> Changer de cours
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900">{d.assignment.subjectName}</h1>
        <p className="text-base font-semibold text-emerald-700">{d.assignment.className}</p>
        <p className="text-sm text-slate-600">
          Date : {dateLabel} · Heure : {d.time}
          {d.course ? ` — ${d.course.endTime}` : " (heure du serveur)"}
        </p>
      </div>

      {d.alreadyRecorded ? (
        <div role="status" className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          L'appel de ce cours a déjà été fait : vous modifiez les présences enregistrées.
        </div>
      ) : null}
      {d.todaySessions && d.todaySessions.length > 0 ? (
        <div role="alert" className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Vous avez déjà fait l'appel de cette classe aujourd'hui (
            {d.todaySessions.map((c) => c.startTime).join(", ")}). Enregistrer créera une <strong>nouvelle séance</strong>.{" "}
            <Link to={`/teacher/attendance?courseId=${d.todaySessions[d.todaySessions.length - 1].id}`} className="font-semibold underline">
              Modifier la dernière à la place
            </Link>
          </p>
        </div>
      ) : null}

      {students.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center text-sm text-slate-500">
          Aucun étudiant dans cette classe. L'administration doit d'abord importer la liste des étudiants.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              <Keyboard size={14} /> Raccourcis : P présent · A absent · R retard · J justifié · ↑↓ naviguer
            </p>
            <Button variant="outline" size="sm" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, marks[s.id] ?? "PRESENT"])))}>
              <CheckCheck size={14} /> Marquer les autres présents
            </Button>
          </div>

          <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-emerald-100 bg-white" aria-label="Liste de présence">
            {students.map((s, i) => (
              <li
                key={s.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                tabIndex={0}
                onFocus={() => setFocused(i)}
                onKeyDown={(e) => onRowKey(e, i)}
                aria-label={`${s.lastName} ${s.firstName} : ${marks[s.id] ? OPTIONS.find((o) => o.status === marks[s.id])!.label : "non marqué"}`}
                className={cn(
                  "flex flex-col gap-2 px-3 py-2.5 outline-none sm:flex-row sm:items-center sm:justify-between",
                  focused === i && "bg-emerald-50/60 ring-2 ring-inset ring-emerald-400",
                  !marks[s.id] && "border-l-4 border-l-amber-300",
                )}
              >
                <div className="min-w-0">
                  <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                  <span className="font-bold text-slate-900">{s.lastName}</span> <span className="text-slate-700">{s.firstName}</span>
                </div>
                <div role="radiogroup" aria-label={`Statut de ${s.firstName} ${s.lastName}`} className="grid grid-cols-4 gap-1 sm:flex">
                  {OPTIONS.map((o) => (
                    <button
                      key={o.status}
                      type="button"
                      role="radio"
                      aria-checked={marks[s.id] === o.status}
                      tabIndex={-1}
                      onClick={() => mark(s.id, o.status)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-bold transition-colors sm:px-3 sm:py-1.5",
                        marks[s.id] === o.status ? o.on : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <div className="fixed inset-x-0 bottom-16 z-20 border-t border-emerald-100 bg-white/95 p-3 backdrop-blur md:bottom-0">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600">
                {counts.PRESENT} présent(s) · {counts.ABSENT} absent(s) · {counts.LATE} retard(s) · {counts.JUSTIFIED} justifié(s)
                {unmarked ? <span className="ml-2 text-amber-700">— {unmarked} sans statut</span> : null}
              </p>
              <div className="flex items-center gap-2">
                {!courseId ? (
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    Durée
                    <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                      {[30, 60, 90, 120, 180].map((m) => (
                        <option key={m} value={m}>
                          {m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}` : `${m} min`}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Button onClick={() => void save()} disabled={unmarked > 0} loading={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  <Save size={16} /> Enregistrer l'appel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
