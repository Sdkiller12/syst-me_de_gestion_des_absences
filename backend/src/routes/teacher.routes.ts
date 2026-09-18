import { Router } from "express";
import { teacherController } from "../controllers/teacher.controller.js";
import { validate } from "../middlewares/validate.js";
import { teacherCreateSchema, teacherUpdateSchema, idParamSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate, requireSchool);
router.get("/", authorize("SCHOOL_ADMIN"), teacherController.list);
router.post("/", authorize("SCHOOL_ADMIN"), validate("body", teacherCreateSchema), teacherController.create);
router.patch("/:id", authorize("SCHOOL_ADMIN"), validate("params", idParamSchema), validate("body", teacherUpdateSchema), teacherController.update);
router.delete("/:id", authorize("SCHOOL_ADMIN"), validate("params", idParamSchema), teacherController.remove);

export default router;
