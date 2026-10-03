import type { Request } from "express";
import { teacherSpaceService } from "../services/teacherSpace.service.js";
import type { TeacherRequest } from "../middlewares/teacherAccess.js";
import { audit } from "../utils/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Le contexte enseignant vient du jeton (requireTeacherProfile), jamais d'un identifiant envoyé par le client
const teacher = (req: Request) => (req as TeacherRequest).teacher!;

export const teacherSpaceController = {
  me: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherSpaceService.me(teacher(req)) });
  }),

  dashboard: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherSpaceService.dashboard(teacher(req)) });
  }),

  classes: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherSpaceService.classes(teacher(req)) });
  }),

  classStudents: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherSpaceService.classStudents(teacher(req), req.params.classId as string) });
  }),

  courses: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherSpaceService.courses(teacher(req), req.query as Record<string, unknown>) });
  }),

  sheet: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherSpaceService.sheet(teacher(req), req.query as { courseId?: string; assignmentId?: string }) });
  }),

  saveAttendance: asyncHandler(async (req, res) => {
    const data = await teacherSpaceService.saveAttendance(teacher(req), req.body);
    await audit(req as TeacherRequest, "ATTENDANCE_SAVE", "Course", data.courseId, { ...data.counts, smsQueued: data.smsQueued });
    res.status(201).json({ success: true, data });
  }),

  history: asyncHandler(async (req, res) => {
    const result = await teacherSpaceService.history(teacher(req), req.query as Record<string, unknown>);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  }),

  session: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherSpaceService.session(teacher(req), req.params.courseId as string) });
  }),
};
