import type { Request } from "express";
import { timetableService } from "../services/timetable.service.js";
import type { TeacherRequest } from "../middlewares/teacherAccess.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { forbidden } from "../utils/errors.js";

const id = (req: Request) => req.params.id as string;

function schoolOf(req: Request) {
  const schoolId = (req as AuthRequest).user!.schoolId;
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export const adminTimetableController = {
  list: asyncHandler(async (req, res) => {
    const { classId, teacherId } = req.query as { classId?: string; teacherId?: string };
    const data = classId ? await timetableService.forClass(schoolOf(req), classId) : await timetableService.forTeacher(schoolOf(req), teacherId!);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await timetableService.create(schoolOf(req), req.body);
    await audit(req as AuthRequest, "TIMETABLE_CREATE", "TimetableEntry", data.id, { classId: data.class.id, dayOfWeek: data.dayOfWeek, startTime: data.startTime });
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await timetableService.update(schoolOf(req), id(req), req.body);
    await audit(req as AuthRequest, "TIMETABLE_UPDATE", "TimetableEntry", data.id, { changes: req.body });
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req, res) => {
    const data = await timetableService.remove(schoolOf(req), id(req));
    await audit(req as AuthRequest, "TIMETABLE_DELETE", "TimetableEntry", data.id, { classId: data.class.id, dayOfWeek: data.dayOfWeek, startTime: data.startTime });
    res.status(204).send();
  }),
};

/** Emploi du temps de l'enseignant connecté (lecture seule) */
export const teacherTimetableController = {
  mine: asyncHandler(async (req, res) => {
    const ctx = (req as TeacherRequest).teacher!;
    res.json({ success: true, data: await timetableService.forTeacher(ctx.schoolId, ctx.teacherId) });
  }),
};

/** Consultation sans compte : classes et emplois du temps d'un établissement, sans aucune donnée d'élève */
export const publicTimetableController = {
  school: asyncHandler(async (req, res) => {
    const schoolId = req.params.schoolId as string;
    const [school, classes] = await Promise.all([timetableService.publicSchool(schoolId), timetableService.classes(schoolId)]);
    res.json({ success: true, data: { school, classes } });
  }),

  classTimetable: asyncHandler(async (req, res) => {
    const schoolId = req.params.schoolId as string;
    await timetableService.publicSchool(schoolId);
    res.json({ success: true, data: await timetableService.forClass(schoolId, req.params.classId as string, "public") });
  }),
};
