import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { cn } from "../utils/cn";
import { groupByDay, isoWeekday, visibleDays } from "../utils/timetable";
import type { TimetableEntry } from "../types";

type Accent = "indigo" | "emerald";

const ACCENTS: Record<Accent, { time: string; tab: string; border: string }> = {
  indigo: { time: "text-indigo-700", tab: "bg-indigo-600 text-white border-indigo-600", border: "border-slate-200/80" },
  emerald: { time: "text-emerald-700", tab: "bg-emerald-600 text-white border-emerald-600", border: "border-emerald-100" },
};

function Slot({
  entry,
  show,
  accent,
  actions,
}: {
  entry: TimetableEntry;
  show: "teacher" | "class";
  accent: Accent;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-white p-3 shadow-2xs", ACCENTS[accent].border)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("flex items-center gap-1 whitespace-nowrap text-xs font-bold", ACCENTS[accent].time)}>
          <Clock size={12} className="shrink-0" /> {entry.startTime}–{entry.endTime}
        </p>
        {actions}
      </div>
      <p className="mt-1 text-sm font-bold text-slate-900">{entry.subject.name}</p>
      <p className="text-xs font-medium text-slate-600">{show === "teacher" ? entry.teacher.name : entry.class.name}</p>
      {entry.room ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <MapPin size={11} /> {entry.room}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Emploi du temps hebdomadaire. Grand écran : une colonne par jour. Mobile : un jour à la fois
 * avec onglets et navigation jour précédent / jour suivant (aujourd'hui sélectionné par défaut).
 */
export function TimetableView({
  entries,
  show = "teacher",
  accent = "indigo",
  renderActions,
  emptyDayLabel = "Pas de cours",
}: {
  entries: TimetableEntry[];
  /** Information secondaire de chaque créneau : l'enseignant (vue classe) ou la classe (vue enseignant) */
  show?: "teacher" | "class";
  accent?: Accent;
  renderActions?: (entry: TimetableEntry) => ReactNode;
  emptyDayLabel?: string;
}) {
  const days = visibleDays(entries);
  const byDay = groupByDay(entries);
  const today = isoWeekday();
  const [index, setIndex] = useState(() => Math.max(0, days.findIndex((d) => d.value === today)));
  const current = days[Math.min(index, days.length - 1)];
  const dayEntries = byDay.get(current.value) ?? [];

  return (
    <>
      {/* Mobile et tablette : un jour à la fois */}
      <div className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="Jour précédent"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-base font-extrabold text-slate-900">
            {current.label}
            {current.value === today ? <span className="ml-2 text-xs font-semibold text-slate-500">aujourd'hui</span> : null}
          </p>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(days.length - 1, i + 1))}
            disabled={index === days.length - 1}
            aria-label="Jour suivant"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div role="tablist" aria-label="Jours de la semaine" className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((d, i) => (
            <button
              key={d.value}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "min-w-12 flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors",
                i === index ? ACCENTS[accent].tab : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {d.short}
              {byDay.get(d.value)?.length ? <span className="ml-1 opacity-70">{byDay.get(d.value)!.length}</span> : null}
            </button>
          ))}
        </div>
        <div className="space-y-2" role="tabpanel">
          {dayEntries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{emptyDayLabel}</p>
          ) : (
            dayEntries.map((e) => <Slot key={e.id} entry={e} show={show} accent={accent} actions={renderActions?.(e)} />)
          )}
        </div>
      </div>

      {/* Grand écran : vue hebdomadaire */}
      <div className="hidden gap-3 lg:grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => (
          <section key={d.value} aria-label={d.label} className="space-y-2">
            <h3
              className={cn(
                "rounded-xl border px-3 py-2 text-center text-xs font-bold uppercase tracking-wider",
                d.value === today ? ACCENTS[accent].tab : "border-slate-200/80 bg-slate-50/80 text-slate-600",
              )}
            >
              {d.label}
            </h3>
            {(byDay.get(d.value) ?? []).map((e) => (
              <Slot key={e.id} entry={e} show={show} accent={accent} actions={renderActions?.(e)} />
            ))}
            {!byDay.get(d.value)?.length ? <p className="py-3 text-center text-[11px] font-medium text-slate-400">—</p> : null}
          </section>
        ))}
      </div>
    </>
  );
}
