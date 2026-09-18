import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema, registerSchoolSchema, refreshSchema } from "../validators/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

/**
 * @openapi
 * /api/auth/register-school:
 *   post:
 *     summary: Créer un compte école (onboarding)
 */
router.post("/register-school", validate("body", registerSchoolSchema), authController.registerSchool);
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Connexion
 */
router.post("/login", loginLimiter, validate("body", loginSchema), authController.login);
router.post("/refresh", validate("body", refreshSchema), authController.refresh);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
