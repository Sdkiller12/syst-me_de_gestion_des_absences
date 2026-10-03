import { useQuery } from "@tanstack/react-query";
import { adminGradeService, teacherGradeService } from "../services/grade.service";
import type { GradeFilters } from "../services/grade.service";
import { timetableService } from "../services/timetable.service";
import { studentSpaceService } from "../services/studentSpace.service";
import type { EvaluationType } from "../types";

// ─── Notes : enseignant ─────────────────────────────────────────────────────

export function useTeacherEvaluations(params: GradeFilters) {
  return useQuery({ queryKey: ["teacher-space", "evaluations", params], queryFn: () => teacherGradeService.evaluations(params) });
}

export function useEvaluationSheet(id: string | null) {
  return useQuery({
    queryKey: ["teacher-space", "evaluation", id],
    queryFn: () => teacherGradeService.evaluation(id!),
    enabled: !!id,
    // La saisie en cours ne doit pas être écrasée par un rafraîchissement automatique
    refetchOnWindowFocus: false,
  });
}

// ─── Notes : administration (lecture seule) ─────────────────────────────────

export function useAdminGrades(params: GradeFilters) {
  return useQuery({ queryKey: ["admin-grades", "list", params], queryFn: () => adminGradeService.grades(params) });
}

export function useAdminEvaluations(params: GradeFilters) {
  return useQuery({ queryKey: ["admin-grades", "evaluations", params], queryFn: () => adminGradeService.evaluations(params) });
}

export function useAdminEvaluation(id: string | null) {
  return useQuery({ queryKey: ["admin-grades", "evaluation", id], queryFn: () => adminGradeService.evaluation(id!), enabled: !!id });
}

export function useAdminGradeStats(params: GradeFilters) {
  return useQuery({ queryKey: ["admin-grades", "stats", params], queryFn: () => adminGradeService.stats(params) });
}

export function useAdminStudentReport(studentId: string, params: { subjectId?: string; type?: EvaluationType | ""; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["admin-grades", "student", studentId, params],
    queryFn: () => adminGradeService.studentReport(studentId, params),
    enabled: !!studentId,
  });
}

// ─── Emploi du temps ────────────────────────────────────────────────────────

export function useClassTimetable(classId: string) {
  return useQuery({ queryKey: ["timetable", "class", classId], queryFn: () => timetableService.forClass(classId), enabled: !!classId });
}

export function useTeacherTimetableAdmin(teacherId: string) {
  return useQuery({ queryKey: ["timetable", "teacher", teacherId], queryFn: () => timetableService.forTeacher(teacherId), enabled: !!teacherId });
}

export function useMyTeacherTimetable() {
  return useQuery({ queryKey: ["teacher-space", "timetable"], queryFn: timetableService.mine });
}

export function usePublicSchool(schoolId: string) {
  return useQuery({ queryKey: ["public", "school", schoolId], queryFn: () => timetableService.publicSchool(schoolId), retry: false });
}

export function usePublicClassTimetable(schoolId: string, classId: string) {
  return useQuery({
    queryKey: ["public", "timetable", schoolId, classId],
    queryFn: () => timetableService.publicClass(schoolId, classId),
    enabled: !!classId,
  });
}

// ─── Espace étudiant ────────────────────────────────────────────────────────

export function useStudentMe() {
  return useQuery({ queryKey: ["student-space", "me"], queryFn: studentSpaceService.me });
}

export function useStudentGrades(params: { subjectId?: string; type?: EvaluationType | ""; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["student-space", "grades", params],
    queryFn: () => studentSpaceService.grades(params),
    // Garde le relevé affiché pendant le changement de filtre (pas de clignotement)
    placeholderData: (previous) => previous,
  });
}

export function useStudentClasses() {
  return useQuery({ queryKey: ["student-space", "classes"], queryFn: studentSpaceService.classes });
}

/** Sans classe choisie : emploi du temps de la classe de l'élève */
export function useStudentTimetable(classId: string | null) {
  return useQuery({
    queryKey: ["student-space", "timetable", classId ?? "mine"],
    queryFn: () => (classId ? studentSpaceService.classTimetable(classId) : studentSpaceService.timetable()),
  });
}
