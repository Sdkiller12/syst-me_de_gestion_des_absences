import { Router } from "express";
import { publicTimetableController } from "../controllers/timetable.controller.js";

/**
 * Consultation publique (sans compte) de l'emploi du temps d'une classe, à partir du lien
 * de l'établissement. Aucune donnée personnelle d'élève ni aucune note n'est exposée ici.
 */
const router = Router();

router.get("/schools/:schoolId", publicTimetableController.school);
router.get("/schools/:schoolId/classes/:classId/timetable", publicTimetableController.classTimetable);

export default router;
