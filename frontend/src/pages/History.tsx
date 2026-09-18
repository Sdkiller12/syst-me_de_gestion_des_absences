import { useMemo, useState } from "react";
import { useAttendance, useClasses, useNotifications } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { SearchInput } from "../components/ui/SearchInput";
import { Table } from "../components/ui/Table";
import { ATTENDANCE_LABELS } from "../constants";
import { useDebounce } from "../hooks/useDebounce";

export function History() {
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const classes = useClasses();
  const attendance = useAttendance();
  const notifications = useNotifications();

  const rows = useMemo(() => {
    let all = attendance.data ?? [];
    if (classId) all = all.filter((a) => a.className === classes.data?.find((c) => c.id === classId)?.name);
    if (status) all = all.filter((a) => a.status === status);
    if (debounced) {
      const q = debounced.toLowerCase();
      all = all.filter((a) => (a.studentName ?? "").toLowerCase().includes(q));
    }
    return [...all].reverse();
  }, [attendance.data, classId, status, debounced, classes.data]);

  if (attendance.isLoading) return <LoadingState />;
  if (attendance.isError) return <ErrorState message="Impossible de charger l’historique." onRetry={() => void attendance.refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[#0F172A]">Historique</h1>
      <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un étudiant…" />
        <select aria-label="Filtrer par classe" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Toutes les classes</option>
          {(classes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Filtrer par statut" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="PRESENT">Présent</option>
          <option value="ABSENT">Absent</option>
          <option value="LATE">Retard</option>
          <option value="JUSTIFIED">Justifié</option>
        </select>
      </div>
      {rows.length === 0 ? <EmptyState title="Aucun résultat" description="Modifiez les filtres." /> : (
        <Table headers={["Date", "Étudiant", "Classe", "Cours", "Statut", "SMS"]}>
          {rows.slice(0, 100).map((a) => {
            const n = (notifications.data ?? []).find((x) => x.attendanceId === a.id);
            return (
              <tr key={a.id}>
                <td className="px-4 py-2">{a.date}</td>
                <td className="px-4 py-2">{a.studentName}</td>
                <td className="px-4 py-2">{a.className}</td>
                <td className="px-4 py-2">{a.subject}</td>
                <td className="px-4 py-2"><Badge tone={a.status === "PRESENT" ? "green" : a.status === "ABSENT" ? "red" : "orange"}>{ATTENDANCE_LABELS[a.status]}</Badge></td>
                <td className="px-4 py-2 text-xs">{n ? n.status : "—"}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
