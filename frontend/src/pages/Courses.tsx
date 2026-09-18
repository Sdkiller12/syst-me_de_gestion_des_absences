import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useClasses, useCourses } from "../hooks/useApi";
import { courseService } from "../services/course.service";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { Table } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { courseSchema } from "../schemas";
import type { CourseInput } from "../schemas";

export function Courses() {
  const [classId, setClassId] = useState("");
  const courses = useCourses(classId || undefined);
  const classes = useClasses();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
  });

  async function onSubmit(values: CourseInput) {
    setPending(true);
    try {
      await courseService.create(values);
      await qc.invalidateQueries({ queryKey: ["courses"] });
      notify("Cours créé");
      setOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Cours</h1>
        <Button onClick={() => { reset({ subject: "", classId: classes.data?.[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), startTime: "08:00", endTime: "10:00" }); setOpen(true); }}>
          <Plus size={16} /> Nouveau cours
        </Button>
      </div>
      <select aria-label="Filtrer par classe" className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
        <option value="">Toutes les classes</option>
        {(classes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {courses.isLoading ? <LoadingState /> : null}
      {courses.isError ? <ErrorState message="Impossible de charger les cours." onRetry={() => void courses.refetch()} /> : null}
      {courses.data && courses.data.length === 0 ? <EmptyState title="Aucun cours" description="Créez un cours pour pouvoir faire l’appel." action={<Button onClick={() => setOpen(true)}>Créer un cours</Button>} /> : null}
      {courses.data && courses.data.length > 0 ? (
        <Table headers={["Matière", "Classe", "Date", "Horaire"]}>
          {courses.data.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2"><Link to={`/courses/${c.id}`} className="font-medium text-[#2563EB] hover:underline">{c.subject}</Link></td>
              <td className="px-4 py-2">{c.className}</td>
              <td className="px-4 py-2">{c.date}</td>
              <td className="px-4 py-2">{c.startTime} – {c.endTime}</td>
            </tr>
          ))}
        </Table>
      ) : null}

      {open ? (
        <Modal title="Nouveau cours" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
            <Select label="Classe" error={errors.classId?.message} options={[{ value: "", label: "Choisir…" }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} {...register("classId")} />
            <Input label="Matière" error={errors.subject?.message} {...register("subject")} />
            <Input label="Date" type="date" error={errors.date?.message} {...register("date")} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Heure début" type="time" error={errors.startTime?.message} {...register("startTime")} />
              <Input label="Heure fin" type="time" error={errors.endTime?.message} {...register("endTime")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" loading={pending}>Créer le cours</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
