import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireSchool } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate, requireSchool);
router.get("/", dashboardController.stats);
router.get("/stats", dashboardController.stats);
router.get("/attendance-chart", dashboardController.chart);
router.get("/recent-absences", dashboardController.stats);
router.get("/recent-notifications", dashboardController.stats);

export default router;
