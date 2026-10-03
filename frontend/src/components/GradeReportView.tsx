import { BookOpen, ClipboardList, TrendingUp } from "lucide-react";
import { Badge } from "./ui/Badge";
import { EmptyState } from "./ui/EmptyState";
import { StatCard } from "./ui/StatCard";
import { EVALUATION_TYPE_LABELS, formatScore, scoreTone } from "../utils/grades";
import type { GradeReport } from "../types";

/** Relevé de notes (espace étudiant et consultation administrateur) : regroupé par matière */
export function GradeReportView({ report, emptyDescription }: { report: GradeReport; emptyDescription: string }) {
  if (report.evaluationCount === 0) {
    return <EmptyState title="Aucune note" description={emptyDescription} />;
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="col-span-2 lg:col-span-1">
          <StatCard
          label="Moyenne générale"
          value={report.overallAverage !== null ? `${formatScore(report.overallAverage)} / 20` : "—"}
          icon={TrendingUp}
          color="indigo"
          hint="Moyenne des moyennes par matière"
          />
        </div>
        <StatCard label="Matières" value={report.subjects.length} icon={BookOpen} color="blue" />
        <StatCard label="Évaluations" value={report.evaluationCount} icon={ClipboardList} color="emerald" />
      </div>

      {report.subjects.map((s) => (
        <section key={s.subjectId} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-bold text-slate-900">{s.subjectName}</h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              {s.count} évaluation{s.count > 1 ? "s" : ""}
              <Badge tone={scoreTone(s.average)} dot={false}>
                Moyenne {formatScore(s.average)} / 20
              </Badge>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {s.grades.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{g.title}</p>
                  <p className="text-xs text-slate-500">
                    {EVALUATION_TYPE_LABELS[g.type]} · {new Date(`${g.date}T12:00:00`).toLocaleDateString("fr-FR")} · Coefficient {formatScore(g.coefficient)}
                  </p>
                  <p className="text-[11px] text-slate-400">{g.teacherName}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="text-lg font-extrabold text-slate-900">{formatScore(g.score)}</span>
                  <span className="text-sm font-semibold text-slate-500"> / {formatScore(g.maxScore)}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
