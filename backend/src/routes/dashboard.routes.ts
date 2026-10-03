import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";

const router = Router();

// Les enseignants passent par /api/teacher (accès limité à leurs affectations)
router.use(authenticate, requireSchool, authorize("SCHOOL_ADMIN"));
router.get("/", dashboardController.stats);
router.get("/stats", dashboardController.stats);
router.get("/attendance-chart", dashboardController.chart);
router.get("/recent-absences", dashboardController.stats);
router.get("/recent-notifications", dashboardController.stats);

export default router;
