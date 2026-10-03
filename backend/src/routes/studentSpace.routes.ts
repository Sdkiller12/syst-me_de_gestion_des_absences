import { Router } from "express";
import { studentSpaceController } from "../controllers/studentSpace.controller.js";
import { validate } from "../middlewares/validate.js";
import { classIdParamSchema, studentGradeQuerySchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSchool } from "../middlewares/authorize.js";
import { requireRole } from "../middlewares/teacherAccess.js";
import { requireStudentProfile } from "../middlewares/studentAccess.js";

/**
 * Espace étudiant. Chaîne de contrôle : authenticate → requireRole(STUDENT) → requireSchool
 * → requireStudentProfile. Les notes sont toujours celles de l'élève du jeton.
 */
const router = Router();
router.use(authenticate, requireRole("STUDENT"), requireSchool, requireStudentProfile);

router.get("/me", studentSpaceController.me);
router.get("/grades", validate("query", studentGradeQuerySchema), studentSpaceController.grades);
router.get("/timetable", studentSpaceController.timetable);
router.get("/classes", studentSpaceController.classes);
router.get("/classes/:classId/timetable", validate("params", classIdParamSchema), studentSpaceController.classTimetable);

export default router;
