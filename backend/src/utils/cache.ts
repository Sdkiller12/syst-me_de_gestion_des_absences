/**
 * Lightweight Redis cache helper.
 *
 * Uses the native `redis` client when REDIS_URL is configured.
 * Falls back to a no-op (always misses) when Redis is absent,
 * so the app works identically with or without Redis.
 *
 * Usage:
 *   const data = await withCache("key", 60, () => expensiveQuery());
 */

import { logger } from "../config/logger.js";

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

let _client: RedisLike | null = null;
let _connecting = false;

async function getClient(): Promise<RedisLike | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (_client) return _client;
  if (_connecting) return null;
  _connecting = true;
  try {
    // Dynamic import so the app starts without redis installed
    const { createClient } = await import("redis" as string) as { createClient: (opts: { url: string }) => RedisLike & { connect(): Promise<void> } };
    const client = createClient({ url: redisUrl });
    await client.connect();
    _client = client;
    logger.info("Redis cache connected");
    return _client;
  } catch (e) {
    logger.warn({ err: e }, "Redis unavailable — cache disabled");
    return null;
  } finally {
    _connecting = false;
  }
}

/**
 * Get a cached value or compute + store it.
 * @param key     Cache key (should be unique per logical query + params)
 * @param ttlSec  Time-to-live in seconds
 * @param fn      Async function that produces the value on a cache miss
 */
export async function withCache<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const client = await getClient();
    if (client) {
      const cached = await client.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
      const value = await fn();
      await client.set(key, JSON.stringify(value), { EX: ttlSec });
      return value;
    }
  } catch (e) {
    logger.warn({ err: e, key }, "Cache error — falling back to direct query");
  }
  // No Redis or error: execute directly
  return fn();
}

/**
 * Invalidate a specific cache key (e.g. after a mutation).
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const client = await getClient();
    if (client) await client.del(key);
  } catch {
    // Cache invalidation errors are non-fatal
  }
}

/**
 * Build a namespaced cache key for dashboard stats.
 */
export function dashboardStatsKey(schoolId: string, role: string, userId?: string): string {
  // Teachers see filtered data — scope key by userId too
  if (role === "TEACHER" && userId) return `dashboard:stats:${schoolId}:teacher:${userId}`;
  return `dashboard:stats:${schoolId}`;
}
