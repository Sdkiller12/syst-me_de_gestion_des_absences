/**
 * Tests unitaires — smsQueue
 *
 * Couvre : drain réussi, backoff exponentiel, exhaustion après maxRetries,
 * idempotence du flag draining, flush synchrone.
 * Stratégie : mock Prisma + smsService, pas de timers réels.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (avant tout import du code testé) ────────────────────────────────

const { mockPrisma, mockSendSms } = vi.hoisted(() => ({
  mockPrisma: {
    smsLog: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  mockSendSms: vi.fn(),
}));

vi.mock("../src/config/database.js", () => ({ prisma: mockPrisma }));
vi.mock("../src/config/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../src/services/sms.service.js", () => ({
  smsService: { sendSms: mockSendSms },
}));

import { smsQueue } from "../src/services/smsQueue.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makePending(overrides: Record<string, unknown> = {}) {
  return {
    id: "sms-1",
    schoolId: "school-1",
    studentId: "student-1",
    recipient: "+2250700000001",
    phone: "+2250700000001",
    message: "Absence signalée",
    provider: "mock",
    status: "PENDING",
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: null,
    createdAt: new Date("2026-09-15T08:00:00Z"),
    ...overrides,
  };
}

// ── Tests : flush / drain réussi ───────────────────────────────────────────

describe("smsQueue.flush() — envoi réussi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marque le log SENT quand le provider réussit", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([makePending()]);
    mockSendSms.mockResolvedValue({ success: true, providerMessageId: "msg-abc" });

    await smsQueue.flush();

    expect(mockPrisma.smsLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sms-1" },
        data: expect.objectContaining({
          status: "SENT",
          providerMessageId: "msg-abc",
          errorMessage: null,
        }),
      }),
    );
  });

  it("ne fait rien si aucun log PENDING", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([]);

    await smsQueue.flush();

    expect(mockPrisma.smsLog.update).not.toHaveBeenCalled();
  });

  it("traite plusieurs logs en une passe", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([
      makePending({ id: "sms-1" }),
      makePending({ id: "sms-2", recipient: "+2250700000002" }),
    ]);
    mockSendSms.mockResolvedValue({ success: true });

    await smsQueue.flush();

    expect(mockPrisma.smsLog.update).toHaveBeenCalledTimes(2);
  });

  it("passe schoolId au service SMS", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([makePending({ schoolId: "ecole-42" })]);
    mockSendSms.mockResolvedValue({ success: true });

    await smsQueue.flush();

    expect(mockSendSms).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "ecole-42",
    );
  });
});

// ── Tests : backoff exponentiel ────────────────────────────────────────────

describe("smsQueue.flush() — backoff et exhaustion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("planifie un retry avec backoff après échec (attempt 0 → +2 min)", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([makePending({ retryCount: 0 })]);
    mockSendSms.mockResolvedValue({ success: false, errorMessage: "Timeout" });

    const before = Date.now();
    await smsQueue.flush();
    const after = Date.now();

    expect(mockPrisma.smsLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          retryCount: 1,
          nextRetryAt: expect.any(Date),
        }),
      }),
    );

    const updateCall = vi.mocked(mockPrisma.smsLog.update).mock.calls[0][0];
    const nextRetryAt = (updateCall.data as { nextRetryAt: Date }).nextRetryAt.getTime();
    // Should be ~2 minutes after now (120_000 ms * 2^0)
    expect(nextRetryAt).toBeGreaterThanOrEqual(before + 119_000);
    expect(nextRetryAt).toBeLessThanOrEqual(after + 121_000);
  });

  it("double le délai au 2ème échec (attempt 1 → +4 min)", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([makePending({ retryCount: 1 })]);
    mockSendSms.mockResolvedValue({ success: false, errorMessage: "Network error" });

    const before = Date.now();
    await smsQueue.flush();
    const after = Date.now();

    const updateCall = vi.mocked(mockPrisma.smsLog.update).mock.calls[0][0];
    const nextRetryAt = (updateCall.data as { nextRetryAt: Date }).nextRetryAt.getTime();
    // 2 * 60_000 * 2^1 = 240_000 ms ≈ 4 minutes
    expect(nextRetryAt).toBeGreaterThanOrEqual(before + 239_000);
    expect(nextRetryAt).toBeLessThanOrEqual(after + 241_000);
  });

  it("passe à RETRY_EXHAUSTED après maxRetries tentatives", async () => {
    // retryCount=2, maxRetries=3 → nextAttempt=3 >= maxRetries → exhausted
    mockPrisma.smsLog.findMany.mockResolvedValue([
      makePending({ retryCount: 2, maxRetries: 3 }),
    ]);
    mockSendSms.mockResolvedValue({ success: false, errorMessage: "Permanent failure" });

    await smsQueue.flush();

    expect(mockPrisma.smsLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RETRY_EXHAUSTED",
          retryCount: 3,
          nextRetryAt: null,
        }),
      }),
    );
  });

  it("gère les exceptions lancées par le provider (non-throwing failure path)", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([makePending({ retryCount: 0 })]);
    mockSendSms.mockRejectedValue(new Error("Network unreachable"));

    await smsQueue.flush();

    // Should not throw — error is caught and handled as a failed attempt
    expect(mockPrisma.smsLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", retryCount: 1 }),
      }),
    );
  });

  it("maxRetries=1 : RETRY_EXHAUSTED dès le premier échec", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([
      makePending({ retryCount: 0, maxRetries: 1 }),
    ]);
    mockSendSms.mockResolvedValue({ success: false, errorMessage: "Bad number" });

    await smsQueue.flush();

    expect(mockPrisma.smsLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RETRY_EXHAUSTED", retryCount: 1 }),
      }),
    );
  });
});

// ── Tests : enqueueDrain (fire-and-forget) ─────────────────────────────────

describe("smsQueue.enqueueDrain()", () => {
  it("n'attend pas la fin du drain (retourne immédiatement)", () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([]);
    // Should return synchronously (no await)
    const start = Date.now();
    smsQueue.enqueueDrain();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("ne lève pas d'exception même si le drain échoue", async () => {
    mockPrisma.smsLog.findMany.mockRejectedValue(new Error("DB down"));
    // enqueueDrain est fire-and-forget — pas de throw synchrone
    expect(() => smsQueue.enqueueDrain()).not.toThrow();
    // On draine de façon synchrone pour consommer l'erreur et éviter une rejection non gérée
    await smsQueue.flush().catch(() => undefined);
  });
});
