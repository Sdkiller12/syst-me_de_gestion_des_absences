import { useSearchParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useStudentClasses, useStudentTimetable } from "../../hooks/useGradesTimetable";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Select } from "../../components/ui/Select";
import { TimetableView } from "../../components/TimetableView";

export function StudentTimetable() {
  const [params, setParams] = useSearchParams();
  const classId = params.get("classId");
  const classes = useStudentClasses();
  const tt = useStudentTimetable(classId);
  const myClassId = classes.data?.myClassId;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <CalendarDays className="text-indigo-600" size={22} /> Emploi du temps
          </h1>
          {tt.data ? (
            <p className="text-sm font-semibold text-indigo-700">
              {tt.data.class.name} · {tt.data.class.academicYear}
            </p>
          ) : null}
        </div>
        {classes.data ? (
          <div className="w-full sm:w-64">
            <Select
              aria-label="Classe"
              value={classId ?? myClassId ?? ""}
              onChange={(e) => setParams(e.target.value === myClassId ? {} : { classId: e.target.value })}
              options={classes.data.classes.map((c) => ({
                value: c.id,
                label: `${c.level ? `${c.level} — ` : ""}${c.name}${c.id === myClassId ? " (ma classe)" : ""}`,
              }))}
            />
          </div>
        ) : null}
      </div>

      {tt.isLoading ? <LoadingState /> : null}
      {tt.isError ? <ErrorState message={tt.error instanceof Error ? tt.error.message : "Emploi du temps indisponible."} onRetry={() => void tt.refetch()} /> : null}
      {tt.data && tt.data.entries.length === 0 ? (
        <EmptyState title="Emploi du temps non publié" description="L'administration n'a pas encore programmé les cours de cette classe." />
      ) : null}
      {tt.data && tt.data.entries.length > 0 ? <TimetableView key={tt.data.class.id} entries={tt.data.entries} show="teacher" /> : null}
    </div>
  );
}
