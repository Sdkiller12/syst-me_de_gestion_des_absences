import { Router } from "express";
import { courseController } from "../controllers/course.controller.js";
import { validate } from "../middlewares/validate.js";
import { courseSchemaExtended, courseQuerySchema, idParamSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate, requireSchool);
router.get("/", validate("query", courseQuerySchema), courseController.list);
router.get("/:id", validate("params", idParamSchema), courseController.getOne);
router.post("/", authorize("SCHOOL_ADMIN", "TEACHER"), validate("body", courseSchemaExtended), courseController.create);
router.patch("/:id", authorize("SCHOOL_ADMIN", "TEACHER"), courseController.update);
router.put("/:id", authorize("SCHOOL_ADMIN", "TEACHER"), courseController.update);
router.delete("/:id", authorize("SCHOOL_ADMIN"), courseController.remove);

export default router;
