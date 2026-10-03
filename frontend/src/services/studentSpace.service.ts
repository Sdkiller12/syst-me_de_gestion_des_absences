import { api, unwrap } from "./api";
import type { ClassOption, ClassTimetable, EvaluationType, GradeReport, StudentProfile } from "../types";

/**
 * Espace étudiant. Aucun identifiant d'élève n'est envoyé : le serveur ne renvoie que
 * les données de l'élève connecté.
 */
export const studentSpaceService = {
  async me(): Promise<StudentProfile> {
    return unwrap<StudentProfile>(await api.get("/student/me"));
  },

  async grades(params: { subjectId?: string; type?: EvaluationType | ""; from?: string; to?: string }): Promise<GradeReport> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined));
    return unwrap<GradeReport>(await api.get("/student/grades", { params: clean }));
  },

  async timetable(): Promise<ClassTimetable> {
    return unwrap<ClassTimetable>(await api.get("/student/timetable"));
  },

  async classes(): Promise<{ myClassId: string; classes: ClassOption[] }> {
    return unwrap(await api.get("/student/classes"));
  },

  async classTimetable(classId: string): Promise<ClassTimetable> {
    return unwrap<ClassTimetable>(await api.get(`/student/classes/${classId}/timetable`));
  },
};
