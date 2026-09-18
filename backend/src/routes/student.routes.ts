import { Router } from "express";
import multer from "multer";
import { studentController } from "../controllers/student.controller.js";
import { importController } from "../controllers/import.controller.js";
import { validate } from "../middlewares/validate.js";
import { studentSchemaExtended, studentQuerySchema, idParamSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";
import { importLimiter } from "../middlewares/rateLimiter.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(authenticate, requireSchool);

// Student Import Endpoints
router.post("/import/preview", authorize("SCHOOL_ADMIN"), importLimiter, upload.single("file"), importController.preview);
router.post("/import/confirm", authorize("SCHOOL_ADMIN"), importController.confirm);
router.get("/import/history", authorize("SCHOOL_ADMIN"), importController.history);
router.get("/import/export-report/:id", authorize("SCHOOL_ADMIN"), importController.exportReport);
router.post("/import", authorize("SCHOOL_ADMIN"), importLimiter, upload.single("file"), importController.preview);

// Student CRUD Endpoints
router.get("/", validate("query", studentQuerySchema), studentController.list);
router.get("/:id", validate("params", idParamSchema), studentController.getOne);
router.post("/", authorize("SCHOOL_ADMIN"), validate("body", studentSchemaExtended), studentController.create);
router.patch("/:id", authorize("SCHOOL_ADMIN"), studentController.update);
router.put("/:id", authorize("SCHOOL_ADMIN"), validate("body", studentSchemaExtended), studentController.update);
router.delete("/:id", authorize("SCHOOL_ADMIN"), studentController.remove);

export default router;

