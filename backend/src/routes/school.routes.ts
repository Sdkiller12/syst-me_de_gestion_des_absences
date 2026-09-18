import { Router } from "express";
import { schoolController } from "../controllers/school.controller.js";
import { validate } from "../middlewares/validate.js";
import { schoolUpdateSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate);
router.get("/me", schoolController.me);
router.patch("/me", authorize("SCHOOL_ADMIN"), validate("body", schoolUpdateSchema), schoolController.update);

export default router;
