/**
 * Tests unitaires — authService
 *
 * Stratégie : mock Prisma + bcrypt + tokenBlacklist pour tester la logique
 * métier sans base de données réelle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (doivent être déclarés avant les imports du code testé) ──────────

vi.mock("../src/config/database.js", () => ({
  prisma: {
    school: { create: vi.fn(), upsert: vi.fn() },
    user: { create: vi.fn(), upsert: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        school: { create: vi.fn() },
        user: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      }),
    ),
  },
}));

vi.mock("../src/repositories/user.repository.js", () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../src/utils/tokenBlacklist.js", () => ({
  revokeToken: vi.fn(),
  revokeAllRefreshTokensForUser: vi.fn(),
  getLogoutCutoff: vi.fn().mockResolvedValue(null),
  purgeExpiredTokens: vi.fn().mockResolvedValue(undefined),
}));

// Must set env before importing authService (getEnv() caches on first call)
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-32c!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-32c!";
process.env.JWT_EXPIRES_IN = "15m";

import { authService } from "../src/services/auth.service.js";
import { userRepository } from "../src/repositories/user.repository.js";
import { revokeToken, revokeAllRefreshTokensForUser, getLogoutCutoff } from "../src/utils/tokenBlacklist.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<ReturnType<typeof baseUser>> = {}) {
  return { ...baseUser(), ...overrides };
}

function baseUser() {
  return {
    id: "user-1",
    schoolId: "school-1",
    firstName: "Test",
    lastName: "USER",
    name: "Test USER",
    email: "test@example.com",
    phone: null,
    passwordHash: bcrypt.hashSync("password123", 10),
    role: "SCHOOL_ADMIN" as const,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

// ── Tests : login ──────────────────────────────────────────────────────────

describe("authService.login()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne un access token et un refresh token valides pour des identifiants corrects", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(makeUser());

    const result = await authService.login("test@example.com", "password123");

    expect(result.token).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe("test@example.com");
    expect(result.user).not.toHaveProperty("passwordHash");

    // Verify the token is a valid JWT
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET!) as { userId: string; role: string };
    expect(decoded.userId).toBe("user-1");
    expect(decoded.role).toBe("SCHOOL_ADMIN");
  });

  it("normalise l'email en minuscules avant la recherche", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(makeUser());
    await authService.login("TEST@EXAMPLE.COM", "password123");
    expect(userRepository.findByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("lève une erreur 401 si l'email est inconnu", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    await expect(authService.login("unknown@example.com", "password123")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("lève une erreur 401 si le mot de passe est incorrect", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(makeUser());
    await expect(authService.login("test@example.com", "wrongpassword")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("lève une erreur 403 si le compte est désactivé", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(makeUser({ isActive: false }));
    await expect(authService.login("test@example.com", "password123")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});

// ── Tests : refresh ────────────────────────────────────────────────────────

describe("authService.refresh()", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeRefreshToken(userId = "user-1", iatOffset = 0) {
    const secret = process.env.JWT_REFRESH_SECRET!;
    return jwt.sign(
      { userId, type: "refresh", iat: Math.floor(Date.now() / 1000) + iatOffset },
      secret,
      { expiresIn: "30d" },
    );
  }

  it("émet un nouvel access token + nouveau refresh token (rotation)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(makeUser());
    vi.mocked(getLogoutCutoff).mockResolvedValue(null);

    const refreshToken = makeRefreshToken();
    const result = await authService.refresh(refreshToken);

    expect(result.token).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    // The old token must have been revoked
    expect(revokeToken).toHaveBeenCalledOnce();
  });

  it("lève une erreur 401 pour un token mal signé", async () => {
    await expect(authService.refresh("invalid.token.here")).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("lève une erreur 401 si le type n'est pas 'refresh'", async () => {
    const badToken = jwt.sign(
      { userId: "user-1", type: "access" },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "30d" },
    );
    await expect(authService.refresh(badToken)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("lève une erreur 401 si le token est émis avant le cutoff logout", async () => {
    // Token iat is 10 minutes ago, cutoff is 5 minutes ago → token is stale
    const refreshToken = makeRefreshToken("user-1", -600); // iat 10 min ago
    const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    vi.mocked(getLogoutCutoff).mockResolvedValue(cutoff);
    vi.mocked(userRepository.findById).mockResolvedValue(makeUser());

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("lève une erreur 401 si l'utilisateur n'existe plus", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    vi.mocked(getLogoutCutoff).mockResolvedValue(null);
    const refreshToken = makeRefreshToken();
    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

// ── Tests : logout ─────────────────────────────────────────────────────────

describe("authService.logout()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("révoque l'access token ET tous les refresh tokens de l'utilisateur", async () => {
    const accessToken = jwt.sign(
      { userId: "user-1", schoolId: "school-1", role: "SCHOOL_ADMIN" },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" },
    );
    await authService.logout(accessToken, "user-1");

    expect(revokeToken).toHaveBeenCalledOnce();
    expect(revokeAllRefreshTokensForUser).toHaveBeenCalledWith("user-1");
  });

  it("ne lève pas d'erreur si le token est malformé (logout silencieux)", async () => {
    await expect(authService.logout("garbage", "user-1")).resolves.toBeUndefined();
  });
});

// ── Tests : safeUser (champs retournés) ───────────────────────────────────

describe("authService.login() — champs renvoyés", () => {
  it("ne renvoie jamais passwordHash dans la réponse", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(makeUser());
    const result = await authService.login("test@example.com", "password123");
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  it("inclut firstName, lastName, role, schoolId", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(makeUser());
    const result = await authService.login("test@example.com", "password123");
    expect(result.user.firstName).toBe("Test");
    expect(result.user.lastName).toBe("USER");
    expect(result.user.role).toBe("SCHOOL_ADMIN");
    expect(result.user.schoolId).toBe("school-1");
  });
});
