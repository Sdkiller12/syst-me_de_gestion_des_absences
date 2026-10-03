import { describe, expect, it } from "vitest";
import { buildReport, on20, summarize, weightedAverage, type ReportGrade } from "../src/utils/gradeStats.js";
import { overlaps } from "../src/utils/timeSlots.js";
import { gradesSaveSchema, teacherGradesPostSchema, timetableEntryCreateSchema } from "../src/validators/index.js";

const grade = (over: Partial<ReportGrade>): ReportGrade => ({
  id: "g",
  evaluationId: "e",
  title: "Devoir",
  type: "DEVOIR",
  date: "2026-10-01",
  score: 10,
  maxScore: 20,
  coefficient: 1,
  subjectId: "math",
  subjectName: "Mathématiques",
  teacherName: "Jean KOUASSI",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

describe("moyennes", () => {
  it("ramène une note sur 20 quel que soit le barème", () => {
    expect(on20(5, 10)).toBe(10);
    expect(on20(30, 40)).toBe(15);
  });

  it("pondère par les coefficients", () => {
    // (15×2 + 12×1) / 3 = 14
    expect(weightedAverage([{ score: 15, maxScore: 20, coefficient: 2 }, { score: 12, maxScore: 20, coefficient: 1 }])).toBe(14);
    expect(weightedAverage([])).toBeNull();
  });

  it("résume une série de notes", () => {
    expect(summarize([12, 8, 16])).toEqual({ count: 3, average: 12, min: 8, max: 16 });
    expect(summarize([])).toEqual({ count: 0, average: null, min: null, max: null });
  });

  it("calcule moyenne par matière et moyenne générale", () => {
    const report = buildReport([
      grade({ id: "1", score: 15, coefficient: 2 }),
      grade({ id: "2", score: 12, coefficient: 1, date: "2026-10-05" }),
      grade({ id: "3", score: 8, maxScore: 10, subjectId: "fr", subjectName: "Français" }),
    ]);
    expect(report.subjects.map((s) => [s.subjectName, s.average, s.count])).toEqual([
      ["Français", 16, 1],
      ["Mathématiques", 14, 2],
    ]);
    // Notes les plus récentes en premier
    expect(report.subjects[1].grades.map((g) => g.id)).toEqual(["2", "1"]);
    expect(report.overallAverage).toBe(15);
    expect(report.evaluationCount).toBe(3);
  });
});

describe("chevauchement de créneaux", () => {
  it("détecte un chevauchement partiel ou total", () => {
    expect(overlaps("08:00", "10:00", "09:00", "11:00")).toBe(true);
    expect(overlaps("08:00", "12:00", "09:00", "10:00")).toBe(true);
  });

  it("accepte des créneaux consécutifs", () => {
    expect(overlaps("08:00", "10:00", "10:00", "12:00")).toBe(false);
    expect(overlaps("14:00", "16:00", "08:00", "10:00")).toBe(false);
  });
});

describe("validation des saisies", () => {
  it("refuse note négative, plus de 2 décimales et élève en double", () => {
    expect(gradesSaveSchema.safeParse({ grades: [{ studentId: "a", score: -1 }] }).success).toBe(false);
    expect(gradesSaveSchema.safeParse({ grades: [{ studentId: "a", score: 12.345 }] }).success).toBe(false);
    expect(gradesSaveSchema.safeParse({ grades: [{ studentId: "a", score: 12 }, { studentId: "a", score: 13 }] }).success).toBe(false);
    expect(gradesSaveSchema.safeParse({ grades: [{ studentId: "a", score: 12.5 }, { studentId: "b", score: null }] }).success).toBe(true);
  });

  it("exige soit une évaluation existante, soit une nouvelle", () => {
    expect(teacherGradesPostSchema.safeParse({ grades: [] }).success).toBe(false);
    expect(teacherGradesPostSchema.safeParse({ evaluationId: "e", grades: [] }).success).toBe(true);
  });

  it("refuse un créneau dont la fin précède le début ou un jour invalide", () => {
    const base = { classId: "c", subjectId: "s", teacherId: "t", dayOfWeek: 1, startTime: "08:00", endTime: "10:00" };
    expect(timetableEntryCreateSchema.safeParse(base).success).toBe(true);
    expect(timetableEntryCreateSchema.safeParse({ ...base, endTime: "07:00" }).success).toBe(false);
    expect(timetableEntryCreateSchema.safeParse({ ...base, dayOfWeek: 8 }).success).toBe(false);
    expect(timetableEntryCreateSchema.safeParse({ ...base, startTime: "25:00" }).success).toBe(false);
  });
});
