import type { Request } from "express";
import { adminGradeService, teacherGradeService, type GradeFilters } from "../services/grade.service.js";
import type { TeacherRequest } from "../middlewares/teacherAccess.js";
import type { AuthRequest } from "../types/index.js";
import { audit } from "../utils/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { forbidden } from "../utils/errors.js";

// Le contexte enseignant vient du jeton (requireTeacherProfile), jamais d'un identifiant envoyé par le client
const teacher = (req: Request) => (req as TeacherRequest).teacher!;
const id = (req: Request) => req.params.id as string;
const filters = (req: Request) => req.query as GradeFilters & { page?: number; limit?: number };

function schoolOf(req: Request) {
  const schoolId = (req as AuthRequest).user!.schoolId;
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export const teacherGradeController = {
  listEvaluations: asyncHandler(async (req, res) => {
    const result = await teacherGradeService.listEvaluations(teacher(req), filters(req));
    res.json({ success: true, data: result.data, pagination: result.pagination });
  }),

  getEvaluation: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await teacherGradeService.getEvaluation(teacher(req), id(req)) });
  }),

  createEvaluation: asyncHandler(async (req, res) => {
    const data = await teacherGradeService.createEvaluation(teacher(req), req.body);
    await audit(req as TeacherRequest, "EVALUATION_CREATE", "Evaluation", data.id, { title: data.title });
    res.status(201).json({ success: true, data });
  }),

  updateEvaluation: asyncHandler(async (req, res) => {
    const data = await teacherGradeService.updateEvaluation(teacher(req), id(req), req.body);
    await audit(req as TeacherRequest, "EVALUATION_UPDATE", "Evaluation", data.id, { changes: req.body });
    res.json({ success: true, data });
  }),

  deleteEvaluation: asyncHandler(async (req, res) => {
    const data = await teacherGradeService.deleteEvaluation(teacher(req), id(req));
    await audit(req as TeacherRequest, "EVALUATION_DELETE", "Evaluation", data.id, { title: data.title });
    res.status(204).send();
  }),

  saveEvaluationGrades: asyncHandler(async (req, res) => {
    const data = await teacherGradeService.saveEvaluationGrades(teacher(req), id(req), (req.body as { grades: never }).grades);
    await audit(req as TeacherRequest, "GRADES_SAVE", "Evaluation", data.evaluationId, { saved: data.saved, cleared: data.cleared });
    res.json({ success: true, data });
  }),

  listGrades: asyncHandler(async (req, res) => {
    const result = await teacherGradeService.listGrades(teacher(req), filters(req));
    res.json({ success: true, data: result.data, pagination: result.pagination });
  }),

  postGrades: asyncHandler(async (req, res) => {
    const data = await teacherGradeService.postGrades(teacher(req), req.body);
    await audit(req as TeacherRequest, "GRADES_SAVE", "Evaluation", data.evaluationId, { created: data.created, saved: data.saved, cleared: data.cleared });
    res.status(data.created ? 201 : 200).json({ success: true, data });
  }),

  updateGrade: asyncHandler(async (req, res) => {
    const { grade, previousScore } = await teacherGradeService.updateGrade(teacher(req), id(req), (req.body as { score: number }).score);
    await audit(req as TeacherRequest, "GRADE_UPDATE", "Grade", grade.id, { from: previousScore, to: grade.score, studentId: grade.student.id });
    res.json({ success: true, data: grade });
  }),
};

/** Administration : consultation uniquement, aucune route d'écriture n'est exposée */
export const adminGradeController = {
  listGrades: asyncHandler(async (req, res) => {
    const result = await adminGradeService.listGrades(schoolOf(req), filters(req));
    res.json({ success: true, data: result.data, pagination: result.pagination });
  }),

  listEvaluations: asyncHandler(async (req, res) => {
    const result = await adminGradeService.listEvaluations(schoolOf(req), filters(req));
    res.json({ success: true, data: result.data, pagination: result.pagination });
  }),

  getEvaluation: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await adminGradeService.getEvaluation(schoolOf(req), id(req)) });
  }),

  stats: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await adminGradeService.stats(schoolOf(req), filters(req)) });
  }),

  studentReport: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await adminGradeService.studentReport(schoolOf(req), req.params.studentId as string, filters(req)) });
  }),
};
