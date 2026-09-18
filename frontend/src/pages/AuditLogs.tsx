import { useAuditLogs } from "../hooks/useApi";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Table } from "../components/ui/Table";
import { formatDateTime } from "../utils/format";

export function AuditLogs() {
  const query = useAuditLogs();

  if (query.isLoading) return <LoadingState label="Chargement du journal d'audit…" />;
  if (query.isError) return <ErrorState message="Impossible de charger le journal d'audit." onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Journal d’audit</h1>
        <EmptyState title="Aucune activité enregistrée" description="Les actions importantes apparaîtront ici." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[#0F172A]">Journal d’audit</h1>
      <Table headers={["Date", "Action", "Entité", "ID entité"]}>
        {query.data.map((a) => (
          <tr key={a.id}>
            <td className="px-4 py-2 text-xs">{formatDateTime(a.createdAt)}</td>
            <td className="px-4 py-2 font-medium">{a.action}</td>
            <td className="px-4 py-2">{a.entity}</td>
            <td className="px-4 py-2 text-xs">{a.entityId ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
