import { lazy, Suspense } from "react";
import type { ComponentType, ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { TeacherLayout } from "../layouts/TeacherLayout";
import { StudentLayout } from "../layouts/StudentLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { Login } from "../pages/Login";
import { RegisterSchool } from "../pages/RegisterSchool";
import { NotFound } from "../pages/NotFound";
import { ChangePassword } from "../pages/ChangePassword";
import { LoadingState } from "../components/ui/LoadingState";

// Pages chargées à la demande : chaque rôle ne télécharge que ce qu'il consulte
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const Component = lazy<ComponentType>(() => load().then((m) => ({ default: m[name] })));
  return (
    <Suspense fallback={<LoadingState />}>
      <Component />
    </Suspense>
  );
}

const Dashboard = page(() => import("../pages/Dashboard"), "Dashboard");
const Classes = page(() => import("../pages/Classes"), "Classes");
const ClassDetail = page(() => import("../pages/ClassDetail"), "ClassDetail");
const Students = page(() => import("../pages/Students"), "Students");
const StudentDetail = page(() => import("../pages/StudentDetail"), "StudentDetail");
const StudentImportPage = page(() => import("../pages/StudentImportPage"), "StudentImportPage");
const Courses = page(() => import("../pages/Courses"), "Courses");
const CourseDetail = page(() => import("../pages/CourseDetail"), "CourseDetail");
const Attendance = page(() => import("../pages/Attendance"), "Attendance");
const Notifications = page(() => import("../pages/Notifications"), "Notifications");
const History = page(() => import("../pages/History"), "History");
const Teachers = page(() => import("../pages/Teachers"), "Teachers");
const TeacherImport = page(() => import("../pages/TeacherImport"), "TeacherImport");
const TeacherAssignments = page(() => import("../pages/TeacherAssignments"), "TeacherAssignments");
const Subjects = page(() => import("../pages/Subjects"), "Subjects");
const AdminGrades = page(() => import("../pages/AdminGrades"), "AdminGrades");
const AdminTimetable = page(() => import("../pages/AdminTimetable"), "AdminTimetable");
const PublicTimetable = page(() => import("../pages/PublicTimetable"), "PublicTimetable");

// Espace enseignant
const TeacherDashboard = page(() => import("../pages/teacher/TeacherDashboard"), "TeacherDashboard");
const TeacherCourses = page(() => import("../pages/teacher/TeacherCourses"), "TeacherCourses");
const TeacherClasses = page(() => import("../pages/teacher/TeacherClasses"), "TeacherClasses");
const TeacherAttendance = page(() => import("../pages/teacher/TeacherAttendance"), "TeacherAttendance");
const TeacherHistory = page(() => import("../pages/teacher/TeacherHistory"), "TeacherHistory");
const TeacherProfile = page(() => import("../pages/teacher/TeacherProfile"), "TeacherProfile");
const TeacherGrades = page(() => import("../pages/teacher/TeacherGrades"), "TeacherGrades");
const TeacherTimetable = page(() => import("../pages/teacher/TeacherTimetable"), "TeacherTimetable");

// Espace étudiant
const StudentHome = page(() => import("../pages/student/StudentHome"), "StudentHome");
const StudentTimetable = page(() => import("../pages/student/StudentTimetable"), "StudentTimetable");
const StudentGrades = page(() => import("../pages/student/StudentGrades"), "StudentGrades");
const StudentProfile = page(() => import("../pages/student/StudentProfile"), "StudentProfile");
const AuditLogs = page(() => import("../pages/AuditLogs"), "AuditLogs");
const Settings = page(() => import("../pages/Settings"), "Settings");

function Guard({ children, roles }: { children: ReactNode; roles?: string[] }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}

const ADMINS = ["SCHOOL_ADMIN", "SUPER_ADMIN"];
const TEACHERS = ["TEACHER"];
const STUDENTS = ["STUDENT"];

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register-school", element: <RegisterSchool /> },
  // Emploi du temps consultable sans compte, depuis le lien de l'établissement
  { path: "/schools/:schoolId/timetable", element: PublicTimetable },
  { path: "/change-password", element: <Guard><ChangePassword /></Guard> },
  {
    // Espace administration : un enseignant qui s'y aventure est renvoyé vers son espace
    path: "/",
    element: (
      <Guard roles={ADMINS}>
        <DashboardLayout />
      </Guard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: Dashboard },
      { path: "classes", element: Classes },
      { path: "classes/:id", element: ClassDetail },
      { path: "students", element: Students },
      { path: "students/import", element: StudentImportPage },
      { path: "students/:id", element: StudentDetail },
      { path: "courses", element: Courses },
      { path: "courses/:id", element: CourseDetail },
      { path: "attendance", element: Attendance },
      { path: "notifications", element: Notifications },
      { path: "sms", element: Notifications },
      { path: "history", element: History },
      { path: "teachers", element: <Navigate to="/admin/teachers" replace /> },
      { path: "admin/teachers", element: Teachers },
      { path: "admin/teachers/import", element: TeacherImport },
      { path: "admin/teachers/:teacherId/assignments", element: TeacherAssignments },
      { path: "admin/subjects", element: Subjects },
      { path: "admin/timetable", element: AdminTimetable },
      { path: "admin/grades", element: AdminGrades },
      { path: "audit-logs", element: AuditLogs },
      { path: "settings", element: Settings },
    ],
  },
  {
    path: "/teacher",
    element: (
      <Guard roles={TEACHERS}>
        <TeacherLayout />
      </Guard>
    ),
    children: [
      { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
      { path: "dashboard", element: TeacherDashboard },
      { path: "courses", element: TeacherCourses },
      { path: "classes", element: TeacherClasses },
      { path: "attendance", element: TeacherAttendance },
      { path: "history", element: TeacherHistory },
      { path: "profile", element: TeacherProfile },
      { path: "grades", element: TeacherGrades },
      { path: "timetable", element: TeacherTimetable },
    ],
  },
  {
    path: "/student",
    element: (
      <Guard roles={STUDENTS}>
        <StudentLayout />
      </Guard>
    ),
    children: [
      { index: true, element: <Navigate to="/student/home" replace /> },
      { path: "home", element: StudentHome },
      { path: "timetable", element: StudentTimetable },
      { path: "grades", element: StudentGrades },
      { path: "profile", element: StudentProfile },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
