import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useClass, useCourses, useStudents } from "../hooks/useApi";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { ExcelImporter } from "../components/ExcelImporter";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { Table } from "../components/ui/Table";

export function ClassDetail() {
  const { id = "" } = useParams();
  const cls = useClass(id);
  const students = useStudents({ classId: id });
  const courses = useCourses(id);
  const [importOpen, setImportOpen] = useState(false);

  if (cls.isLoading) return <LoadingState />;
  if (cls.isError || !cls.data) return <ErrorState message="Classe introuvable." />;

  return (
    <div className="space-y-4">
      <Link to="/classes" className="text-sm font-medium text-[#2563EB] hover:underline">
        ← Retour aux classes
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">{cls.data.name}</h1>
          <p className="text-sm text-[#64748B]">
            {cls.data.academicYear} — {students.data?.length ?? 0} étudiants
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Importer Excel
          </Button>
          <Link to={`/students?classId=${id}`}>
            <Button>Voir les étudiants</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold">Étudiants</h2>
          <p className="mt-1 text-2xl font-semibold">{students.data?.length ?? 0}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Cours</h2>
          <p className="mt-1 text-2xl font-semibold">{courses.data?.length ?? 0}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Actions</h2>
          <div className="mt-2 flex flex-col gap-2">
            <Link to="/attendance" className="text-sm font-medium text-[#2563EB] hover:underline">
              Faire l’appel →
            </Link>
            <Link to="/courses" className="text-sm font-medium text-[#2563EB] hover:underline">
              Créer un cours →
            </Link>
          </div>
        </Card>
      </div>

      {students.data && students.data.length === 0 ? (
        <EmptyState
          title="Aucun étudiant enregistré dans cette classe"
          description="Importez votre liste Excel réelle pour commencer. Aucune donnée de démonstration ne sera affichée."
          action={<Button onClick={() => setImportOpen(true)}>Importer Excel</Button>}
        />
      ) : (
        <Table headers={["Nom", "Prénom", "Téléphone"]}>
          {(students.data ?? []).slice(0, 10).map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2">{s.lastName}</td>
              <td className="px-4 py-2">{s.firstName}</td>
              <td className="px-4 py-2">{s.phone}</td>
            </tr>
          ))}
        </Table>
      )}

      {importOpen ? (
        <Modal title="Importer des étudiants" onClose={() => setImportOpen(false)}>
          <ExcelImporter
            classId={id}
            onDone={() => {
              void students.refetch();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
