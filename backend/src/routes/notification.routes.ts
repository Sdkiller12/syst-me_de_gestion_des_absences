import { Router } from "express";
import { notificationController } from "../controllers/notification.controller.js";
import { validate } from "../middlewares/validate.js";
import { notificationQuerySchema, idParamSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";
import { retryLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

router.use(authenticate, requireSchool);
router.get("/", validate("query", notificationQuerySchema), notificationController.list);
// SMS logs alias (same store)
router.get("/logs", validate("query", notificationQuerySchema), notificationController.list);
router.get("/:id", validate("params", idParamSchema), notificationController.getOne);
router.post("/:id/retry", authorize("SCHOOL_ADMIN", "TEACHER"), retryLimiter, validate("params", idParamSchema), notificationController.retry);

export default router;
