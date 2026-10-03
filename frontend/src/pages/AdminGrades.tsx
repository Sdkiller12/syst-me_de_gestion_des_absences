import { useState } from "react";
import { BookOpenCheck, ClipboardList, Eye, Lock, Sigma, TrendingUp } from "lucide-react";
import { useClasses, useStudents } from "../hooks/useApi";
import { useSubjects, useTeacherList } from "../hooks/useTeacherModule";
import { useAdminEvaluation, useAdminEvaluations, useAdminGradeStats, useAdminGrades, useAdminStudentReport } from "../hooks/useGradesTimetable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { StatCard } from "../components/ui/StatCard";
import { Table } from "../components/ui/Table";
import { GradeReportView } from "../components/GradeReportView";
import { EVALUATION_TYPE_LABELS, formatScore, scoreTone } from "../utils/grades";
import type { EvaluationType } from "../types";

type Tab = "evaluations" | "grades" | "report";

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");
const select = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";

/** Détail d'une évaluation : consultation des notes, sans aucune action de modification */
function EvaluationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useAdminEvaluation(id);
  const e = detail.data?.evaluation;
  return (
    <Modal title={e ? `${e.title} · ${e.class.name}` : "Évaluation"} onClose={onClose}>
      {detail.isLoading ? <LoadingState /> : null}
      {detail.isError ? <ErrorState message="Évaluation introuvable." /> : null}
      {detail.data && e ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {e.subject.name} · {EVALUATION_TYPE_LABELS[e.type]} · {fmtDate(e.date)} · Coef. {formatScore(e.coefficient)} · {e.teacher.fullName}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              ["Moyenne", e.stats.average],
              ["Min.", e.stats.min],
              ["Max.", e.stats.max],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-xl bg-slate-50 p-2">
                <p className="text-lg font-bold text-slate-900">{formatScore(v as number | null)}</p>
                <p className="text-[11px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
            {detail.data.grades.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold text-slate-900">{g.student.lastName}</span> {g.student.firstName}
                </span>
                <Badge tone={scoreTone(g.score, e.maxScore)} dot={false}>
                  {formatScore(g.score)} / {formatScore(e.maxScore)}
                </Badge>
              </li>
            ))}
            {detail.data.grades.length === 0 ? <li className="px-3 py-4 text-center text-sm text-slate-500">Aucune note saisie.</li> : null}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}

function StudentFilter({ classId, value, onChange }: { classId: string; value: string; onChange: (v: string) => void }) {
  const students = useStudents({ classId });
  return (
    <select aria-label="Élève" className={select} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Tous les élèves</option>
      {(students.data ?? []).map((s) => (
        <option key={s.id} value={s.id}>
          {s.lastName} {s.firstName}
        </option>
      ))}
    </select>
  );
}

export function AdminGrades() {
  const classes = useClasses();
  const subjects = useSubjects();
  const teachers = useTeacherList({});
  const [filters, setFilters] = useState({ classId: "", subjectId: "", teacherId: "", studentId: "", type: "" as EvaluationType | "", from: "", to: "" });
  const [tab, setTab] = useState<Tab>("evaluations");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);

  const stats = useAdminGradeStats(filters);
  const evaluations = useAdminEvaluations({ ...filters, page });
  const grades = useAdminGrades({ ...filters, page });
  const report = useAdminStudentReport(tab === "report" ? filters.studentId : "", { subjectId: filters.subjectId, type: filters.type, from: filters.from, to: filters.to });

  function set<K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) {
    setFilters((f) => ({ ...f, [k]: v, ...(k === "classId" ? { studentId: "" } : {}) }));
    setPage(1);
    if (k === "studentId") setTab(v ? "report" : "evaluations");
    if (k === "classId" && tab === "report") setTab("evaluations");
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "evaluations", label: "Évaluations" },
    { id: "grades", label: "Toutes les notes" },
    ...(filters.studentId ? [{ id: "report" as Tab, label: "Relevé de l'élève" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <BookOpenCheck className="text-indigo-600" size={22} /> Notes
          </h1>
          <p className="mt-1 text-sm text-slate-500">Notes saisies par les enseignants de l'établissement.</p>
        </div>
        <Badge tone="amber" dot={false} className="px-3 py-1">
          <Lock size={12} /> Lecture seule
        </Badge>
      </div>

      <div role="note" className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <Lock size={16} className="mt-0.5 shrink-0" />
        Consultation uniquement : les notes, évaluations et coefficients sont saisis et modifiés exclusivement par les enseignants.
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <select aria-label="Classe" className={select} value={filters.classId} onChange={(e) => set("classId", e.target.value)}>
          <option value="">Toutes les classes</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Matière" className={select} value={filters.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
          <option value="">Toutes les matières</option>
          {(subjects.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Enseignant" className={select} value={filters.teacherId} onChange={(e) => set("teacherId", e.target.value)}>
          <option value="">Tous les enseignants</option>
          {(teachers.data?.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
        {filters.classId ? (
          <StudentFilter classId={filters.classId} value={filters.studentId} onChange={(v) => set("studentId", v)} />
        ) : (
          <select aria-label="Élève" className={select} disabled>
            <option>Choisir une classe pour l'élève</option>
          </select>
        )}
        <select aria-label="Type" className={select} value={filters.type} onChange={(e) => set("type", e.target.value as EvaluationType | "")}>
          <option value="">Tous les types</option>
          {(Object.keys(EVALUATION_TYPE_LABELS) as EvaluationType[]).map((t) => (
            <option key={t} value={t}>
              {EVALUATION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input aria-label="Du" type="date" className={select} value={filters.from} onChange={(e) => set("from", e.target.value)} />
        <input aria-label="Au" type="date" className={select} value={filters.to} onChange={(e) => set("to", e.target.value)} />
      </div>

      {stats.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Évaluations" value={stats.data.evaluations} icon={ClipboardList} color="indigo" />
          <StatCard label="Notes saisies" value={stats.data.grades} icon={Sigma} color="blue" />
          <StatCard
            label="Moyenne"
            value={stats.data.average !== null ? `${formatScore(stats.data.average)} / 20` : "—"}
            icon={TrendingUp}
            color="emerald"
            hint="Notes ramenées sur 20"
          />
        </div>
      ) : null}
      {stats.data && stats.data.bySubject.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {stats.data.bySubject.map((s) => (
            <Badge key={s.subjectId} tone={scoreTone(s.average)} dot={false}>
              {s.subjectName} : {formatScore(s.average)} / 20 ({s.count})
            </Badge>
          ))}
        </div>
      ) : null}

      <div role="tablist" aria-label="Affichage" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.id} role="tab" aria-selected={tab === t.id} size="sm" variant={tab === t.id ? "primary" : "outline"} onClick={() => { setTab(t.id); setPage(1); }}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "evaluations" ? (
        <>
          {evaluations.isLoading ? <LoadingState /> : null}
          {evaluations.isError ? <ErrorState message="Impossible de charger les évaluations." onRetry={() => void evaluations.refetch()} /> : null}
          {evaluations.data && evaluations.data.data.length === 0 ? (
            <EmptyState title="Aucune évaluation" description="Aucune note n'a encore été saisie par les enseignants pour ces critères." />
          ) : null}
          {evaluations.data && evaluations.data.data.length > 0 ? (
            <div>
              <Table headers={["Évaluation", "Classe", "Enseignant", "Date", "Coef.", "Notes", "Moyenne", ""]}>
                {evaluations.data.data.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{e.title}</p>
                      <p className="text-xs text-slate-500">
                        {e.subject.name} · {EVALUATION_TYPE_LABELS[e.type]}
                      </p>
                    </td>
                    <td className="px-4 py-3">{e.class.name}</td>
                    <td className="px-4 py-3">{e.teacher.fullName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3">{formatScore(e.coefficient)}</td>
                    <td className="px-4 py-3">{e.stats.count}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatScore(e.stats.average)} / {formatScore(e.maxScore)}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" aria-label={`Voir les notes de ${e.title}`} title="Voir les notes" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" onClick={() => setDetail(e.id)}>
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
              <Pagination page={page} totalPages={evaluations.data.pagination.totalPages} onChange={setPage} />
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "grades" ? (
        <>
          {grades.isLoading ? <LoadingState /> : null}
          {grades.isError ? <ErrorState message="Impossible de charger les notes." onRetry={() => void grades.refetch()} /> : null}
          {grades.data && grades.data.data.length === 0 ? <EmptyState title="Aucune note" description="Aucune note ne correspond à ces critères." /> : null}
          {grades.data && grades.data.data.length > 0 ? (
            <div>
              <Table headers={["Élève", "Classe", "Matière", "Évaluation", "Date", "Note", "Enseignant"]}>
                {grades.data.data.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900">{g.student.lastName}</span> {g.student.firstName}
                    </td>
                    <td className="px-4 py-3">{g.class.name}</td>
                    <td className="px-4 py-3">{g.subject.name}</td>
                    <td className="px-4 py-3">
                      {g.evaluation.title} <span className="text-xs text-slate-500">· coef. {formatScore(g.evaluation.coefficient)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(g.evaluation.date)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={scoreTone(g.score, g.evaluation.maxScore)} dot={false}>
                        {formatScore(g.score)} / {formatScore(g.evaluation.maxScore)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{g.teacher.fullName}</td>
                  </tr>
                ))}
              </Table>
              <Pagination page={page} totalPages={grades.data.pagination.totalPages} onChange={setPage} />
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "report" && filters.studentId ? (
        <>
          {report.isLoading ? <LoadingState /> : null}
          {report.isError ? <ErrorState message="Relevé indisponible." onRetry={() => void report.refetch()} /> : null}
          {report.data ? (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900">
                {report.data.student.lastName} {report.data.student.firstName} <span className="text-sm font-semibold text-slate-500">· {report.data.student.class.name}</span>
              </h2>
              <GradeReportView report={report.data} emptyDescription="Aucune note n'a encore été saisie pour cet élève." />
            </div>
          ) : null}
        </>
      ) : null}

      {detail ? <EvaluationDetail id={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
