/**
 * Tests unitaires — attendanceService
 *
 * Couvre : validation des enregistrements, logique SMS PENDING,
 * unicité par cours/étudiant, SMS de justification.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockTx, mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    attendance: { upsert: vi.fn() },
    smsLog: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
  };
  const mockPrisma = {
    course: { findUnique: vi.fn() },
    student: { findMany: vi.fn(), findUnique: vi.fn() },
    attendance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    smsLog: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  };
  return { mockTx, mockPrisma };
});

vi.mock("../src/config/database.js", () => ({ prisma: mockPrisma }));
vi.mock("../src/services/smsQueue.js", () => ({ smsQueue: { enqueueDrain: vi.fn() } }));
vi.mock("../src/services/sms.service.js", () => ({
  smsService: { sendSms: vi.fn().mockResolvedValue({ success: true }) },
}));

import { attendanceService } from "../src/services/attendance.service.js";
import { smsQueue } from "../src/services/smsQueue.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

const SCHOOL_ID = "school-1";
const CLASS_ID = "class-1";
const COURSE_ID = "course-1";

function makeCourse(overrides = {}) {
  return {
    id: COURSE_ID,
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    teacherId: "teacher-1",
    subject: "Mathematiques",
    date: new Date("2026-09-15"),
    startTime: "08:00",
    endTime: "09:00",
    room: null,
    class: { id: CLASS_ID, name: "6ème A" },
    ...overrides,
  };
}

function makeStudent(id: string, overrides = {}) {
  return {
    id,
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    firstName: "Test",
    lastName: "ETUDIANT",
    studentNumber: null,
    phone: "+2250700000001",
    parentPhone: "+2250700000002",
    parentName: "Parent",
    email: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAttendance(id: string, courseId: string, studentId: string, status = "ABSENT") {
  return {
    id,
    courseId,
    studentId,
    status,
    absenceTime: status === "ABSENT" ? new Date() : null,
    justification: null,
    recordedAt: new Date(),
    recordedBy: "teacher-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    student: { firstName: "Test", lastName: "ETUDIANT" },
    course: {
      subject: "Mathematiques",
      date: new Date("2026-09-15"),
      startTime: "08:00",
      class: { name: "6ème A" },
    },
  };
}

// ── Tests : save ───────────────────────────────────────────────────────────

describe("attendanceService.save()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.smsLog.findUnique.mockResolvedValue(null);
  });

  it("lève 400 si records est vide", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourse());
    await expect(
      attendanceService.save({ courseId: COURSE_ID, records: [] }, SCHOOL_ID),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("lève 404 si le cours n'appartient pas à l'école", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourse({ schoolId: "other-school" }));
    await expect(
      attendanceService.save(
        { courseId: COURSE_ID, records: [{ studentId: "s1", status: "PRESENT" }] },
        SCHOOL_ID,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("lève 400 si un étudiant n'appartient pas à la classe du cours", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourse());
    mockPrisma.student.findMany.mockResolvedValue([
      makeStudent("s1", { classId: "other-class" }),
    ]);
    await expect(
      attendanceService.save(
        { courseId: COURSE_ID, records: [{ studentId: "s1", status: "PRESENT" }] },
        SCHOOL_ID,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("lève 400 en cas de doublon d'étudiant dans les records", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourse());
    mockPrisma.student.findMany.mockResolvedValue([makeStudent("s1"), makeStudent("s1")]);
    await expect(
      attendanceService.save(
        {
          courseId: COURSE_ID,
          records: [
            { studentId: "s1", status: "PRESENT" },
            { studentId: "s1", status: "ABSENT" },
          ],
        },
        SCHOOL_ID,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("crée un SmsLog PENDING pour chaque étudiant ABSENT", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourse());
    mockPrisma.student.findMany.mockResolvedValue([makeStudent("s1"), makeStudent("s2")]);

    const absentAttendance = { id: "att-1", status: "ABSENT" };
    const presentAttendance = { id: "att-2", status: "PRESENT" };
    mockTx.attendance.upsert
      .mockResolvedValueOnce(absentAttendance)
      .mockResolvedValueOnce(presentAttendance);

    // Mock findMany for the final result fetch
    mockPrisma.attendance.findMany.mockResolvedValue([
      makeAttendance("att-1", COURSE_ID, "s1", "ABSENT"),
      makeAttendance("att-2", COURSE_ID, "s2", "PRESENT"),
    ]);

    await attendanceService.save(
      {
        courseId: COURSE_ID,
        records: [
          { studentId: "s1", status: "ABSENT" },
          { studentId: "s2", status: "PRESENT" },
        ],
      },
      SCHOOL_ID,
    );

    // SmsLog created only for absent student
    expect(mockTx.smsLog.create).toHaveBeenCalledOnce();
    expect(mockTx.smsLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", studentId: "s1" }) }),
    );
  });

  it("déclenche le drain SMS après la transaction", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourse());
    mockPrisma.student.findMany.mockResolvedValue([makeStudent("s1")]);
    mockTx.attendance.upsert.mockResolvedValue({ id: "att-1", status: "PRESENT" });
    mockPrisma.attendance.findMany.mockResolvedValue([
      makeAttendance("att-1", COURSE_ID, "s1", "PRESENT"),
    ]);

    await attendanceService.save(
      { courseId: COURSE_ID, records: [{ studentId: "s1", status: "PRESENT" }] },
      SCHOOL_ID,
    );

    expect(smsQueue.enqueueDrain).toHaveBeenCalled();
  });

  it("ne crée pas de doublon SmsLog si un log existe déjà", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(makeCourse());
    mockPrisma.student.findMany.mockResolvedValue([makeStudent("s1")]);
    mockTx.attendance.upsert.mockResolvedValue({ id: "att-1", status: "ABSENT" });
    // Existing SMS log for this attendance
    mockTx.smsLog.findUnique.mockResolvedValue({ id: "sms-existing" });
    mockPrisma.attendance.findMany.mockResolvedValue([
      makeAttendance("att-1", COURSE_ID, "s1", "ABSENT"),
    ]);

    await attendanceService.save(
      { courseId: COURSE_ID, records: [{ studentId: "s1", status: "ABSENT" }] },
      SCHOOL_ID,
    );

    expect(mockTx.smsLog.create).not.toHaveBeenCalled();
  });

  it("lève 403 si schoolId est null", async () => {
    await expect(
      attendanceService.save({ courseId: COURSE_ID, records: [] }, null),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── Tests : updateOne ──────────────────────────────────────────────────────

describe("attendanceService.updateOne()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lève 404 si la présence n'appartient pas à l'école", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({
      id: "att-1",
      studentId: "s1",
      status: "ABSENT",
      course: { schoolId: "other-school", subject: "Math", date: new Date(), startTime: "08:00" },
    });

    await expect(
      attendanceService.updateOne("att-1", "JUSTIFIED", null, SCHOOL_ID),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("crée un SmsLog PENDING quand on passe à ABSENT sans log existant", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({
      id: "att-1",
      studentId: "s1",
      status: "PRESENT",
      course: { schoolId: SCHOOL_ID, subject: "Math", date: new Date("2026-09-15"), startTime: "08:00" },
    });
    mockPrisma.attendance.update.mockResolvedValue({ id: "att-1", status: "ABSENT" });
    mockPrisma.smsLog.findUnique.mockResolvedValue(null);
    mockPrisma.student.findUnique.mockResolvedValue(makeStudent("s1"));

    await attendanceService.updateOne("att-1", "ABSENT", null, SCHOOL_ID);

    expect(mockPrisma.smsLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", studentId: "s1" }) }),
    );
  });
});

// ── Tests : smsMessage sanitisation ───────────────────────────────────────

describe("smsMessage helpers", () => {
  it("strip accents et caractères de contrôle dans les noms", async () => {
    const { buildAbsenceMessage, sanitizeSmsField } = await import("../src/utils/smsMessage.js");

    expect(sanitizeSmsField("Awa")).toBe("Awa");
    expect(sanitizeSmsField("Élodie")).toBe("Elodie");
    expect(sanitizeSmsField("François\nInjection")).toBe("Francois Injection");
    expect(sanitizeSmsField("Test\x00Null")).toBe("Test Null");
  });

  it("buildAbsenceMessage produit un message GSM-7 pur sans accent", async () => {
    const { buildAbsenceMessage } = await import("../src/utils/smsMessage.js");
    const msg = buildAbsenceMessage({
      firstName: "Élodie",
      lastName: "MÉNDEZ",
      subject: "Mathématiques",
      date: "2026-09-15",
      startTime: "08:00",
    });
    // No accented characters should remain
    expect(msg).not.toMatch(/[àâäéèêëîïôöùûü]/i);
    expect(msg).toContain("Elodie");
    expect(msg).toContain("MENDEZ");
    expect(msg).toContain("15/09/2026");
    expect(msg).toContain("08:00");
  });

  it("buildJustificationMessage mentionne le cours et la date", async () => {
    const { buildJustificationMessage } = await import("../src/utils/smsMessage.js");
    const msg = buildJustificationMessage({
      firstName: "Koffi",
      lastName: "ASSOUMOU",
      subject: "Français",
      date: "2026-09-15",
    });
    expect(msg).toContain("Koffi");
    expect(msg).toContain("ASSOUMOU");
    expect(msg).toContain("15/09/2026");
    expect(msg).toContain("justifiee");
  });
});
