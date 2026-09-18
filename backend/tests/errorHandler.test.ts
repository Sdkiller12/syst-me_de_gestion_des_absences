/**
 * Tests unitaires — errorHandler middleware
 *
 * Couvre : AppError, ZodError, Prisma P2002/P2025/validation, payload too large,
 * erreur DB indisponible, erreur générique (dev vs prod).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ZodError, ZodIssueCode } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../src/utils/errors.js";

// ── Mock logger ────────────────────────────────────────────────────────────

vi.mock("../src/config/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { errorHandler } from "../src/middlewares/errorHandler.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json: json as unknown, _json: json, _status: status } as unknown as Response & {
    _json: ReturnType<typeof vi.fn>;
    _status: ReturnType<typeof vi.fn>;
  };
}

function makeReq(): Request {
  return {} as Request;
}

function makeNext(): NextFunction {
  return vi.fn();
}

function callHandler(err: unknown, nodeEnv = "test") {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  const res = makeRes();
  errorHandler(err, makeReq(), res as unknown as Response, makeNext());
  process.env.NODE_ENV = prev;
  return res;
}

function getResponse(res: ReturnType<typeof makeRes>) {
  return {
    status: res._status.mock.calls[0]?.[0] as number,
    body: res._json.mock.calls[0]?.[0] as {
      success: boolean;
      error: { code: string; message: string; details?: unknown };
    },
  };
}

// ── Tests : AppError ───────────────────────────────────────────────────────

describe("errorHandler — AppError", () => {
  it("mappe statusCode, code et message", () => {
    const res = callHandler(new AppError(404, "Classe introuvable", "NOT_FOUND"));
    const { status, body } = getResponse(res);

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Classe introuvable");
  });

  it("mappe un 403 FORBIDDEN", () => {
    const res = callHandler(new AppError(403, "Accès refusé", "FORBIDDEN"));
    const { status, body } = getResponse(res);

    expect(status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("mappe un 409 CONFLICT", () => {
    const res = callHandler(new AppError(409, "Email déjà utilisé", "CONFLICT"));
    const { status, body } = getResponse(res);

    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
  });
});

// ── Tests : ZodError ───────────────────────────────────────────────────────

describe("errorHandler — ZodError", () => {
  it("retourne 400 VALIDATION_ERROR avec les issues", () => {
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        path: ["email"],
        message: "Required",
      } as never,
    ]);

    const res = callHandler(zodErr);
    const { status, body } = getResponse(res);

    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "email", message: "Required" }),
      ]),
    );
  });

  it("joint les chemins imbriqués avec des points", () => {
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        path: ["address", "city"],
        message: "Champ requis",
      } as never,
    ]);

    const res = callHandler(zodErr);
    const { body } = getResponse(res);

    const details = body.error.details as Array<{ path: string }>;
    expect(details[0].path).toBe("address.city");
  });
});

// ── Tests : Prisma errors ──────────────────────────────────────────────────

describe("errorHandler — Prisma errors", () => {
  it("P2002 (unique constraint) → 409 CONFLICT", () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`email`)",
      { code: "P2002", clientVersion: "6.0.0", meta: { target: ["email"] } },
    );

    const res = callHandler(err);
    const { status, body } = getResponse(res);

    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("P2025 (record not found) → 404 NOT_FOUND", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "6.0.0",
    });

    const res = callHandler(err);
    const { status, body } = getResponse(res);

    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("autre code Prisma → 500 INTERNAL_ERROR", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unknown Prisma error", {
      code: "P9999",
      clientVersion: "6.0.0",
    });

    const res = callHandler(err);
    const { status, body } = getResponse(res);

    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("PrismaClientValidationError → 400 VALIDATION_ERROR", () => {
    const err = new Prisma.PrismaClientValidationError("Invalid argument", {
      clientVersion: "6.0.0",
    });

    const res = callHandler(err);
    const { status, body } = getResponse(res);

    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Tests : DB unavailable ─────────────────────────────────────────────────

describe("errorHandler — DB unavailable", () => {
  it("ECONNREFUSED → 503 DB_UNAVAILABLE", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      name: "Error",
    });

    const res = callHandler(err);
    const { status, body } = getResponse(res);

    expect(status).toBe(503);
    expect(body.error.code).toBe("DB_UNAVAILABLE");
  });

  it("PrismaClientInitializationError → 503", () => {
    const err = Object.assign(new Error("Can't reach database server"), {
      name: "PrismaClientInitializationError",
    });

    const res = callHandler(err);
    const { status, body } = getResponse(res);

    expect(status).toBe(503);
    expect(body.error.code).toBe("DB_UNAVAILABLE");
  });
});

// ── Tests : payload too large ──────────────────────────────────────────────

describe("errorHandler — payload too large", () => {
  it("retourne 413 PAYLOAD_TOO_LARGE si message contient 'limit'", () => {
    const err = { status: 413, message: "request entity too large: body limit exceeded" };

    const res = callHandler(err);
    const { status, body } = getResponse(res);

    expect(status).toBe(413);
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

// ── Tests : erreur générique ───────────────────────────────────────────────

describe("errorHandler — erreur générique", () => {
  it("retourne 500 en dev avec le message d'erreur", () => {
    const err = new Error("Unexpected crash");

    const res = callHandler(err, "development");
    const { status, body } = getResponse(res);

    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Unexpected crash");
  });

  it("retourne 500 en prod avec message générique (pas de leak)", () => {
    const err = new Error("DB password leaked");

    const res = callHandler(err, "production");
    const { status, body } = getResponse(res);

    expect(status).toBe(500);
    expect(body.error.message).toBe("Erreur serveur");
    expect(body.error.message).not.toContain("DB password");
  });

  it("success est toujours false dans les réponses d'erreur", () => {
    const cases = [
      new AppError(400, "Bad", "BAD"),
      new ZodError([]),
      new Error("generic"),
    ];

    for (const err of cases) {
      const res = callHandler(err);
      const { body } = getResponse(res);
      expect(body.success).toBe(false);
    }
  });
});
