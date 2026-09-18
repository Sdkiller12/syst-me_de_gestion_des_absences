export const BUSINESS_TIMEZONE = "Africa/Abidjan";

export const PAGINATION_DEFAULTS = { page: 1, limit: 20, maxLimit: 100 } as const;

export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 20 },
  import: { windowMs: 60 * 1000, max: 10 },
  retry: { windowMs: 60 * 1000, max: 30 },
  global: { windowMs: 60 * 1000, max: 200 },
} as const;
