import { describe, expect, it } from "vitest";
import { formatScore, parseScore, scoreTone } from "../src/utils/grades";
import { groupByDay, groupClassesByLevel, isoWeekday, visibleDays } from "../src/utils/timetable";
import type { ClassOption, TimetableEntry } from "../src/types";

const entry = (id: string, dayOfWeek: number, startTime: string): TimetableEntry => ({
  id,
  dayOfWeek,
  startTime,
  endTime: "23:00",
  room: null,
  class: { id: "c", name: "3ème A" },
  subject: { id: "s", name: "Maths" },
  teacher: { id: "t", name: "Jean KOUASSI" },
});

const cls = (id: string, name: string, level: string | null): ClassOption => ({ id, name, level, academicYear: "2026-2027", slotCount: 0 });

describe("saisie des notes", () => {
  it("accepte une note vide, entière ou décimale (virgule ou point)", () => {
    expect(parseScore("", 20)).toEqual({ value: null });
    expect(parseScore("15", 20)).toEqual({ value: 15 });
    expect(parseScore("12,5", 20)).toEqual({ value: 12.5 });
    expect(parseScore(" 9.75 ", 20)).toEqual({ value: 9.75 });
  });

  it("refuse une note invalide, négative ou au-dessus du barème", () => {
    expect(parseScore("abc", 20).error).toBe("Note invalide");
    expect(parseScore("-2", 20).error).toBe("Note invalide");
    expect(parseScore("12.345", 20).error).toBe("Note invalide");
    expect(parseScore("21", 20).error).toBe("Max 20");
    expect(parseScore("11", 10).error).toBe("Max 10");
  });

  it("formate les notes à la française", () => {
    expect(formatScore(17.5)).toBe("17,5");
    expect(formatScore(15)).toBe("15");
    expect(formatScore(null)).toBe("—");
  });

  it("colore selon la note ramenée sur 20", () => {
    expect(scoreTone(15)).toBe("green");
    expect(scoreTone(10)).toBe("amber");
    expect(scoreTone(4, 10)).toBe("red");
    expect(scoreTone(null)).toBe("slate");
  });
});

describe("emploi du temps", () => {
  it("regroupe les créneaux par jour, triés par heure", () => {
    const byDay = groupByDay([entry("b", 1, "10:00"), entry("a", 1, "08:00"), entry("c", 2, "08:00")]);
    expect(byDay.get(1)!.map((e) => e.id)).toEqual(["a", "b"]);
    expect(byDay.get(2)!.map((e) => e.id)).toEqual(["c"]);
  });

  it("affiche lundi → samedi, et le dimanche seulement s'il a des cours", () => {
    expect(visibleDays([]).map((d) => d.short)).toEqual(["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]);
    expect(visibleDays([entry("x", 7, "09:00")]).at(-1)!.label).toBe("Dimanche");
  });

  it("numérote les jours comme l'API (1 = lundi, 7 = dimanche)", () => {
    expect(isoWeekday(new Date("2026-10-05T12:00:00"))).toBe(1); // lundi
    expect(isoWeekday(new Date("2026-10-04T12:00:00"))).toBe(7); // dimanche
  });

  it("regroupe les classes par niveau tel qu'enregistré en base", () => {
    const groups = groupClassesByLevel([cls("1", "3ème B", "3ème"), cls("2", "3ème A", "3ème"), cls("3", "Terminale D", "Terminale"), cls("4", "Atelier", null)]);
    expect(groups.map((g) => g.level)).toEqual(["3ème", "Terminale", "Autres classes"]);
    expect(groups[0].classes.map((c) => c.name)).toEqual(["3ème A", "3ème B"]);
  });
});
