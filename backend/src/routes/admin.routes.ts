import { Router } from "express";
import { auditController, smsConfigController } from "../controllers/admin.controller.js";
import { validate } from "../middlewares/validate.js";
import { smsConfigSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate);
router.get("/audit-logs", authorize("SCHOOL_ADMIN"), requireSchool, auditController.list);
router.get("/sms-config", authorize("SCHOOL_ADMIN"), requireSchool, smsConfigController.get);
router.put("/sms-config", authorize("SCHOOL_ADMIN"), requireSchool, validate("body", smsConfigSchema), smsConfigController.upsert);

export default router;
