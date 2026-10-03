import { Router } from "express";
import { teacherSpaceController } from "../controllers/teacherSpace.controller.js";
import { teacherGradeController } from "../controllers/grade.controller.js";
import { teacherTimetableController } from "../controllers/timetable.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  classIdParamSchema,
  courseIdParamSchema,
  evaluationCreateSchema,
  evaluationQuerySchema,
  evaluationUpdateSchema,
  gradesSaveSchema,
  gradeUpdateSchema,
  idParamSchema,
  teacherGradesPostSchema,
  teacherAttendanceSchema,
  teacherCoursesQuerySchema,
  teacherHistoryQuerySchema,
  teacherSheetQuerySchema,
} from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSchool } from "../middlewares/authorize.js";
import { requireRole, requireTeacherAssignment, requireTeacherProfile } from "../middlewares/teacherAccess.js";

/**
 * Espace enseignant. Chaîne de contrôle : authenticate → requireRole(TEACHER) → requireSchool
 * → requireTeacherProfile → requireTeacherAssignment (sur les routes qui visent une classe/un cours).
 */
const router = Router();
router.use(authenticate, requireRole("TEACHER"), requireSchool, requireTeacherProfile);

router.get("/me", teacherSpaceController.me);
router.get("/dashboard", teacherSpaceController.dashboard);
router.get("/classes", teacherSpaceController.classes);
router.get("/classes/:classId/students", validate("params", classIdParamSchema), requireTeacherAssignment, teacherSpaceController.classStudents);
router.get("/courses", validate("query", teacherCoursesQuerySchema), teacherSpaceController.courses);

router.get("/attendance/sheet", validate("query", teacherSheetQuerySchema), requireTeacherAssignment, teacherSpaceController.sheet);
router.get("/attendance", validate("query", teacherHistoryQuerySchema), requireTeacherAssignment, teacherSpaceController.history);
router.post("/attendance", validate("body", teacherAttendanceSchema), requireTeacherAssignment, teacherSpaceController.saveAttendance);
router.get("/attendance/:courseId", validate("params", courseIdParamSchema), requireTeacherAssignment, teacherSpaceController.session);

// Notes : uniquement sur les évaluations de l'enseignant, pour ses classes et matières affectées
router.get("/evaluations", validate("query", evaluationQuerySchema), requireTeacherAssignment, teacherGradeController.listEvaluations);
router.post("/evaluations", validate("body", evaluationCreateSchema), requireTeacherAssignment, teacherGradeController.createEvaluation);
router.get("/evaluations/:id", validate("params", idParamSchema), teacherGradeController.getEvaluation);
router.patch("/evaluations/:id", validate("params", idParamSchema), validate("body", evaluationUpdateSchema), teacherGradeController.updateEvaluation);
router.delete("/evaluations/:id", validate("params", idParamSchema), teacherGradeController.deleteEvaluation);
router.put("/evaluations/:id/grades", validate("params", idParamSchema), validate("body", gradesSaveSchema), teacherGradeController.saveEvaluationGrades);
router.get("/grades", validate("query", evaluationQuerySchema), requireTeacherAssignment, teacherGradeController.listGrades);
router.post("/grades", validate("body", teacherGradesPostSchema), teacherGradeController.postGrades);
router.put("/grades/:id", validate("params", idParamSchema), validate("body", gradeUpdateSchema), teacherGradeController.updateGrade);

// Emploi du temps : consultation seule, géré par l'administration
router.get("/timetable", teacherTimetableController.mine);

export default router;
