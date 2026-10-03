import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import { disconnectPrisma } from "./config/database.js";
import { smsQueue } from "./services/smsQueue.js";

// Relance périodique : SMS restés en attente (redémarrage, nouvelles tentatives programmées)
const SMS_DRAIN_INTERVAL_MS = 2 * 60 * 1000;

async function main() {
  const env = getEnv(); // throws with explicit message if critical var missing
  if (env.SMS_PROVIDER === "mock" && env.NODE_ENV === "production") {
    logger.warn("SMS_PROVIDER=mock en production: les SMS ne seront pas réellement envoyés");
  }
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on :${env.PORT} (env=${env.NODE_ENV}, tz=${process.env.TZ ?? "default"})`);
  });

  void smsQueue.flush().catch((e) => logger.error(e, "SMS drain au démarrage échoué"));
  const smsTimer = setInterval(() => void smsQueue.flush().catch((e) => logger.error(e, "SMS drain échoué")), SMS_DRAIN_INTERVAL_MS);
  smsTimer.unref();

  const shutdown = (signal: string) => {
    clearInterval(smsTimer);
    logger.info(`${signal} received, shutting down...`);
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((e) => {
  logger.error(e, "Failed to start server");
  process.exit(1);
});
