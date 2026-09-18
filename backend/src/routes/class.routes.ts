import { Router } from "express";
import { classController } from "../controllers/class.controller.js";
import { validate } from "../middlewares/validate.js";
import { classSchemaExtended, classQuerySchema, idParamSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate, requireSchool);
router.get("/", validate("query", classQuerySchema), classController.list);
router.get("/:id", validate("params", idParamSchema), classController.getOne);
router.post("/", authorize("SCHOOL_ADMIN", "TEACHER"), validate("body", classSchemaExtended), classController.create);
router.patch("/:id", authorize("SCHOOL_ADMIN"), validate("body", classSchemaExtended.partial()), classController.update);
router.put("/:id", authorize("SCHOOL_ADMIN"), validate("body", classSchemaExtended), classController.update);
router.delete("/:id", authorize("SCHOOL_ADMIN"), classController.remove);

export default router;
