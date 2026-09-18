import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "../services/attendance.service";
import { classService } from "../services/class.service";
import { courseService } from "../services/course.service";
import { dashboardService } from "../services/dashboard.service";
import { notificationService } from "../services/notification.service";
import { studentService } from "../services/student.service";
import { teacherService } from "../services/teacher.service";
import { schoolService } from "../services/school.service";
import { auditService } from "../services/admin.service";
import type { AttendanceStatus } from "../types";

export function useDashboardStats() {
  return useQuery({ queryKey: ["dashboard-stats"], queryFn: dashboardService.stats, retry: 1 });
}

export function useSchool() {
  return useQuery({ queryKey: ["school"], queryFn: schoolService.me, retry: 1 });
}

export function useClasses(search?: string) {
  return useQuery({ queryKey: ["classes", search ?? ""], queryFn: () => classService.list(search), retry: 1 });
}

export function useClass(id: string) {
  return useQuery({ queryKey: ["class", id], queryFn: () => classService.get(id), enabled: !!id, retry: 1 });
}

export function useClassMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["classes"] });
    void qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };
  const create = useMutation({ mutationFn: classService.create, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (p: { id: string; name: string; academicYear: string; level?: string; section?: string }) =>
      classService.update(p.id, { name: p.name, academicYear: p.academicYear, level: p.level, section: p.section }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: classService.remove, onSuccess: invalidate });
  return { create, update, remove };
}

export function useStudents(params?: { search?: string; classId?: string }) {
  return useQuery({
    queryKey: ["students", params?.search ?? "", params?.classId ?? ""],
    queryFn: () => studentService.list(params),
    retry: 1,
  });
}

export function useStudentMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["students"] });
    void qc.invalidateQueries({ queryKey: ["classes"] });
  };
  const create = useMutation({ mutationFn: studentService.create, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (p: { id: string } & Parameters<typeof studentService.update>[1]) =>
      studentService.update(p.id, p),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: studentService.remove, onSuccess: invalidate });
  return { create, update, remove };
}

export function useCourses(classId?: string) {
  return useQuery({ queryKey: ["courses", classId ?? ""], queryFn: () => courseService.list(classId), retry: 1 });
}

export function useTeachers(search?: string) {
  return useQuery({ queryKey: ["teachers", search ?? ""], queryFn: () => teacherService.list(search), retry: 1 });
}

export function useAuditLogs() {
  return useQuery({ queryKey: ["audit-logs"], queryFn: auditService.list, retry: 1 });
}

export function useAttendance(courseId?: string) {
  return useQuery({
    queryKey: ["attendance", courseId ?? ""],
    queryFn: () => (courseId ? attendanceService.byCourse(courseId) : attendanceService.list()),
    retry: 1,
  });
}

export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { courseId: string; records: Array<{ studentId: string; status: AttendanceStatus; justification?: string }> }) =>
      attendanceService.save(p.courseId, p.records),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["attendance"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["attendance", v.courseId] });
    },
  });
}

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: notificationService.list, retry: 1, refetchInterval: 15000 });
}

export function useRetryNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.retry,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
