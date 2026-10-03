import type { Request } from "express";
import { studentSpaceService } from "../services/studentSpace.service.js";
import type { StudentRequest } from "../middlewares/studentAccess.js";
import type { GradeFilters } from "../services/grade.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// L'élève vient du jeton (requireStudentProfile), jamais d'un identifiant envoyé par le client
const student = (req: Request) => (req as StudentRequest).student!;

export const studentSpaceController = {
  me: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await studentSpaceService.me(student(req)) });
  }),

  grades: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await studentSpaceService.grades(student(req), req.query as GradeFilters) });
  }),

  timetable: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await studentSpaceService.timetable(student(req)) });
  }),

  classes: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await studentSpaceService.classes(student(req)) });
  }),

  classTimetable: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await studentSpaceService.classTimetable(student(req), req.params.classId as string) });
  }),
};
