import { describe, expect, it } from "vitest";
import { matchHeaders } from "../src/services/import/tabular.js";
import { generateTemporaryPassword, passwordPolicy, usernameBase } from "../src/utils/credentials.js";
import { addMinutes, businessNow, currentAcademicYear } from "../src/utils/businessTime.js";
import { assignmentForCourse, type TeacherContext } from "../src/middlewares/teacherAccess.js";

const aliases = {
  lastName: ["nom", "nom de famille", "last name"],
  firstName: ["prenom", "first name"],
  subject: ["matiere", "discipline"],
  employeeNumber: ["matricule", "matricule enseignant"],
};

describe("matchHeaders", () => {
  it("reconnaît les variantes quel que soit l'ordre des colonnes", () => {
    expect(matchHeaders(["Discipline", "PRENOM", "Nom de famille"], aliases)).toEqual({ 0: "subject", 1: "firstName", 2: "lastName" });
    expect(matchHeaders(["Last Name", "First Name", "Matière"], aliases)).toEqual({ 0: "lastName", 1: "firstName", 2: "subject" });
  });

  it("ne confond pas « Prénom » avec « Nom »", () => {
    expect(matchHeaders(["Prénom"], aliases)).toEqual({ 0: "firstName" });
  });

  it("attribue chaque champ une seule fois, à la meilleure colonne", () => {
    expect(matchHeaders(["Nom", "Nom du père", "Matricule enseignant"], aliases)).toEqual({ 0: "lastName", 2: "employeeNumber" });
  });
});

describe("identifiants et mots de passe", () => {
  it("construit un identifiant ASCII à partir du nom", () => {
    expect(usernameBase("Jean-Marc", "KOUASSI")).toBe("jean-marc.kouassi");
    expect(usernameBase("Aminata", "TRAORÉ")).toBe("aminata.traore");
    expect(usernameBase("Éloïse", "N'GUESSAN")).toBe("eloise.n-guessan");
  });

  it("génère des mots de passe temporaires conformes et distincts", () => {
    const set = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
    expect(set.size).toBe(50);
    for (const p of set) {
      expect(passwordPolicy.safeParse(p).success).toBe(true);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
});

describe("heure métier Africa/Abidjan", () => {
  it("donne la date et l'heure d'Abidjan quel que soit le fuseau du serveur", () => {
    expect(businessNow(new Date("2026-09-30T23:30:00Z"))).toMatchObject({ date: "2026-09-30", time: "23:30" });
  });

  it("plafonne la fin de séance à 23:59", () => {
    expect(addMinutes("08:15", 90)).toBe("09:45");
    expect(addMinutes("23:30", 60)).toBe("23:59");
  });

  it("bascule l'année académique en septembre", () => {
    expect(currentAcademicYear(new Date("2026-08-31T12:00:00Z"))).toBe("2025-2026");
    expect(currentAcademicYear(new Date("2026-09-01T12:00:00Z"))).toBe("2026-2027");
  });
});

describe("assignmentForCourse", () => {
  const ctx: TeacherContext = {
    teacherId: "t1",
    userId: "u1",
    schoolId: "s1",
    firstName: "Jean",
    lastName: "KOUASSI",
    assignments: [{ id: "a1", subjectId: "math", classId: "c1", academicYear: "2026-2027", subjectName: "Mathématiques", className: "L1 A" }],
  };

  it("autorise un cours rattaché à une affectation de l'enseignant", () => {
    expect(assignmentForCourse(ctx, { classId: "c1", teacherId: "other", assignmentId: "a1", subjectId: "math", subject: "Mathématiques" })?.id).toBe("a1");
  });

  it("autorise un ancien cours de l'enseignant si la classe et la matière correspondent", () => {
    expect(assignmentForCourse(ctx, { classId: "c1", teacherId: "u1", assignmentId: null, subjectId: null, subject: "mathematiques" })?.id).toBe("a1");
  });

  it("refuse une autre classe, une autre matière ou le cours d'un collègue", () => {
    expect(assignmentForCourse(ctx, { classId: "c2", teacherId: "u1", assignmentId: null, subjectId: "math", subject: "Mathématiques" })).toBeUndefined();
    expect(assignmentForCourse(ctx, { classId: "c1", teacherId: "u1", assignmentId: null, subjectId: "fr", subject: "Français" })).toBeUndefined();
    expect(assignmentForCourse(ctx, { classId: "c1", teacherId: "u2", assignmentId: "a9", subjectId: "math", subject: "Mathématiques" })).toBeUndefined();
  });
});
