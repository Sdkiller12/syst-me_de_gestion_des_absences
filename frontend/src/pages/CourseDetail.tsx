import { Link, useParams } from "react-router-dom";
import { courseService } from "../services/course.service";
import { useAttendance } from "../hooks/useApi";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Table } from "../components/ui/Table";
import { ATTENDANCE_LABELS } from "../constants";

export function CourseDetail() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: ["course", id], queryFn: () => courseService.get(id) });
  const attendance = useAttendance(id);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message="Cours introuvable." />;
  const c = query.data;

  return (
    <div className="space-y-4">
      <Link to="/courses" className="text-sm font-medium text-[#2563EB] hover:underline">← Retour</Link>
      <h1 className="text-2xl font-semibold text-[#0F172A]">{c.subject}</h1>
      <p className="text-sm text-[#64748B]">{c.className} — {c.date} — {c.startTime} à {c.endTime}</p>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Présences ({(attendance.data ?? []).length})</h2>
          <Link to="/attendance" className="text-sm font-medium text-[#2563EB] hover:underline">Faire l’appel →</Link>
        </div>
        {(attendance.data ?? []).length === 0 ? <p className="text-sm text-[#64748B]">Aucune présence enregistrée.</p> : (
          <Table headers={["Étudiant", "Statut"]}>
            {(attendance.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2">{a.studentName}</td>
                <td className="px-4 py-2"><Badge tone={a.status === "PRESENT" ? "green" : a.status === "ABSENT" ? "red" : "orange"}>{ATTENDANCE_LABELS[a.status]}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
