/**
 * Tests unitaires — notificationService
 *
 * Couvre : list (filtres, pagination, scope école), getById, retry
 * Stratégie : mock Prisma + smsQueue, pas de DB réelle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    smsLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../src/config/database.js", () => ({ prisma: mockPrisma }));
vi.mock("../src/services/smsQueue.js", () => ({
  smsQueue: { enqueueDrain: vi.fn() },
}));

import { notificationService } from "../src/services/notification.service.js";
import { smsQueue } from "../src/services/smsQueue.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

const SCHOOL_ID = "school-1";

function makeSmsLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "sms-1",
    schoolId: SCHOOL_ID,
    studentId: "student-1",
    attendanceId: "att-1",
    recipient: "+2250700000001",
    phone: "+2250700000001",
    message: "Test message",
    provider: "mock",
    status: "PENDING",
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: null,
    providerMessageId: null,
    errorMessage: null,
    sentAt: null,
    createdAt: new Date("2026-09-15T08:00:00Z"),
    updatedAt: new Date("2026-09-15T08:00:00Z"),
    student: {
      lastName: "ASSOUMOU",
      firstName: "Koffi",
      class: { name: "6ème A" },
    },
    attendance: {
      course: {
        subject: "Mathématiques",
        date: new Date("2026-09-15"),
        startTime: "08:00",
      },
    },
    ...overrides,
  };
}

// ── Tests : list ───────────────────────────────────────────────────────────

describe("notificationService.list()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne la liste paginée pour une école donnée", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([makeSmsLog()]);
    mockPrisma.smsLog.count.mockResolvedValue(1);

    const result = await notificationService.list({ page: "1", limit: "10" }, SCHOOL_ID);

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.page).toBe(1);
    expect(mockPrisma.smsLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: SCHOOL_ID }) }),
    );
  });

  it("filtre par status si fourni", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([]);
    mockPrisma.smsLog.count.mockResolvedValue(0);

    await notificationService.list({ status: "SENT" }, SCHOOL_ID);

    expect(mockPrisma.smsLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: SCHOOL_ID, status: "SENT" }),
      }),
    );
  });

  it("filtre par studentId si fourni", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([]);
    mockPrisma.smsLog.count.mockResolvedValue(0);

    await notificationService.list({ studentId: "student-42" }, SCHOOL_ID);

    expect(mockPrisma.smsLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "student-42" }),
      }),
    );
  });

  it("lève 403 si schoolId est null", async () => {
    await expect(notificationService.list({}, null)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("mappe correctement le nom de l'étudiant", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([makeSmsLog()]);
    mockPrisma.smsLog.count.mockResolvedValue(1);

    const result = await notificationService.list({}, SCHOOL_ID);

    expect(result.data[0].studentName).toBe("ASSOUMOU Koffi");
  });

  it("retourne une liste vide si aucun log", async () => {
    mockPrisma.smsLog.findMany.mockResolvedValue([]);
    mockPrisma.smsLog.count.mockResolvedValue(0);

    const result = await notificationService.list({}, SCHOOL_ID);

    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});

// ── Tests : getById ────────────────────────────────────────────────────────

describe("notificationService.getById()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne le log si trouvé et appartenant à l'école", async () => {
    mockPrisma.smsLog.findUnique.mockResolvedValue(makeSmsLog());

    const result = await notificationService.getById("sms-1", SCHOOL_ID);

    expect(result.id).toBe("sms-1");
    expect(result.schoolId).toBe(SCHOOL_ID);
  });

  it("lève 404 si le log n'existe pas", async () => {
    mockPrisma.smsLog.findUnique.mockResolvedValue(null);

    await expect(notificationService.getById("not-found", SCHOOL_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("lève 404 si le log appartient à une autre école", async () => {
    mockPrisma.smsLog.findUnique.mockResolvedValue(makeSmsLog({ schoolId: "other-school" }));

    await expect(notificationService.getById("sms-1", SCHOOL_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("lève 403 si schoolId est null", async () => {
    await expect(notificationService.getById("sms-1", null)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ── Tests : retry ──────────────────────────────────────────────────────────

describe("notificationService.retry()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("repasse le log FAILED en PENDING et déclenche le drain", async () => {
    mockPrisma.smsLog.findUnique
      .mockResolvedValueOnce(makeSmsLog({ status: "FAILED" }))
      .mockResolvedValueOnce(makeSmsLog({ status: "PENDING" }));
    mockPrisma.smsLog.update.mockResolvedValue(makeSmsLog({ status: "PENDING" }));

    await notificationService.retry("sms-1", SCHOOL_ID);

    expect(mockPrisma.smsLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", errorMessage: null }),
      }),
    );
    expect(smsQueue.enqueueDrain).toHaveBeenCalled();
  });

  it("lève 400 si le statut n'est pas FAILED", async () => {
    mockPrisma.smsLog.findUnique.mockResolvedValue(makeSmsLog({ status: "PENDING" }));

    await expect(notificationService.retry("sms-1", SCHOOL_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("lève 400 si le statut est RETRY_EXHAUSTED (pas FAILED)", async () => {
    mockPrisma.smsLog.findUnique.mockResolvedValue(
      makeSmsLog({ status: "RETRY_EXHAUSTED" }),
    );

    await expect(notificationService.retry("sms-1", SCHOOL_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("lève 404 si le log n'existe pas", async () => {
    mockPrisma.smsLog.findUnique.mockResolvedValue(null);

    await expect(notificationService.retry("ghost", SCHOOL_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("lève 404 si le log appartient à une autre école", async () => {
    mockPrisma.smsLog.findUnique.mockResolvedValue(
      makeSmsLog({ status: "FAILED", schoolId: "autre-ecole" }),
    );

    await expect(notificationService.retry("sms-1", SCHOOL_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("lève 403 si schoolId est null", async () => {
    await expect(notificationService.retry("sms-1", null)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
