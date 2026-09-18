/**
 * Tests e2e HTTP — auth + attendance endpoints
 *
 * Stratégie : createApp() + supertest (sans serveur TCP).
 * La couche DB et les services métier sont mockés — on teste
 * le contrat HTTP : routing, validation Zod, middlewares, codes de statut,
 * shape des réponses JSON.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import { AppError } from "../src/utils/errors.js";

// ── Constants partagés ─────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-that-is-long-enough-32c!!";
const SCHOOL_ID = "school-e2e-1";
const USER_ID = "user-e2e-1";

// ── Mocks hoistés ──────────────────────────────────────────────────────────
// vi.hoisted() s'exécute avant le hoisting de vi.mock(), ce qui permet
// de référencer des variables dans les factories de vi.mock().

const {
  mockPrismaUser,
  mockFindUnique,
  mockQueryRaw,
  mockAuditCreate,
  mockIsTokenRevoked,
  mockAuthService,
  mockAttendanceService,
} = vi.hoisted(() => {
  const mockPrismaUser = {
    id: "user-e2e-1",
    email: "admin@ecole.ci",
    name: "Admin ECOLE",
    role: "SCHOOL_ADMIN" as const,
    schoolId: "school-e2e-1",
    isActive: true,
  };
  return {
    mockPrismaUser,
    mockFindUnique: vi.fn().mockResolvedValue(mockPrismaUser),
    mockQueryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    mockAuditCreate: vi.fn().mockResolvedValue({}),
    mockIsTokenRevoked: vi.fn().mockResolvedValue(false),
    mockAuthService: {
      registerSchool: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      me: vi.fn(),
    },
    mockAttendanceService: {
      list: vi.fn(),
      byCourse: vi.fn(),
      save: vi.fn(),
      updateOne: vi.fn(),
    },
  };
});

// Désactive le rate limiter pour éviter les 429 dans les tests
vi.mock("../src/middlewares/rateLimiter.js", () => {
  const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    globalLimiter: passThrough,
    loginLimiter: passThrough,
    importLimiter: passThrough,
    retryLimiter: passThrough,
  };
});

// Mock Prisma (utilisé directement par authenticate middleware)
vi.mock("../src/config/database.js", () => ({
  prisma: {
    user: { findUnique: mockFindUnique },
    auditLog: { create: mockAuditCreate },
    $queryRaw: mockQueryRaw,
  },
}));

// Token blacklist — tout token est valide par défaut
vi.mock("../src/utils/tokenBlacklist.js", () => ({
  isTokenRevoked: mockIsTokenRevoked,
  revokeToken: vi.fn().mockResolvedValue(undefined),
  revokeAllRefreshTokensForUser: vi.fn().mockResolvedValue(undefined),
  getLogoutCutoff: vi.fn().mockResolvedValue(null),
  purgeExpiredTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/services/auth.service.js", () => ({ authService: mockAuthService }));

vi.mock("../src/services/attendance.service.js", () => ({
  attendanceService: mockAttendanceService,
}));

vi.mock("../src/services/smsQueue.js", () => ({
  smsQueue: { enqueueDrain: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../src/utils/audit.js", () => ({ audit: vi.fn().mockResolvedValue(undefined) }));

// ── App et setup ───────────────────────────────────────────────────────────

import { createApp } from "../src/app.js";

let app: Express;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockIsTokenRevoked.mockResolvedValue(false);
  mockFindUnique.mockResolvedValue(mockPrismaUser);
  mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
  mockAuthService.logout.mockResolvedValue(undefined);
  // Defaults pour éviter les 500 quand un test oublie de mocker
  mockAttendanceService.list.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  mockAttendanceService.byCourse.mockResolvedValue([]);
  mockAttendanceService.save.mockResolvedValue([]);
  mockAttendanceService.updateOne.mockResolvedValue(null);
});

/** Génère un Bearer token valide pour les tests authentifiés */
function makeAuthToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    { userId: USER_ID, schoolId: SCHOOL_ID, role: "SCHOOL_ADMIN", ...overrides },
    JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function authHeader(token?: string) {
  return { Authorization: `Bearer ${token ?? makeAuthToken()}` };
}

// ── Suite : Health ─────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("retourne 200 status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeTruthy();
  });
});

describe("GET /api/health", () => {
  it("retourne 200 avec database up", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("up");
  });
});

describe("Route inconnue", () => {
  it("retourne 404 NOT_FOUND pour une route inexistante", async () => {
    const res = await request(app).get("/route-vraiment-inexistante-xyz");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ── Suite : POST /api/auth/register-school ─────────────────────────────────

describe("POST /api/auth/register-school", () => {
  const validPayload = {
    schoolName: "Lycée Moderne de Bouaké",
    adminFirstName: "Soro",
    adminLastName: "DIALLO",
    adminEmail: "soro@lycee.ci",
    adminPassword: "SecurePass123",
  };

  it("retourne 201 avec school, user, token pour un payload valide", async () => {
    mockAuthService.registerSchool.mockResolvedValue({
      school: { id: "school-1", name: "Lycée Moderne de Bouaké" },
      user: { id: "user-1", email: "soro@lycee.ci", role: "SCHOOL_ADMIN", schoolId: "school-1" },
      token: "access-jwt",
      refreshToken: "refresh-jwt",
    });

    const res = await request(app).post("/api/auth/register-school").send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.school.name).toBe("Lycée Moderne de Bouaké");
    expect(res.body.data.token).toBe("access-jwt");
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("retourne 400 si adminEmail est invalide", async () => {
    const res = await request(app)
      .post("/api/auth/register-school")
      .send({ ...validPayload, adminEmail: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retourne 400 si adminPassword < 8 caractères", async () => {
    const res = await request(app)
      .post("/api/auth/register-school")
      .send({ ...validPayload, adminPassword: "short" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("retourne 400 si schoolName est absent", async () => {
    const { schoolName: _, ...withoutName } = validPayload;
    const res = await request(app).post("/api/auth/register-school").send(withoutName);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retourne 409 si l'email est déjà pris", async () => {
    mockAuthService.registerSchool.mockRejectedValue(
      new AppError(409, "Un compte existe déjà avec cet email", "CONFLICT"),
    );

    const res = await request(app).post("/api/auth/register-school").send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("retourne 400 si le body est vide", async () => {
    const res = await request(app).post("/api/auth/register-school").send({});
    expect(res.status).toBe(400);
  });
});

// ── Suite : POST /api/auth/login ───────────────────────────────────────────

describe("POST /api/auth/login", () => {
  const validCreds = { email: "admin@ecole.ci", password: "password123" };

  it("retourne 200 avec token et refreshToken", async () => {
    mockAuthService.login.mockResolvedValue({
      user: { id: USER_ID, email: "admin@ecole.ci", role: "SCHOOL_ADMIN", schoolId: SCHOOL_ID },
      token: "access-token-xyz",
      refreshToken: "refresh-token-xyz",
    });

    const res = await request(app).post("/api/auth/login").send(validCreds);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe("access-token-xyz");
    expect(res.body.data.refreshToken).toBe("refresh-token-xyz");
  });

  it("retourne 401 si les identifiants sont incorrects", async () => {
    mockAuthService.login.mockRejectedValue(
      new AppError(401, "Email ou mot de passe incorrect", "UNAUTHORIZED"),
    );

    const res = await request(app).post("/api/auth/login").send(validCreds);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("retourne 400 si l'email est manquant", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "pass123" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retourne 400 si le password fait moins de 6 chars", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "x@y.ci", password: "abc" });
    expect(res.status).toBe(400);
  });

  it("retourne 403 si le compte est désactivé", async () => {
    mockAuthService.login.mockRejectedValue(new AppError(403, "Compte désactivé", "FORBIDDEN"));

    const res = await request(app).post("/api/auth/login").send(validCreds);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

// ── Suite : POST /api/auth/refresh ─────────────────────────────────────────

describe("POST /api/auth/refresh", () => {
  it("retourne 200 avec de nouveaux tokens", async () => {
    mockAuthService.refresh.mockResolvedValue({
      token: "new-access",
      refreshToken: "new-refresh",
      user: { id: USER_ID, role: "SCHOOL_ADMIN" },
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "old-refresh-token" });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe("new-access");
    expect(res.body.data.refreshToken).toBe("new-refresh");
  });

  it("retourne 400 si refreshToken est absent", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(400);
  });

  it("retourne 401 si le token est invalide", async () => {
    mockAuthService.refresh.mockRejectedValue(
      new AppError(401, "Refresh token invalide", "UNAUTHORIZED"),
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "bad-token" });

    expect(res.status).toBe(401);
  });
});

// ── Suite : POST /api/auth/logout ──────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("retourne 200 avec message de déconnexion", async () => {
    const res = await request(app).post("/api/auth/logout").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain("éconnexion");
  });

  it("retourne 401 si non authentifié", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });

  it("retourne 401 si le token est révoqué", async () => {
    mockIsTokenRevoked.mockResolvedValue(true);

    const res = await request(app).post("/api/auth/logout").set(authHeader());

    expect(res.status).toBe(401);
  });
});

// ── Suite : GET /api/auth/me ───────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("retourne le profil de l'utilisateur authentifié", async () => {
    mockAuthService.me.mockResolvedValue({
      id: USER_ID,
      email: "admin@ecole.ci",
      firstName: "Admin",
      lastName: "ECOLE",
      role: "SCHOOL_ADMIN",
      schoolId: SCHOOL_ID,
    });

    const res = await request(app).get("/api/auth/me").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe("admin@ecole.ci");
  });

  it("retourne 401 sans token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("retourne 401 avec un token mal signé", async () => {
    const badToken = jwt.sign({ userId: USER_ID }, "wrong-secret", { expiresIn: "15m" });
    const res = await request(app)
      .get("/api/auth/me")
      .set({ Authorization: `Bearer ${badToken}` });

    expect(res.status).toBe(401);
  });

  it("retourne 401 avec un token expiré", async () => {
    const expiredToken = jwt.sign(
      { userId: USER_ID, schoolId: SCHOOL_ID, role: "SCHOOL_ADMIN" },
      JWT_SECRET,
      { expiresIn: -1 },
    );
    const res = await request(app)
      .get("/api/auth/me")
      .set({ Authorization: `Bearer ${expiredToken}` });

    expect(res.status).toBe(401);
  });
});

// ── Suite : GET /api/attendance ────────────────────────────────────────────

describe("GET /api/attendance", () => {
  it("retourne 200 avec la liste paginée", async () => {
    mockAttendanceService.list.mockResolvedValue({
      data: [{ id: "att-1", studentId: "s-1", status: "PRESENT", courseId: "course-1" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get("/api/attendance").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it("retourne 401 sans authentification", async () => {
    const res = await request(app).get("/api/attendance");
    expect(res.status).toBe(401);
  });

  it("accepte les query params valides sans erreur", async () => {
    mockAttendanceService.list.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get("/api/attendance?page=2&limit=10&status=ABSENT&classId=class-1")
      .set(authHeader());

    expect(res.status).toBe(200);
  });

  it("retourne 400 pour un status invalide", async () => {
    const res = await request(app).get("/api/attendance?status=INVALIDE").set(authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retourne 403 si l'utilisateur n'a pas de schoolId (TEACHER sans école)", async () => {
    mockFindUnique.mockResolvedValue({ ...mockPrismaUser, schoolId: null, role: "TEACHER" });

    const token = makeAuthToken({ schoolId: null, role: "TEACHER" });
    const res = await request(app)
      .get("/api/attendance")
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(403);
  });
});

// ── Suite : GET /api/attendance/course/:courseId ───────────────────────────

describe("GET /api/attendance/course/:courseId", () => {
  it("retourne 200 avec les présences du cours", async () => {
    mockAttendanceService.byCourse.mockResolvedValue([
      { id: "att-1", studentId: "s-1", status: "PRESENT" },
      { id: "att-2", studentId: "s-2", status: "ABSENT" },
    ]);

    const res = await request(app)
      .get("/api/attendance/course/course-xyz")
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("retourne 401 sans token", async () => {
    const res = await request(app).get("/api/attendance/course/course-1");
    expect(res.status).toBe(401);
  });
});

// ── Suite : POST /api/attendance ───────────────────────────────────────────

describe("POST /api/attendance", () => {
  const validPayload = {
    courseId: "course-1",
    records: [
      { studentId: "s-1", status: "PRESENT" },
      { studentId: "s-2", status: "ABSENT" },
    ],
  };

  it("retourne 201 avec les données sauvegardées", async () => {
    mockAttendanceService.save.mockResolvedValue([
      { id: "att-1", studentId: "s-1", status: "PRESENT" },
      { id: "att-2", studentId: "s-2", status: "ABSENT" },
    ]);

    const res = await request(app).post("/api/attendance").set(authHeader()).send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it("retourne 400 si records est un tableau vide", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .set(authHeader())
      .send({ courseId: "course-1", records: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retourne 400 si courseId est absent", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .set(authHeader())
      .send({ records: [{ studentId: "s-1", status: "PRESENT" }] });

    expect(res.status).toBe(400);
  });

  it("retourne 400 si un status est invalide", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .set(authHeader())
      .send({ courseId: "course-1", records: [{ studentId: "s-1", status: "MALADE" }] });

    expect(res.status).toBe(400);
  });

  it("retourne 401 sans authentification", async () => {
    const res = await request(app).post("/api/attendance").send(validPayload);
    expect(res.status).toBe(401);
  });

  it("SCHOOL_ADMIN peut sauvegarder les présences (→ 201)", async () => {
    mockAttendanceService.save.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/attendance")
      .set(authHeader(makeAuthToken({ role: "SCHOOL_ADMIN" })))
      .send(validPayload);

    expect(res.status).toBe(201);
  });

  it("retourne 404 si le service lève NOT_FOUND", async () => {
    mockAttendanceService.save.mockRejectedValue(
      new AppError(404, "Cours introuvable", "NOT_FOUND"),
    );

    const res = await request(app).post("/api/attendance").set(authHeader()).send(validPayload);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ── Suite : PATCH /api/attendance/:id ─────────────────────────────────────

describe("PATCH /api/attendance/:id", () => {
  it("retourne 200 avec les données mises à jour", async () => {
    mockAttendanceService.updateOne.mockResolvedValue({
      id: "att-1",
      status: "JUSTIFIED",
      justification: "Certificat médical",
    });

    const res = await request(app)
      .patch("/api/attendance/att-1")
      .set(authHeader())
      .send({ status: "JUSTIFIED", justification: "Certificat médical" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("JUSTIFIED");
  });

  it("retourne 400 si le status est invalide", async () => {
    const res = await request(app)
      .patch("/api/attendance/att-1")
      .set(authHeader())
      .send({ status: "INEXISTANT" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retourne 400 si le body est vide", async () => {
    const res = await request(app).patch("/api/attendance/att-1").set(authHeader()).send({});
    expect(res.status).toBe(400);
  });

  it("retourne 404 si la présence n'existe pas", async () => {
    mockAttendanceService.updateOne.mockRejectedValue(
      new AppError(404, "Présence introuvable", "NOT_FOUND"),
    );

    const res = await request(app)
      .patch("/api/attendance/ghost-id")
      .set(authHeader())
      .send({ status: "PRESENT" });

    expect(res.status).toBe(404);
  });

  it("retourne 401 sans token", async () => {
    const res = await request(app).patch("/api/attendance/att-1").send({ status: "PRESENT" });
    expect(res.status).toBe(401);
  });

  it("fonctionne aussi avec PUT (alias)", async () => {
    mockAttendanceService.updateOne.mockResolvedValue({ id: "att-1", status: "LATE" });

    const res = await request(app)
      .put("/api/attendance/att-1")
      .set(authHeader())
      .send({ status: "LATE" });

    expect(res.status).toBe(200);
  });
});
