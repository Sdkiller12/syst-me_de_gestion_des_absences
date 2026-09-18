/**
 * Vitest global setup — runs before each test file.
 * Resets the env cache so each test file can control its own env vars.
 */
import { beforeEach } from "vitest";

// Set minimum required env vars for all tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost/test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-that-is-long-enough-32c!!";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret-that-is-long-32c!";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "15m";
process.env.SMS_PROVIDER = "mock";
process.env.REDIS_URL = "";

beforeEach(async () => {
  // Reset env cache so env overrides within a test take effect
  const { resetEnvCache } = await import("../src/config/env.js");
  resetEnvCache();
});
