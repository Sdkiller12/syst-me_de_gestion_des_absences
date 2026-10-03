import { useState } from "react";
import { ChevronRight, GraduationCap } from "lucide-react";
import { cn } from "../utils/cn";
import { groupClassesByLevel } from "../utils/timetable";
import type { ClassOption } from "../types";

/**
 * Choix du niveau puis de la classe. Les niveaux proviennent des classes enregistrées
 * en base (champ "niveau"), jamais d'une liste figée.
 */
export function ClassPicker({
  classes,
  selectedId,
  highlightId,
  onSelect,
}: {
  classes: ClassOption[];
  selectedId?: string | null;
  /** Classe de l'élève connecté, signalée dans la liste */
  highlightId?: string | null;
  onSelect: (c: ClassOption) => void;
}) {
  const groups = groupClassesByLevel(classes);
  const initial = groups.find((g) => g.classes.some((c) => c.id === (selectedId ?? highlightId)))?.level ?? null;
  const [level, setLevel] = useState<string | null>(groups.length === 1 ? groups[0].level : initial);
  const current = groups.find((g) => g.level === level);

  if (classes.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Aucune classe n'est encore enregistrée.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Sélectionnez votre niveau</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {groups.map((g) => (
            <button
              key={g.level}
              type="button"
              aria-pressed={g.level === level}
              onClick={() => setLevel(g.level)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-all duration-150",
                g.level === level ? "border-indigo-600 bg-indigo-600 text-white shadow-xs" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60",
              )}
            >
              <GraduationCap size={16} /> {g.level}
            </button>
          ))}
        </div>
      </div>

      {current ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Classe</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {current.classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border bg-white p-4 text-left transition-all duration-150 hover:border-indigo-300 hover:shadow-xs",
                  c.id === selectedId ? "border-indigo-400 ring-2 ring-indigo-500/20" : "border-slate-200/80",
                )}
              >
                <span>
                  <span className="block text-sm font-bold text-slate-900">
                    {c.name}
                    {c.id === highlightId ? <span className="ml-2 text-xs font-semibold text-indigo-600">· ma classe</span> : null}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {c.academicYear} · {c.slotCount > 0 ? `${c.slotCount} cours par semaine` : "emploi du temps non publié"}
                  </span>
                </span>
                <ChevronRight className="text-slate-400" size={18} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
