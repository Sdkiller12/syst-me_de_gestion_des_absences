import { Router } from "express";
import { attendanceController } from "../controllers/attendance.controller.js";
import { validate } from "../middlewares/validate.js";
import { attendancePayloadSchema, attendanceQuerySchema, attendanceUpdateSchema, courseIdParamSchema, idParamSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate, requireSchool);
router.get("/", validate("query", attendanceQuerySchema), attendanceController.list);
router.get("/course/:courseId", validate("params", courseIdParamSchema), attendanceController.byCourse);
router.post("/", authorize("SCHOOL_ADMIN", "TEACHER"), validate("body", attendancePayloadSchema), attendanceController.save);
router.patch("/:id", authorize("SCHOOL_ADMIN", "TEACHER"), validate("params", idParamSchema), validate("body", attendanceUpdateSchema), attendanceController.updateOne);
router.put("/:id", authorize("SCHOOL_ADMIN", "TEACHER"), validate("params", idParamSchema), validate("body", attendanceUpdateSchema), attendanceController.updateOne);

// History alias
router.get("/history", validate("query", attendanceQuerySchema), attendanceController.list);

export default router;
