import { useMemo, useState } from "react";
import { History as HistoryIcon, MessageSquare } from "lucide-react";
import { useAttendanceSession, useTeacherHistory, useTeacherMe } from "../../hooks/useTeacherModule";
import { Badge } from "../../components/ui/Badge";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { ATTENDANCE_LABELS } from "../../constants";
import type { AttendanceStatus } from "../../types";

const TONE: Record<AttendanceStatus, "green" | "red" | "amber" | "blue"> = { PRESENT: "green", ABSENT: "red", LATE: "amber", JUSTIFIED: "blue" };
const SMS_LABEL: Record<string, string> = { PENDING: "SMS en attente", SENT: "SMS envoyé", FAILED: "SMS en échec", RETRY_EXHAUSTED: "SMS en échec" };

function SessionDetail({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const session = useAttendanceSession(courseId);
  const c = session.data?.course;
  return (
    <Modal title={c ? `${c.subject} · ${c.className}` : "Détail de l'appel"} onClose={onClose}>
      {session.isLoading ? <LoadingState /> : null}
      {session.data ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {new Date(`${c!.date}T12:00:00`).toLocaleDateString("fr-FR", { dateStyle: "full" })} · {c!.startTime} — {c!.endTime}
          </p>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
            {session.data.records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold text-slate-900">{r.student.lastName}</span> {r.student.firstName}
                </span>
                <span className="flex items-center gap-1.5">
                  {r.smsStatus ? (
                    <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
                      <MessageSquare size={11} /> {SMS_LABEL[r.smsStatus] ?? r.smsStatus}
                    </span>
                  ) : null}
                  <Badge tone={TONE[r.status]} dot={false}>{ATTENDANCE_LABELS[r.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}

export function TeacherHistory() {
  const me = useTeacherMe();
  const [filters, setFilters] = useState({ classId: "", subjectId: "", from: "", to: "", status: "" as AttendanceStatus | "" });
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);
  const history = useTeacherHistory({ page, ...filters });

  const classOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of me.data?.assignments ?? []) m.set(a.class.id, a.class.name);
    return [...m];
  }, [me.data]);

  function set<K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  }

  const select = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <HistoryIcon className="text-emerald-600" size={22} /> Historique
        </h1>
        <p className="text-sm text-slate-500">Vos appels uniquement.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select aria-label="Classe" className={select} value={filters.classId} onChange={(e) => set("classId", e.target.value)}>
          <option value="">Toutes les classes</option>
          {classOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Matière" className={select} value={filters.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
          <option value="">Toutes les matières</option>
          {(me.data?.subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input aria-label="Du" type="date" className={select} value={filters.from} onChange={(e) => set("from", e.target.value)} />
        <input aria-label="Au" type="date" className={select} value={filters.to} onChange={(e) => set("to", e.target.value)} />
        <select aria-label="Statut" className={select} value={filters.status} onChange={(e) => set("status", e.target.value as AttendanceStatus | "")}>
          <option value="">Tous les statuts</option>
          {(["ABSENT", "LATE", "JUSTIFIED", "PRESENT"] as AttendanceStatus[]).map((s) => (
            <option key={s} value={s}>
              Avec au moins un « {ATTENDANCE_LABELS[s]} »
            </option>
          ))}
        </select>
      </div>

      {history.isLoading ? <LoadingState /> : null}
      {history.isError ? <ErrorState message="Impossible de charger l'historique." onRetry={() => void history.refetch()} /> : null}
      {history.data && history.data.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center text-sm text-slate-500">Aucun appel ne correspond.</p>
      ) : null}

      <div className="space-y-2">
        {(history.data?.data ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setDetail(c.id)}
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-4 text-left hover:border-emerald-300"
          >
            <div>
              <p className="font-bold text-slate-900">{c.subject}</p>
              <p className="text-sm text-emerald-700">{c.className}</p>
              <p className="text-xs text-slate-500">
                {new Date(`${c.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · {c.startTime}
              </p>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p className="font-semibold text-slate-900">{c.counts.total} étudiants</p>
              <p>
                {c.counts.PRESENT} présents · <span className="text-rose-600">{c.counts.ABSENT} absents</span> · {c.counts.LATE} retard(s)
                {c.counts.JUSTIFIED ? ` · ${c.counts.JUSTIFIED} justifié(s)` : ""}
              </p>
            </div>
          </button>
        ))}
      </div>

      {history.data && history.data.pagination.totalPages > 1 ? (
        <Pagination page={page} totalPages={history.data.pagination.totalPages} onChange={setPage} />
      ) : null}

      {detail ? <SessionDetail courseId={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
