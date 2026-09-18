/**
 * Tests unitaires — middleware authenticate
 *
 * Vérifie : extraction du token, vérification signature, blacklist,
 * utilisateur actif, propagation d'erreurs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthRequest } from "../src/types/index.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test USER",
  role: "SCHOOL_ADMIN" as const,
  schoolId: "school-1",
  isActive: true,
};

vi.mock("../src/config/database.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../src/utils/tokenBlacklist.js", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-32c!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-32c!";
process.env.JWT_EXPIRES_IN = "15m";

import { authenticate } from "../src/middlewares/authenticate.js";
import { prisma } from "../src/config/database.js";
import { isTokenRevoked } from "../src/utils/tokenBlacklist.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeToken(payload: object = { userId: "user-1", schoolId: "school-1", role: "SCHOOL_ADMIN" }) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "15m" });
}

function makeReq(authHeader?: string): AuthRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as AuthRequest;
}

function makeRes(): Response {
  return {} as Response;
}

function makeNext(): NextFunction & { mock: { calls: unknown[][] } } {
  return vi.fn() as unknown as NextFunction & { mock: { calls: unknown[][] } };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("authenticate middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(isTokenRevoked).mockResolvedValue(false);
  });

  it("appelle next() et attache req.user pour un token valide", async () => {
    const token = makeToken();
    const req = makeReq(`Bearer ${token}`);
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(req.user).toMatchObject({
      id: "user-1",
      email: "test@example.com",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
    });
  });

  it("passe une erreur 401 si le header Authorization est absent", async () => {
    const req = makeReq(); // no auth header
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(req.user).toBeUndefined();
  });

  it("passe une erreur 401 si le header n'est pas Bearer", async () => {
    const req = makeReq("Basic dXNlcjpwYXNz");
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("passe une erreur 401 si la signature du token est invalide", async () => {
    const badToken = jwt.sign({ userId: "user-1" }, "wrong-secret");
    const req = makeReq(`Bearer ${badToken}`);
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("passe une erreur 401 si le token a expiré", async () => {
    const expiredToken = jwt.sign(
      { userId: "user-1", schoolId: "school-1", role: "SCHOOL_ADMIN" },
      process.env.JWT_SECRET!,
      { expiresIn: -1 }, // already expired
    );
    const req = makeReq(`Bearer ${expiredToken}`);
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("passe une erreur 401 si le token est dans la blacklist", async () => {
    vi.mocked(isTokenRevoked).mockResolvedValue(true);
    const token = makeToken();
    const req = makeReq(`Bearer ${token}`);
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(req.user).toBeUndefined();
  });

  it("passe une erreur 401 si l'utilisateur est introuvable en base", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const token = makeToken();
    const req = makeReq(`Bearer ${token}`);
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("passe une erreur 403 si le compte est désactivé", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, isActive: false } as never);
    const token = makeToken();
    const req = makeReq(`Bearer ${token}`);
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("vérifie bien la blacklist à chaque requête", async () => {
    const token = makeToken();
    const req = makeReq(`Bearer ${token}`);
    const next = makeNext();

    await authenticate(req, makeRes(), next);

    expect(isTokenRevoked).toHaveBeenCalledWith(token);
  });
});

// ── Tests : authorize middleware ───────────────────────────────────────────

import { authorize, requireSchool } from "../src/middlewares/authorize.js";

describe("authorize middleware", () => {
  it("SUPER_ADMIN passe toujours quel que soit le rôle requis", () => {
    const req = { user: { role: "SUPER_ADMIN", schoolId: null } } as AuthRequest;
    const next = vi.fn() as NextFunction;

    authorize("SCHOOL_ADMIN")(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it("SCHOOL_ADMIN passe si le rôle est dans la liste", () => {
    const req = { user: { role: "SCHOOL_ADMIN", schoolId: "s1" } } as AuthRequest;
    const next = vi.fn() as NextFunction;

    authorize("SCHOOL_ADMIN", "TEACHER")(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it("TEACHER est rejeté s'il demande un accès SCHOOL_ADMIN uniquement", () => {
    const req = { user: { role: "TEACHER", schoolId: "s1" } } as AuthRequest;
    const next = vi.fn() as NextFunction;

    authorize("SCHOOL_ADMIN")(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("requireSchool bloque un user sans schoolId (non-SUPER_ADMIN)", () => {
    const req = { user: { role: "TEACHER", schoolId: null } } as AuthRequest;
    const next = vi.fn() as NextFunction;

    requireSchool(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("requireSchool laisse passer un SUPER_ADMIN sans schoolId", () => {
    const req = { user: { role: "SUPER_ADMIN", schoolId: null } } as AuthRequest;
    const next = vi.fn() as NextFunction;

    requireSchool(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
