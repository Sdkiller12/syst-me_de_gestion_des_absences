import { useQuery, useQueryClient } from "@tanstack/react-query";
import { teacherService } from "../services/teacher.service";
import { subjectService } from "../services/subject.service";
import { teacherSpaceService } from "../services/teacherSpace.service";
import type { AttendanceStatus } from "../types";

// ─── Administration ─────────────────────────────────────────────────────────

export function useTeacherList(params: { search?: string; account?: "none" | "active" | "disabled" }) {
  return useQuery({ queryKey: ["teachers", params], queryFn: () => teacherService.list(params) });
}

export function useTeacherStats() {
  return useQuery({ queryKey: ["teachers", "stats"], queryFn: teacherService.stats });
}

export function useTeacher(id: string) {
  return useQuery({ queryKey: ["teachers", "one", id], queryFn: () => teacherService.get(id), enabled: !!id });
}

export function useTeacherAssignments(id: string) {
  return useQuery({ queryKey: ["teachers", "assignments", id], queryFn: () => teacherService.assignments(id), enabled: !!id });
}

export function useSchoolAssignments(classId?: string) {
  return useQuery({ queryKey: ["assignments", classId ?? ""], queryFn: () => teacherService.schoolAssignments({ classId }) });
}

export function useSubjects(params?: { search?: string; active?: boolean }) {
  return useQuery({ queryKey: ["subjects", params ?? {}], queryFn: () => subjectService.list(params) });
}

/** Invalide tout ce qui dépend des enseignants, matières et affectations */
export function useInvalidateTeachers() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["teachers"] }),
      qc.invalidateQueries({ queryKey: ["subjects"] }),
      qc.invalidateQueries({ queryKey: ["assignments"] }),
    ]);
}

// ─── Espace enseignant ──────────────────────────────────────────────────────

export function useTeacherMe() {
  return useQuery({ queryKey: ["teacher-space", "me"], queryFn: teacherSpaceService.me });
}

export function useTeacherDashboard() {
  return useQuery({ queryKey: ["teacher-space", "dashboard"], queryFn: teacherSpaceService.dashboard, refetchInterval: 60_000 });
}

export function useTeacherClasses() {
  return useQuery({ queryKey: ["teacher-space", "classes"], queryFn: teacherSpaceService.classes });
}

export function useTeacherClassStudents(classId: string | null) {
  return useQuery({
    queryKey: ["teacher-space", "students", classId],
    queryFn: () => teacherSpaceService.classStudents(classId!),
    enabled: !!classId,
  });
}

export function useTeacherCourses() {
  return useQuery({ queryKey: ["teacher-space", "courses"], queryFn: () => teacherSpaceService.courses() });
}

export function useAttendanceSheet(params: { courseId?: string; assignmentId?: string }) {
  return useQuery({
    queryKey: ["teacher-space", "sheet", params],
    queryFn: () => teacherSpaceService.sheet(params),
    enabled: !!(params.courseId || params.assignmentId),
    // La feuille reflète l'état au moment de l'appel, pas de rafraîchissement surprise
    refetchOnWindowFocus: false,
  });
}

export function useTeacherHistory(params: {
  page: number;
  classId?: string;
  subjectId?: string;
  from?: string;
  to?: string;
  status?: AttendanceStatus | "";
}) {
  return useQuery({ queryKey: ["teacher-space", "history", params], queryFn: () => teacherSpaceService.history(params) });
}

export function useAttendanceSession(courseId: string | null) {
  return useQuery({
    queryKey: ["teacher-space", "session", courseId],
    queryFn: () => teacherSpaceService.session(courseId!),
    enabled: !!courseId,
  });
}
