import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ClipboardCheck, Users } from "lucide-react";
import { useTeacherClassStudents, useTeacherClasses } from "../../hooks/useTeacherModule";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { cn } from "../../utils/cn";

function StudentList({ classId }: { classId: string }) {
  const students = useTeacherClassStudents(classId);
  if (students.isLoading) return <p className="px-4 pb-4 text-sm text-slate-500">Chargement…</p>;
  if (!students.data?.length) return <p className="px-4 pb-4 text-sm text-slate-500">Aucun étudiant dans cette classe.</p>;
  return (
    <ol className="divide-y divide-slate-100 border-t border-slate-100">
      {students.data.map((s, i) => (
        <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
          <span className="w-6 text-right text-xs text-slate-400">{i + 1}</span>
          <span className="font-semibold text-slate-900">{s.lastName}</span> {s.firstName}
          {s.studentNumber ? <span className="ml-auto font-mono text-xs text-slate-400">{s.studentNumber}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function TeacherClasses() {
  const classes = useTeacherClasses();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Mes classes</h1>
        <p className="text-sm text-slate-500">Uniquement les classes qui vous sont affectées.</p>
      </div>
      {classes.isLoading ? <LoadingState /> : null}
      {classes.isError ? <ErrorState message="Impossible de charger vos classes." onRetry={() => void classes.refetch()} /> : null}
      {classes.data && classes.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center text-sm text-slate-500">
          Aucune classe ne vous est encore affectée.
        </p>
      ) : null}
      <div className="space-y-3">
        {(classes.data ?? []).map((c) => (
          <div key={c.id} className="overflow-hidden rounded-2xl border border-emerald-100 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-base font-bold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {c.academicYear} · <Users size={12} className="inline" /> {c.studentCount} étudiant(s)
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.assignments.map((a) => (
                    <Link
                      key={a.id}
                      to={`/teacher/attendance?assignmentId=${a.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <ClipboardCheck size={12} /> Appel · {a.subjectName}
                    </Link>
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-expanded={open === c.id}
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Liste des étudiants <ChevronDown size={14} className={cn("transition-transform", open === c.id && "rotate-180")} />
              </button>
            </div>
            {open === c.id ? <StudentList classId={c.id} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
