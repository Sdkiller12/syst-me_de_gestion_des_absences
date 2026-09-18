import { useState } from "react";
import { AlertCircle, Bell, CheckCircle2, Clock, RefreshCw, Phone } from "lucide-react";
import { useNotifications, useRetryNotification } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Table } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { NOTIFICATION_LABELS } from "../constants";
import { formatDateTime } from "../utils/format";

export function Notifications() {
  const query = useNotifications();
  const retry = useRetryNotification();
  const { notify } = useToast();
  const [filter, setFilter] = useState<"ALL" | "SENT" | "FAILED" | "PENDING">("ALL");

  if (query.isLoading) return <LoadingState label="Chargement des notifications SMS…" />;
  if (query.isError) return <ErrorState message="Impossible de charger l'historique SMS." onRetry={() => void query.refetch()} />;

  const allLogs = query.data ?? [];
  const sentCount = allLogs.filter((n) => n.status === "SENT").length;
  const failedCount = allLogs.filter((n) => n.status === "FAILED").length;
  const pendingCount = allLogs.filter((n) => n.status === "PENDING").length;

  const filteredLogs = allLogs.filter((n) => {
    if (filter === "SENT") return n.status === "SENT";
    if (filter === "FAILED") return n.status === "FAILED";
    if (filter === "PENDING") return n.status === "PENDING";
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Bell className="text-indigo-600" size={24} />
            Notifications & Logs SMS
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Suivi en temps réel des messages SMS d'absence envoyés aux parents d'étudiants.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Messages</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{allLogs.length}</p>
        </div>
        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-700 uppercase flex items-center gap-1">
            <CheckCircle2 size={14} /> SMS Délivrés
          </p>
          <p className="text-2xl font-extrabold text-emerald-900 mt-1">{sentCount}</p>
        </div>
        <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200">
          <p className="text-xs font-semibold text-rose-700 uppercase flex items-center gap-1">
            <AlertCircle size={14} /> Échecs de Livraison
          </p>
          <p className="text-2xl font-extrabold text-rose-900 mt-1">{failedCount}</p>
        </div>
        <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
          <p className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1">
            <Clock size={14} /> En File d'Attente
          </p>
          <p className="text-2xl font-extrabold text-amber-900 mt-1">{pendingCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
            filter === "ALL" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Tous ({allLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("SENT")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
            filter === "SENT" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          Délivrés ({sentCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("FAILED")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
            filter === "FAILED" ? "bg-rose-600 text-white shadow-2xs" : "text-rose-700 hover:bg-rose-50"
          }`}
        >
          Échecs ({failedCount})
        </button>
      </div>

      {filteredLogs.length === 0 ? (
        <EmptyState title="Aucune notification" description="Aucun message ne correspond à ce filtre." />
      ) : (
        <Table headers={["Étudiant", "Numéro Destinataire", "Contenu du SMS", "Horodatage", "Statut", "Action"]}>
          {filteredLogs.map((n) => (
            <tr key={n.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-4 py-3 font-bold text-slate-900">{n.studentName}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600 flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400" /> {n.phone}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-xs font-medium text-slate-600" title={n.message}>
                {n.message}
              </td>
              <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDateTime(n.sentAt)}</td>
              <td className="px-4 py-3">
                <Badge
                  tone={
                    n.status === "SENT" ? "emerald" : n.status === "FAILED" ? "red" : "amber"
                  }
                >
                  {NOTIFICATION_LABELS[n.status]}
                </Badge>
                {n.errorMessage ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{n.errorMessage}</p> : null}
              </td>
              <td className="px-4 py-3">
                {n.status === "FAILED" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={retry.isPending}
                    onClick={() => {
                      void retry
                        .mutateAsync(n.id)
                        .then(() => notify("Notification remise en file d'envoi"))
                        .catch((e: Error) => notify(e.message, "error"));
                    }}
                  >
                    <RefreshCw size={13} /> Renvoyer
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
