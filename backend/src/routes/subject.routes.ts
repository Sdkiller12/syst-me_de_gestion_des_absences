import { Router } from "express";
import { subjectController } from "../controllers/subject.controller.js";
import { teacherController } from "../controllers/teacher.controller.js";
import { validate } from "../middlewares/validate.js";
import { assignmentQuerySchema, idParamSchema, subjectCreateSchema, subjectUpdateSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

// Matières et vue d'ensemble des affectations : administration uniquement
export const subjectRouter = Router();
subjectRouter.use(authenticate, requireSchool, authorize("SCHOOL_ADMIN"));
subjectRouter.get("/", subjectController.list);
subjectRouter.post("/", validate("body", subjectCreateSchema), subjectController.create);
subjectRouter.patch("/:id", validate("params", idParamSchema), validate("body", subjectUpdateSchema), subjectController.update);
subjectRouter.delete("/:id", validate("params", idParamSchema), subjectController.remove);

export const assignmentRouter = Router();
assignmentRouter.use(authenticate, requireSchool, authorize("SCHOOL_ADMIN"));
assignmentRouter.get("/", validate("query", assignmentQuerySchema), teacherController.schoolAssignments);
