import { Router } from "express";
import { adminGradeController } from "../controllers/grade.controller.js";
import { validate } from "../middlewares/validate.js";
import { adminGradeQuerySchema, idParamSchema, studentGradeQuerySchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";
import { AppError } from "../utils/errors.js";

/**
 * Notes côté administration : LECTURE SEULE. Les notes appartiennent aux enseignants qui les
 * saisissent ; aucune route d'écriture n'existe ici et toute tentative est refusée explicitement.
 */
const router = Router();
router.use(authenticate, requireSchool, authorize("SCHOOL_ADMIN"));

router.use((req, _res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  return next(new AppError(405, "Les notes sont en lecture seule pour l'administration", "READ_ONLY"));
});

router.get("/", validate("query", adminGradeQuerySchema), adminGradeController.listGrades);
router.get("/stats", validate("query", adminGradeQuerySchema), adminGradeController.stats);
router.get("/evaluations", validate("query", adminGradeQuerySchema), adminGradeController.listEvaluations);
router.get("/evaluations/:id", validate("params", idParamSchema), adminGradeController.getEvaluation);
router.get("/students/:studentId", validate("query", studentGradeQuerySchema), adminGradeController.studentReport);

export default router;
