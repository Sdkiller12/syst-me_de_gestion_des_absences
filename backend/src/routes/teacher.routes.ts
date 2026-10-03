import { Router } from "express";
import multer from "multer";
import { teacherController } from "../controllers/teacher.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  accountStatusSchema,
  assignmentQuerySchema,
  assignmentsCreateSchema,
  bulkAccountsSchema,
  idParamSchema,
  teacherAssignmentParamSchema,
  teacherCreateSchema,
  teacherImportRowsSchema,
  teacherQuerySchema,
  teacherUpdateSchema,
} from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, requireSchool } from "../middlewares/authorize.js";
import { importLimiter } from "../middlewares/rateLimiter.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Gestion des enseignants : réservée à l'administration de l'établissement
const router = Router();
router.use(authenticate, requireSchool, authorize("SCHOOL_ADMIN"));

router.get("/", validate("query", teacherQuerySchema), teacherController.list);
router.post("/", validate("body", teacherCreateSchema), teacherController.create);
router.get("/stats", teacherController.stats);

router.post("/import/preview", importLimiter, upload.single("file"), teacherController.importPreview);
router.post("/import/revalidate", validate("body", teacherImportRowsSchema), teacherController.importRevalidate);
router.post("/import/confirm", validate("body", teacherImportRowsSchema), teacherController.importConfirm);

router.post("/accounts", validate("body", bulkAccountsSchema), teacherController.createAccounts);

router.get("/:id", validate("params", idParamSchema), teacherController.getOne);
router.patch("/:id", validate("params", idParamSchema), validate("body", teacherUpdateSchema), teacherController.update);
router.delete("/:id", validate("params", idParamSchema), teacherController.remove);

router.post("/:id/account", validate("params", idParamSchema), teacherController.createAccount);
router.post("/:id/reset-password", validate("params", idParamSchema), teacherController.resetPassword);
router.patch("/:id/account-status", validate("params", idParamSchema), validate("body", accountStatusSchema), teacherController.setAccountStatus);

router.get("/:id/assignments", validate("params", idParamSchema), validate("query", assignmentQuerySchema), teacherController.listAssignments);
router.post("/:id/assignments", validate("params", idParamSchema), validate("body", assignmentsCreateSchema), teacherController.createAssignments);
router.delete("/:id/assignments/:assignmentId", validate("params", teacherAssignmentParamSchema), teacherController.deleteAssignment);

export default router;
