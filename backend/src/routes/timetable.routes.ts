import { Router } from "express";
import { adminTimetableController } from "../controllers/timetable.controller.js";
import { validate } from "../middlewares/validate.js";
import { idParamSchema, timetableEntryCreateSchema, timetableEntryUpdateSchema, timetableQuerySchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

// Emploi du temps : géré exclusivement par l'administration de l'établissement
const router = Router();
router.use(authenticate, requireSchool, authorize("SCHOOL_ADMIN"));

router.get("/", validate("query", timetableQuerySchema), adminTimetableController.list);
router.post("/", validate("body", timetableEntryCreateSchema), adminTimetableController.create);
router.put("/:id", validate("params", idParamSchema), validate("body", timetableEntryUpdateSchema), adminTimetableController.update);
router.patch("/:id", validate("params", idParamSchema), validate("body", timetableEntryUpdateSchema), adminTimetableController.update);
router.delete("/:id", validate("params", idParamSchema), adminTimetableController.remove);

export default router;
