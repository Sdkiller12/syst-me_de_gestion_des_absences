import { api, unwrap } from "./api";
import type { ClassOption, ClassTimetable, TeacherTimetable, TimetableEntry } from "../types";

export interface TimetableEntryInput {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}

export const timetableService = {
  // Administration : seule à créer, modifier et supprimer des créneaux
  async forClass(classId: string): Promise<ClassTimetable> {
    return unwrap<ClassTimetable>(await api.get("/admin/timetable", { params: { classId } }));
  },

  async forTeacher(teacherId: string): Promise<TeacherTimetable> {
    return unwrap<TeacherTimetable>(await api.get("/admin/timetable", { params: { teacherId } }));
  },

  async create(payload: TimetableEntryInput): Promise<TimetableEntry> {
    return unwrap<TimetableEntry>(await api.post("/admin/timetable", payload));
  },

  async update(id: string, payload: Omit<TimetableEntryInput, "classId">): Promise<TimetableEntry> {
    return unwrap<TimetableEntry>(await api.put(`/admin/timetable/${id}`, payload));
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/admin/timetable/${id}`);
  },

  // Enseignant : consultation de son propre emploi du temps
  async mine(): Promise<TeacherTimetable> {
    return unwrap<TeacherTimetable>(await api.get("/teacher/timetable"));
  },

  // Consultation publique à partir du lien de l'établissement (sans compte)
  async publicSchool(schoolId: string): Promise<{ school: { id: string; name: string; city: string | null }; classes: ClassOption[] }> {
    return unwrap(await api.get(`/public/schools/${schoolId}`));
  },

  async publicClass(schoolId: string, classId: string): Promise<ClassTimetable> {
    return unwrap<ClassTimetable>(await api.get(`/public/schools/${schoolId}/classes/${classId}/timetable`));
  },
};
