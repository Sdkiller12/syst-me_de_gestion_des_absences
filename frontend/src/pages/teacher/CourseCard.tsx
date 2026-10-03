import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, MapPin } from "lucide-react";
import type { TeacherCourse } from "../../types";

/** Carte d'un cours de l'enseignant, avec accès direct à l'appel */
export function CourseCard({ course, showDate = false }: { course: TeacherCourse; showDate?: boolean }) {
  const date = new Date(`${course.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs">
      <div>
        <p className="text-base font-bold text-slate-900">{course.subject}</p>
        <p className="text-sm font-semibold text-emerald-700">{course.className}</p>
        <p className="mt-1 text-sm text-slate-600">
          {showDate ? <span className="capitalize">{date} · </span> : null}
          {course.startTime} — {course.endTime}
          {course.room ? (
            <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-500">
              <MapPin size={12} /> {course.room}
            </span>
          ) : null}
        </p>
      </div>
      {course.attendanceTaken ? (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={14} /> Appel fait · {course.counts.ABSENT} absent(s)
          </span>
          <Link to={`/teacher/attendance?courseId=${course.id}`} className="text-xs font-semibold text-slate-600 hover:underline">
            Modifier
          </Link>
        </div>
      ) : (
        <Link
          to={`/teacher/attendance?courseId=${course.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          <ClipboardCheck size={16} /> Faire l'appel
        </Link>
      )}
    </div>
  );
}
