/**
 * Tests unitaires — tokenBlacklist
 *
 * Couvre : hashToken (déterminisme, format), revokeToken (upsert),
 * isTokenRevoked (found/not-found), revokeAllRefreshTokensForUser (sentinel),
 * getLogoutCutoff (null/date), purgeExpiredTokens.
 * Stratégie : mock Prisma, pas de DB réelle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    revokedToken: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("../src/config/database.js", () => ({ prisma: mockPrisma }));

import {
  hashToken,
  revokeToken,
  isTokenRevoked,
  revokeAllRefreshTokensForUser,
  getLogoutCutoff,
  purgeExpiredTokens,
} from "../src/utils/tokenBlacklist.js";

// ── Tests : hashToken ──────────────────────────────────────────────────────

describe("hashToken()", () => {
  it("retourne un hash SHA-256 en hexadécimal (64 chars)", () => {
    const h = hashToken("some.jwt.token");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("est déterministe — même entrée produit même hash", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.test.sig";
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produit des hashes différents pour des tokens différents", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("correspond au SHA-256 natif Node.js", () => {
    const token = "my-test-token";
    const expected = createHash("sha256").update(token).digest("hex");
    expect(hashToken(token)).toBe(expected);
  });
});

// ── Tests : revokeToken ────────────────────────────────────────────────────

describe("revokeToken()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appelle prisma.revokedToken.upsert avec le hash et l'expiresAt", async () => {
    mockPrisma.revokedToken.upsert.mockResolvedValue({});
    const token = "raw.jwt.token";
    const userId = "user-1";
    const exp = Math.floor(Date.now() / 1000) + 900; // +15 min

    await revokeToken(token, userId, exp);

    expect(mockPrisma.revokedToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashToken(token) },
        create: expect.objectContaining({
          tokenHash: hashToken(token),
          userId,
          expiresAt: new Date(exp * 1000),
        }),
      }),
    );
  });

  it("est idempotent — peut être appelé plusieurs fois sans erreur", async () => {
    mockPrisma.revokedToken.upsert.mockResolvedValue({});
    const token = "idempotent-token";
    const exp = Math.floor(Date.now() / 1000) + 900;

    await revokeToken(token, "user-1", exp);
    await revokeToken(token, "user-1", exp);

    expect(mockPrisma.revokedToken.upsert).toHaveBeenCalledTimes(2);
  });

  it("convertit exp (secondes) en expiresAt (Date ms)", async () => {
    mockPrisma.revokedToken.upsert.mockResolvedValue({});
    const exp = 1_800_000_000; // some epoch seconds

    await revokeToken("t", "u", exp);

    const call = vi.mocked(mockPrisma.revokedToken.upsert).mock.calls[0][0];
    expect((call.create as { expiresAt: Date }).expiresAt.getTime()).toBe(exp * 1000);
  });
});

// ── Tests : isTokenRevoked ─────────────────────────────────────────────────

describe("isTokenRevoked()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne true si le token est dans la blacklist", async () => {
    mockPrisma.revokedToken.findUnique.mockResolvedValue({ id: "row-1", tokenHash: "abc" });

    const result = await isTokenRevoked("some-token");

    expect(result).toBe(true);
    expect(mockPrisma.revokedToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("some-token") },
    });
  });

  it("retourne false si le token n'est pas dans la blacklist", async () => {
    mockPrisma.revokedToken.findUnique.mockResolvedValue(null);

    const result = await isTokenRevoked("clean-token");

    expect(result).toBe(false);
  });

  it("utilise toujours le hash, jamais le token brut", async () => {
    mockPrisma.revokedToken.findUnique.mockResolvedValue(null);
    const rawToken = "super-secret-jwt";

    await isTokenRevoked(rawToken);

    const call = vi.mocked(mockPrisma.revokedToken.findUnique).mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain(rawToken);
    expect(JSON.stringify(call)).toContain(hashToken(rawToken));
  });
});

// ── Tests : revokeAllRefreshTokensForUser ──────────────────────────────────

describe("revokeAllRefreshTokensForUser()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insère un sentinel upsert pour l'utilisateur", async () => {
    mockPrisma.revokedToken.upsert.mockResolvedValue({});
    const userId = "user-42";

    await revokeAllRefreshTokensForUser(userId);

    expect(mockPrisma.revokedToken.upsert).toHaveBeenCalledOnce();
    const call = vi.mocked(mockPrisma.revokedToken.upsert).mock.calls[0][0];
    const created = call.create as { userId: string; expiresAt: Date; tokenHash: string };
    expect(created.userId).toBe(userId);
    // expiresAt doit être ~30 jours dans le futur
    const in30d = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(created.expiresAt.getTime()).toBeGreaterThan(in30d - 5000);
    expect(created.expiresAt.getTime()).toBeLessThan(in30d + 5000);
  });

  it("le sentinel hash est dérivé de 'logout:{userId}:{iso}'", async () => {
    mockPrisma.revokedToken.upsert.mockResolvedValue({});
    const userId = "user-99";
    const logoutAt = new Date("2026-09-15T12:00:00.000Z");

    await revokeAllRefreshTokensForUser(userId, logoutAt);

    const call = vi.mocked(mockPrisma.revokedToken.upsert).mock.calls[0][0];
    const expectedHash = hashToken(`logout:${userId}:${logoutAt.toISOString()}`);
    expect((call.where as { tokenHash: string }).tokenHash).toBe(expectedHash);
  });

  it("est idempotent si appelé plusieurs fois", async () => {
    mockPrisma.revokedToken.upsert.mockResolvedValue({});

    await revokeAllRefreshTokensForUser("user-1");
    await revokeAllRefreshTokensForUser("user-1");

    expect(mockPrisma.revokedToken.upsert).toHaveBeenCalledTimes(2);
  });
});

// ── Tests : getLogoutCutoff ────────────────────────────────────────────────

describe("getLogoutCutoff()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne null si aucun sentinel actif", async () => {
    mockPrisma.revokedToken.findFirst.mockResolvedValue(null);

    const result = await getLogoutCutoff("user-1");

    expect(result).toBeNull();
  });

  it("retourne la date createdAt du sentinel le plus récent", async () => {
    const createdAt = new Date("2026-09-15T10:00:00Z");
    mockPrisma.revokedToken.findFirst.mockResolvedValue({
      id: "sentinel-1",
      createdAt,
      userId: "user-1",
    });

    const result = await getLogoutCutoff("user-1");

    expect(result).toEqual(createdAt);
  });

  it("filtre par userId et expiresAt > now", async () => {
    mockPrisma.revokedToken.findFirst.mockResolvedValue(null);

    await getLogoutCutoff("user-77");

    expect(mockPrisma.revokedToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-77",
          expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
        }),
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});

// ── Tests : purgeExpiredTokens ─────────────────────────────────────────────

describe("purgeExpiredTokens()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("supprime les tokens expirés (expiresAt < now)", async () => {
    mockPrisma.revokedToken.deleteMany.mockResolvedValue({ count: 5 });

    await purgeExpiredTokens();

    expect(mockPrisma.revokedToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it("ne lève pas d'erreur même si aucun token à purger", async () => {
    mockPrisma.revokedToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(purgeExpiredTokens()).resolves.toBeUndefined();
  });
});
