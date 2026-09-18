import { createHash } from "crypto";
import { prisma } from "../config/database.js";

/**
 * SHA-256 hash of a raw token string.
 * We never store the token itself, only its hash.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Add a token to the revocation list.
 * @param token   Raw JWT string
 * @param userId  Owner of the token
 * @param exp     Expiry timestamp in seconds (from JWT payload)
 */
export async function revokeToken(token: string, userId: string, exp: number): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(exp * 1000);
  // Upsert: safe to call multiple times for the same token
  await prisma.revokedToken.upsert({
    where: { tokenHash },
    update: {},
    create: { tokenHash, userId, expiresAt },
  });
}

/**
 * Returns true if the token has been revoked.
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const found = await prisma.revokedToken.findUnique({ where: { tokenHash } });
  return !!found;
}

/**
 * Revoke all active (non-expired) refresh tokens for a user.
 * Used on logout to invalidate every session at once.
 *
 * Strategy: we store individual refresh token hashes in RevokedToken.
 * At logout we also insert a wildcard sentinel row that the refresh
 * endpoint checks via `isRefreshFamilyRevoked`.
 *
 * Sentinel format: sha256("logout:{userId}:{iso}")  — stored with
 * expiresAt = now + 30d so it outlives any in-flight refresh token.
 */
export async function revokeAllRefreshTokensForUser(
  userId: string,
  logoutAt: Date = new Date(),
): Promise<void> {
  const sentinelHash = hashToken(`logout:${userId}:${logoutAt.toISOString()}`);
  const expiresAt = new Date(logoutAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.revokedToken.upsert({
    where: { tokenHash: sentinelHash },
    update: {},
    create: { tokenHash: sentinelHash, userId, expiresAt },
  });
}

/**
 * Returns the most recent logout timestamp for a user, if any valid sentinel exists.
 * A refresh token whose `iat` is before this cutoff is considered invalid.
 */
export async function getLogoutCutoff(userId: string): Promise<Date | null> {
  // Sentinels are distinguished by userId — find the most recent non-expired one.
  // We pick the latest createdAt among all rows for this user.
  const row = await prisma.revokedToken.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return row ? row.createdAt : null;
}

/**
 * Purge expired revoked tokens (run periodically to keep the table small).
 * Safe to call opportunistically after each login.
 */
export async function purgeExpiredTokens(): Promise<void> {
  await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
