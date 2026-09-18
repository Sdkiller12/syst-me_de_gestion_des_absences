import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { getEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/database.js";
import { swaggerSpec } from "./config/swagger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";
import authRoutes from "./routes/auth.routes.js";
import schoolRoutes from "./routes/school.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import classRoutes from "./routes/class.routes.js";
import studentRoutes from "./routes/student.routes.js";
import courseRoutes from "./routes/course.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import adminRoutes from "./routes/admin.routes.js";

export function createApp() {
  const env = getEnv();
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL.split(",").map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger }));
  app.use(globalLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/health/database", async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "up", timestamp: new Date().toISOString() });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/health", async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redis = process.env.REDIS_URL ? "configured" : "not-configured";
      res.json({ status: "ok", database: "up", redis, timestamp: new Date().toISOString() });
    } catch (e) {
      next(e);
    }
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/api/auth", authRoutes);
  app.use("/api/schools", schoolRoutes);
  app.use("/api/teachers", teacherRoutes);
  app.use("/api/classes", classRoutes);
  app.use("/api/students", studentRoutes);
  app.use("/api/courses", courseRoutes);
  app.use("/api/attendance", attendanceRoutes);
  // Alias history per spec
  app.use("/api/history/attendance", attendanceRoutes);
  app.use("/api/notifications", notificationRoutes);
  // SMS logs alias (same store)
  app.use("/api/sms", notificationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api", adminRoutes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route introuvable" } });
  });

  app.use(errorHandler);

  return app;
}
