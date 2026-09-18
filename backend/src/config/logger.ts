import pino from "pino";

function resolveLevel(): string {
  const v = process.env.LOG_LEVEL;
  if (v) return v;
  try {
    // Lazy to avoid crash when env missing during tests
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnv } = require("./env.js") as typeof import("./env.js");
    return getEnv().LOG_LEVEL;
  } catch {
    return "info";
  }
}

export const logger = pino({ level: resolveLevel() });
