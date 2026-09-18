import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL manquant"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  SMS_PROVIDER: z.enum(["mock", "production"]).default("mock"),
  SMS_API_URL: z.string().url().or(z.literal("")).default(""),
  SMS_API_KEY: z.string().default(""),
  SMS_SENDER: z.string().default("ECOLE"),
  SMS_SENDER_ID: z.string().default(""),
  REDIS_URL: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuration invalide: ${msg}`);
  }
  if (parsed.data.SMS_PROVIDER === "production" && (!parsed.data.SMS_API_URL || !parsed.data.SMS_API_KEY)) {
    throw new Error("SMS_PROVIDER=production nécessite SMS_API_URL et SMS_API_KEY");
  }
  cached = parsed.data;
  return cached;
}

/** For tests: reset cache */
export function resetEnvCache() {
  cached = null;
}
