import { Link, useParams } from "react-router-dom";
import { useAttendance, useNotifications } from "../hooks/useApi";
import { studentService } from "../services/student.service";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Table } from "../components/ui/Table";
import { ATTENDANCE_LABELS } from "../constants";

export function StudentDetail() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: ["student", id], queryFn: () => studentService.get(id) });
  const attendance = useAttendance();
  const notifications = useNotifications();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message="Étudiant introuvable." />;
  const st = query.data;

  const history = (attendance.data ?? []).filter((a) => a.studentId === id).reverse();
  const present = history.filter((h) => h.status === "PRESENT").length;
  const absent = history.filter((h) => h.status === "ABSENT").length;
  const late = history.filter((h) => h.status === "LATE").length;
  const rate = history.length ? Math.round((present / history.length) * 100) : 0;
  const notifs = (notifications.data ?? []).filter((n) => n.studentId === id);

  return (
    <div className="space-y-4">
      <Link to="/students" className="text-sm font-medium text-[#2563EB] hover:underline">← Retour</Link>
      <h1 className="text-2xl font-semibold text-[#0F172A]">{st.lastName} {st.firstName}</h1>
      <p className="text-sm text-[#64748B]">{st.className} — {st.phone}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-sm text-[#64748B]">Présences</p><p className="text-2xl font-semibold">{present}</p></Card>
        <Card><p className="text-sm text-[#64748B]">Absences</p><p className="text-2xl font-semibold">{absent}</p></Card>
        <Card><p className="text-sm text-[#64748B]">Retards</p><p className="text-2xl font-semibold">{late}</p></Card>
        <Card><p className="text-sm text-[#64748B]">Taux de présence</p><p className="text-2xl font-semibold">{rate}%</p></Card>
      </div>
      <Card>
        <h2 className="mb-3 text-base font-semibold">Historique</h2>
        {history.length === 0 ? <p className="text-sm text-[#64748B]">Aucun historique.</p> : (
          <Table headers={["Date", "Cours", "Statut", "SMS"]}>
            {history.map((h) => {
              const n = notifs.find((x) => x.attendanceId === h.id);
              return (
                <tr key={h.id}>
                  <td className="px-4 py-2">{h.date}</td>
                  <td className="px-4 py-2">{h.subject}</td>
                  <td className="px-4 py-2"><Badge tone={h.status === "PRESENT" ? "green" : h.status === "ABSENT" ? "red" : "orange"}>{ATTENDANCE_LABELS[h.status]}</Badge></td>
                  <td className="px-4 py-2 text-xs">{n ? n.status : "—"}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
