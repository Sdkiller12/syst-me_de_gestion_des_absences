import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { Login } from "../pages/Login";
import { RegisterSchool } from "../pages/RegisterSchool";
import { Dashboard } from "../pages/Dashboard";
import { Classes } from "../pages/Classes";
import { ClassDetail } from "../pages/ClassDetail";
import { Students } from "../pages/Students";
import { StudentDetail } from "../pages/StudentDetail";
import { StudentImportPage } from "../pages/StudentImportPage";
import { Courses } from "../pages/Courses";
import { CourseDetail } from "../pages/CourseDetail";
import { Attendance } from "../pages/Attendance";
import { Notifications } from "../pages/Notifications";
import { History } from "../pages/History";
import { Teachers } from "../pages/Teachers";
import { AuditLogs } from "../pages/AuditLogs";
import { Settings } from "../pages/Settings";

function Guard({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register-school", element: <RegisterSchool /> },
  {
    path: "/",
    element: (
      <Guard>
        <DashboardLayout />
      </Guard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "classes", element: <Classes /> },
      { path: "classes/:id", element: <ClassDetail /> },
      { path: "students", element: <Students /> },
      { path: "students/import", element: <Guard roles={["SCHOOL_ADMIN", "SUPER_ADMIN"]}><StudentImportPage /></Guard> },
      { path: "students/:id", element: <StudentDetail /> },
      { path: "courses", element: <Courses /> },
      { path: "courses/:id", element: <CourseDetail /> },
      { path: "attendance", element: <Attendance /> },
      { path: "notifications", element: <Notifications /> },
      { path: "sms", element: <Notifications /> },
      { path: "history", element: <History /> },
      { path: "teachers", element: <Guard roles={["SCHOOL_ADMIN", "SUPER_ADMIN"]}><Teachers /></Guard> },
      { path: "audit-logs", element: <Guard roles={["SCHOOL_ADMIN", "SUPER_ADMIN"]}><AuditLogs /></Guard> },
      { path: "settings", element: <Settings /> },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
