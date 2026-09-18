import rateLimit from "express-rate-limit";
import { RATE_LIMITS } from "../constants/index.js";

export const globalLimiter = rateLimit({
  windowMs: RATE_LIMITS.global.windowMs,
  max: RATE_LIMITS.global.max,
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: RATE_LIMITS.login.windowMs,
  max: RATE_LIMITS.login.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Trop de tentatives. Réessayez plus tard.", code: "RATE_LIMITED" },
});

export const importLimiter = rateLimit({
  windowMs: RATE_LIMITS.import.windowMs,
  max: RATE_LIMITS.import.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Trop d'imports. Réessayez plus tard.", code: "RATE_LIMITED" },
});

export const retryLimiter = rateLimit({
  windowMs: RATE_LIMITS.retry.windowMs,
  max: RATE_LIMITS.retry.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Trop de relances SMS.", code: "RATE_LIMITED" },
});
