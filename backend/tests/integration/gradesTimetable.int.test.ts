/**
 * Notes, emploi du temps et espace étudiant sur une VRAIE base PostgreSQL (aucun mock).
 *
 * Lancement : npm run test:integration
 * (DATABASE_URL doit pointer vers une base dont le nom se termine par "_test" : elle est vidée.)
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Test } from "supertest";
import type TestAgent from "supertest/lib/agent.js";

const dbUrl = process.env.DATABASE_URL ?? "";
const enabled = /_test(\?|$)/.test(dbUrl.split("/").pop() ?? "");

type Agent = InstanceType<typeof TestAgent>;

// Les requêtes mutantes authentifiées par cookie doivent porter l'en-tête anti-CSRF
const xhr = (t: Test) => t.set("X-Requested-With", "XMLHttpRequest");

describe.skipIf(!enabled)("Notes, emploi du temps et espace étudiant — PostgreSQL", () => {
  let app: Parameters<typeof request>[0];
  let prisma: typeof import("../../src/config/database.js").prisma;
  let year: string;

  const A = { classes: {} as Record<string, string>, students: {} as Record<string, string>, subjects: {} as Record<string, string>, teachers: {} as Record<string, string> };
  let schoolA = "";
  let adminA: Agent;
  let adminB: Agent;
  let jean: Agent; // Maths en 3ème A et 4ème B
  let awa: Agent; // Français en 3ème A
  let koffiStudent: Agent; // élève de 3ème A
  let marcStudent: Agent; // élève de 4ème B
  let evaluationId = "";
  let koffiGradeId = "";
  let entryId = "";
  let classB = "";

  async function registerSchool(agent: Agent, suffix: string) {
    const res = await agent.post("/api/auth/register-school").send({
      schoolName: `Collège ${suffix}`,
      adminFirstName: "Admin",
      adminLastName: suffix,
      adminEmail: `admin-${suffix.toLowerCase()}@grades.ci`,
      adminPassword: "AdminPass123",
    });
    expect(res.status).toBe(201);
    return res.body.data.school.id as string;
  }

  /** Première connexion avec le mot de passe temporaire puis changement obligatoire */
  async function firstLogin(username: string, temporaryPassword: string) {
    const agent = request.agent(app);
    expect((await agent.post("/api/auth/login").send({ identifier: username, password: temporaryPassword })).status).toBe(200);
    // Tant que le mot de passe temporaire n'est pas changé, l'espace reste fermé
    expect((await agent.get("/api/student/me")).status).toBe(403);
    const change = await xhr(agent.post("/api/auth/change-password")).send({ currentPassword: temporaryPassword, newPassword: "NewPass123" });
    expect(change.status).toBe(200);
    return agent;
  }

  async function createTeacher(firstName: string, lastName: string, items: Array<[string, string]>) {
    const t = await xhr(adminA.post("/api/teachers")).send({ firstName, lastName });
    expect(t.status).toBe(201);
    const assign = await xhr(adminA.post(`/api/teachers/${t.body.data.id}/assignments`)).send({
      academicYear: year,
      items: items.map(([subject, cls]) => ({ subjectId: A.subjects[subject], classId: A.classes[cls] })),
    });
    expect(assign.status).toBe(201);
    const acc = await xhr(adminA.post(`/api/teachers/${t.body.data.id}/account`));
    expect(acc.status).toBe(201);
    A.teachers[firstName] = t.body.data.id;
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ identifier: acc.body.data.username, password: acc.body.data.temporaryPassword });
    await xhr(agent.post("/api/auth/change-password")).send({ currentPassword: acc.body.data.temporaryPassword, newPassword: "NewPass123" });
    return agent;
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    ({ prisma } = await import("../../src/config/database.js"));
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
    const { createApp } = await import("../../src/app.js");
    const { currentAcademicYear } = await import("../../src/utils/businessTime.js");
    app = createApp();
    year = currentAcademicYear();
    adminA = request.agent(app);
    adminB = request.agent(app);

    schoolA = await registerSchool(adminA, "ALPHA");
    await registerSchool(adminB, "BETA");
    for (const name of ["3ème A", "4ème B"]) {
      const res = await xhr(adminA.post("/api/classes")).send({ name, academicYear: year, level: name.split(" ")[0] });
      expect(res.status).toBe(201);
      A.classes[name] = res.body.data.id;
    }
    for (const [key, firstName, lastName, cls] of [
      ["koffi", "Koffi", "YAO", "3ème A"],
      ["sarah", "Sarah", "KONAN", "3ème A"],
      ["marc", "Marc", "ZADI", "4ème B"],
    ]) {
      const res = await xhr(adminA.post("/api/students")).send({ firstName, lastName, phone: "0701020304", classId: A.classes[cls] });
      expect(res.status).toBe(201);
      A.students[key] = res.body.data.id;
    }
    for (const name of ["Mathématiques", "Français"]) {
      const res = await xhr(adminA.post("/api/subjects")).send({ name });
      expect(res.status).toBe(201);
      A.subjects[name] = res.body.data.id;
    }
    jean = await createTeacher("Jean", "KOUASSI", [["Mathématiques", "3ème A"], ["Mathématiques", "4ème B"]]);
    awa = await createTeacher("Awa", "TRAORE", [["Français", "3ème A"]]);

    const cb = await xhr(adminB.post("/api/classes")).send({ name: "6ème C", academicYear: year });
    classB = cb.body.data.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ─── Notes ────────────────────────────────────────────────────────────────

  it("l'enseignant affecté saisit une évaluation et ses notes, réellement enregistrées en base", async () => {
    const res = await xhr(jean.post("/api/teacher/grades")).send({
      evaluation: { classId: A.classes["3ème A"], subjectId: A.subjects["Mathématiques"], title: "Devoir 1", type: "DEVOIR", date: "2026-10-01", maxScore: 20, coefficient: 2 },
      grades: [
        { studentId: A.students.koffi, score: 15 },
        { studentId: A.students.sarah, score: 17.5 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ created: true, saved: 2, cleared: 0 });
    evaluationId = res.body.data.evaluationId;
    const rows = await prisma.grade.findMany({ where: { evaluationId }, orderBy: { score: "asc" } });
    expect(rows.map((r) => r.score)).toEqual([15, 17.5]);
    koffiGradeId = rows[0].id;
  });

  it("refuse un enseignant non affecté à la matière ou à la classe", async () => {
    // Awa enseigne le français : pas les mathématiques en 3ème A
    const wrongSubject = await xhr(awa.post("/api/teacher/grades")).send({
      evaluation: { classId: A.classes["3ème A"], subjectId: A.subjects["Mathématiques"], title: "Intrus", date: "2026-10-01" },
      grades: [{ studentId: A.students.koffi, score: 10 }],
    });
    expect(wrongSubject.status).toBe(403);
    expect(wrongSubject.body.error.code).toBe("NOT_ASSIGNED");
    // …ni en 4ème B, même via la création directe d'évaluation
    const wrongClass = await xhr(awa.post("/api/teacher/evaluations")).send({ classId: A.classes["4ème B"], subjectId: A.subjects["Français"], title: "Intrus", date: "2026-10-01" });
    expect(wrongClass.status).toBe(403);
    // Une évaluation d'un autre enseignant ne peut pas être ciblée
    const foreign = await xhr(awa.post("/api/teacher/grades")).send({ evaluationId, grades: [{ studentId: A.students.koffi, score: 0 }] });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe("NOT_OWNER");
  });

  it("refuse une note supérieure au barème, une note négative et un élève hors de la classe", async () => {
    const above = await xhr(jean.put(`/api/teacher/evaluations/${evaluationId}/grades`)).send({ grades: [{ studentId: A.students.koffi, score: 21 }] });
    expect(above.status).toBe(400);
    expect(above.body.error.code).toBe("SCORE_ABOVE_MAX");
    const negative = await xhr(jean.put(`/api/teacher/evaluations/${evaluationId}/grades`)).send({ grades: [{ studentId: A.students.koffi, score: -1 }] });
    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe("VALIDATION_ERROR");
    const outsider = await xhr(jean.put(`/api/teacher/evaluations/${evaluationId}/grades`)).send({ grades: [{ studentId: A.students.marc, score: 12 }] });
    expect(outsider.status).toBe(400);
    expect(outsider.body.error.code).toBe("STUDENT_NOT_IN_CLASS");
    // Aucune note n'a été modifiée par ces tentatives
    expect((await prisma.grade.findUniqueOrThrow({ where: { id: koffiGradeId } })).score).toBe(15);
  });

  it("refuse un coefficient nul et une évaluation en double", async () => {
    const coef = await xhr(jean.post("/api/teacher/evaluations")).send({ classId: A.classes["3ème A"], subjectId: A.subjects["Mathématiques"], title: "Devoir 2", date: "2026-10-02", coefficient: 0 });
    expect(coef.status).toBe(400);
    const dup = await xhr(jean.post("/api/teacher/evaluations")).send({ classId: A.classes["3ème A"], subjectId: A.subjects["Mathématiques"], title: "Devoir 1", date: "2026-10-01" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("EVALUATION_EXISTS");
  });

  it("l'enseignant modifie sa note ; un autre enseignant ne le peut pas", async () => {
    const ok = await xhr(jean.put(`/api/teacher/grades/${koffiGradeId}`)).send({ score: 16 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.score).toBe(16);
    const other = await xhr(awa.put(`/api/teacher/grades/${koffiGradeId}`)).send({ score: 2 });
    expect(other.status).toBe(403);
    expect((await prisma.grade.findUniqueOrThrow({ where: { id: koffiGradeId } })).score).toBe(16);
    // La modification est tracée dans le journal d'audit
    const log = await prisma.auditLog.findFirst({ where: { action: "GRADE_UPDATE", entityId: koffiGradeId } });
    expect(log?.metadata).toMatchObject({ from: 15, to: 16 });
  });

  it("le barème ne descend pas sous une note existante ; effacer une note la supprime", async () => {
    const lower = await xhr(jean.patch(`/api/teacher/evaluations/${evaluationId}`)).send({ maxScore: 10 });
    expect(lower.status).toBe(400);
    const clear = await xhr(jean.put(`/api/teacher/evaluations/${evaluationId}/grades`)).send({ grades: [{ studentId: A.students.sarah, score: null }] });
    expect(clear.body.data).toMatchObject({ saved: 0, cleared: 1 });
    await xhr(jean.put(`/api/teacher/evaluations/${evaluationId}/grades`)).send({ grades: [{ studentId: A.students.sarah, score: 17.5 }] });
  });

  it("chaque enseignant ne voit que ses propres évaluations", async () => {
    const mine = await jean.get("/api/teacher/evaluations");
    expect(mine.body.data.map((e: { id: string }) => e.id)).toContain(evaluationId);
    expect(mine.body.data[0].stats).toMatchObject({ count: 2, min: 16, max: 17.5 });
    const theirs = await awa.get("/api/teacher/evaluations");
    expect(theirs.body.data).toEqual([]);
    expect((await awa.get(`/api/teacher/evaluations/${evaluationId}`)).status).toBe(403);
    // Filtrer sur une classe non affectée est refusé
    expect((await awa.get(`/api/teacher/grades?classId=${A.classes["4ème B"]}`)).status).toBe(403);
  });

  it("l'administrateur consulte les notes, filtres et statistiques compris", async () => {
    const list = await adminA.get(`/api/admin/grades?classId=${A.classes["3ème A"]}&teacherId=${A.teachers.Jean}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    const byStudent = await adminA.get(`/api/admin/grades?studentId=${A.students.koffi}`);
    expect(byStudent.body.data.map((g: { score: number }) => g.score)).toEqual([16]);
    const period = await adminA.get("/api/admin/grades?from=2026-11-01");
    expect(period.body.data).toEqual([]);
    const stats = await adminA.get("/api/admin/grades/stats");
    expect(stats.body.data).toMatchObject({ evaluations: 1, grades: 2, average: 16.75 });
    const detail = await adminA.get(`/api/admin/grades/evaluations/${evaluationId}`);
    expect(detail.body.data.grades).toHaveLength(2);
  });

  it("l'administrateur ne peut ni ajouter, ni modifier, ni supprimer une note", async () => {
    for (const call of [
      () => xhr(adminA.post("/api/admin/grades")).send({ score: 20 }),
      () => xhr(adminA.put(`/api/admin/grades/${koffiGradeId}`)).send({ score: 20 }),
      () => xhr(adminA.patch(`/api/admin/grades/evaluations/${evaluationId}`)).send({ coefficient: 5 }),
      () => xhr(adminA.delete(`/api/admin/grades/evaluations/${evaluationId}`)),
    ]) {
      const res = await call();
      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe("READ_ONLY");
    }
    // Les routes de saisie enseignant lui sont fermées
    expect((await xhr(adminA.put(`/api/teacher/grades/${koffiGradeId}`)).send({ score: 20 })).status).toBe(403);
    expect((await xhr(adminA.post("/api/teacher/grades")).send({ evaluationId, grades: [] })).status).toBe(403);
    const ev = await prisma.evaluation.findUniqueOrThrow({ where: { id: evaluationId } });
    expect(ev.coefficient).toBe(2);
  });

  // ─── Comptes et espace étudiant ───────────────────────────────────────────

  it("l'administration crée les comptes d'une classe ; l'élève se connecte", async () => {
    const res = await xhr(adminA.post("/api/students/accounts")).send({ classId: A.classes["3ème A"] });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toHaveLength(2);
    const koffi = res.body.data.created.find((c: { studentId: string }) => c.studentId === A.students.koffi);
    koffiStudent = await firstLogin(koffi.username, koffi.temporaryPassword);
    const marc = await xhr(adminA.post(`/api/students/${A.students.marc}/account`));
    marcStudent = await firstLogin(marc.body.data.username, marc.body.data.temporaryPassword);
    const me = await koffiStudent.get("/api/auth/me");
    expect(me.body.data.role).toBe("STUDENT");
  });

  it("l'élève ne voit que ses propres notes, avec des moyennes calculées sur les vraies notes", async () => {
    const res = await koffiStudent.get("/api/student/grades");
    expect(res.status).toBe(200);
    expect(res.body.data.evaluationCount).toBe(1);
    expect(res.body.data.subjects[0]).toMatchObject({ subjectName: "Mathématiques", average: 16, count: 1 });
    expect(res.body.data.overallAverage).toBe(16);
    // Marc (autre classe) n'a aucune note : rien d'un autre élève ne fuit
    const marc = await marcStudent.get("/api/student/grades");
    expect(marc.body.data).toMatchObject({ evaluationCount: 0, overallAverage: null, subjects: [] });
    // Un identifiant d'élève dans la requête est ignoré : la route ne connaît que l'élève du jeton
    const spoof = await marcStudent.get(`/api/student/grades?studentId=${A.students.koffi}`);
    expect(spoof.body.data.evaluationCount).toBe(0);
  });

  it("l'élève n'accède ni aux espaces enseignant/administration ni aux données des autres", async () => {
    for (const url of ["/api/teacher/evaluations", "/api/admin/grades", `/api/admin/grades/students/${A.students.sarah}`, "/api/students", "/api/dashboard", "/api/admin/timetable?classId=x"]) {
      expect((await koffiStudent.get(url)).status).toBe(403);
    }
    expect((await xhr(koffiStudent.put(`/api/teacher/grades/${koffiGradeId}`)).send({ score: 20 })).status).toBe(403);
    // Et un enseignant n'entre pas dans l'espace étudiant
    expect((await jean.get("/api/student/grades")).status).toBe(403);
  });

  // ─── Emploi du temps ──────────────────────────────────────────────────────

  const slot = (over: Record<string, unknown> = {}) => ({
    classId: A.classes["3ème A"],
    subjectId: A.subjects["Mathématiques"],
    teacherId: A.teachers.Jean,
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "10:00",
    room: "Salle 12",
    ...over,
  });

  it("l'administrateur crée un créneau ; les créneaux consécutifs sont acceptés", async () => {
    const res = await xhr(adminA.post("/api/admin/timetable")).send(slot());
    expect(res.status).toBe(201);
    entryId = res.body.data.id;
    const next = await xhr(adminA.post("/api/admin/timetable")).send(
      slot({ subjectId: A.subjects["Français"], teacherId: A.teachers.Awa, startTime: "10:00", endTime: "12:00", room: "Salle 8" }),
    );
    expect(next.status).toBe(201);
    expect(await prisma.timetableEntry.count({ where: { classId: A.classes["3ème A"] } })).toBe(2);
  });

  it("détecte les conflits : même classe, même enseignant, même salle", async () => {
    const sameClass = await xhr(adminA.post("/api/admin/timetable")).send(slot({ subjectId: A.subjects["Français"], teacherId: A.teachers.Awa, startTime: "09:00", endTime: "11:00", room: null }));
    expect(sameClass.status).toBe(409);
    expect(sameClass.body.error.code).toBe("TIMETABLE_CONFLICT");
    const sameTeacher = await xhr(adminA.post("/api/admin/timetable")).send(slot({ classId: A.classes["4ème B"], startTime: "09:30", endTime: "10:30", room: null }));
    expect(sameTeacher.status).toBe(409);
    expect(sameTeacher.body.error.message).toMatch(/Jean KOUASSI enseigne déjà/);
    const sameRoom = await xhr(adminA.post("/api/admin/timetable")).send(slot({ classId: A.classes["4ème B"], startTime: "10:00", endTime: "11:00", teacherId: A.teachers.Jean, room: "salle 8" }));
    expect(sameRoom.status).toBe(409);
    expect(sameRoom.body.error.message).toMatch(/salle/i);
  });

  it("refuse un enseignant non affecté et des horaires incohérents", async () => {
    const notAssigned = await xhr(adminA.post("/api/admin/timetable")).send(slot({ classId: A.classes["4ème B"], subjectId: A.subjects["Français"], teacherId: A.teachers.Awa, dayOfWeek: 2 }));
    expect(notAssigned.status).toBe(400);
    expect(notAssigned.body.error.code).toBe("NOT_ASSIGNED");
    const reversed = await xhr(adminA.post("/api/admin/timetable")).send(slot({ dayOfWeek: 3, startTime: "10:00", endTime: "09:00" }));
    expect(reversed.status).toBe(400);
  });

  it("l'administrateur modifie puis supprime un créneau", async () => {
    const upd = await xhr(adminA.put(`/api/admin/timetable/${entryId}`)).send({ dayOfWeek: 2, room: "Salle 4" });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ dayOfWeek: 2, room: "Salle 4" });
    // Une modification ne doit pas créer de conflit non plus
    const tmp = await xhr(adminA.post("/api/admin/timetable")).send(slot({ classId: A.classes["4ème B"], dayOfWeek: 4, room: null }));
    expect(tmp.status).toBe(201);
    const clash = await xhr(adminA.put(`/api/admin/timetable/${tmp.body.data.id}`)).send({ dayOfWeek: 2 });
    expect(clash.status).toBe(409);
    const del = await xhr(adminA.delete(`/api/admin/timetable/${tmp.body.data.id}`));
    expect(del.status).toBe(204);
    expect(await prisma.timetableEntry.findUnique({ where: { id: tmp.body.data.id } })).toBeNull();
  });

  it("l'enseignant consulte son emploi du temps mais ne peut pas le modifier", async () => {
    const res = await jean.get("/api/teacher/timetable");
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.data.entries[0]).toMatchObject({ dayOfWeek: 2, class: { name: "3ème A" }, subject: { name: "Mathématiques" } });
    expect((await xhr(jean.post("/api/admin/timetable")).send(slot({ dayOfWeek: 5 }))).status).toBe(403);
    expect((await xhr(jean.put(`/api/admin/timetable/${entryId}`)).send({ dayOfWeek: 5 })).status).toBe(403);
    expect((await xhr(jean.delete(`/api/admin/timetable/${entryId}`))).status).toBe(403);
  });

  it("l'élève consulte l'emploi du temps de sa classe et choisit une classe de son école", async () => {
    const mine = await koffiStudent.get("/api/student/timetable");
    expect(mine.status).toBe(200);
    expect(mine.body.data.class.name).toBe("3ème A");
    expect(mine.body.data.entries).toHaveLength(2);
    const classes = await koffiStudent.get("/api/student/classes");
    expect(classes.body.data.classes.map((c: { name: string }) => c.name).sort()).toEqual(["3ème A", "4ème B"]);
    expect(classes.body.data.myClassId).toBe(A.classes["3ème A"]);
    expect((await xhr(koffiStudent.post("/api/admin/timetable")).send(slot({ dayOfWeek: 5 }))).status).toBe(403);
  });

  it("la consultation publique n'expose ni identifiant d'enseignant ni donnée d'élève", async () => {
    const school = await request(app).get(`/api/public/schools/${schoolA}`);
    expect(school.status).toBe(200);
    expect(school.body.data.classes).toHaveLength(2);
    expect(JSON.stringify(school.body)).not.toMatch(/Koffi|YAO|0701020304/);
    const tt = await request(app).get(`/api/public/schools/${schoolA}/classes/${A.classes["3ème A"]}/timetable`);
    expect(tt.status).toBe(200);
    expect(tt.body.data.entries[0].teacher).toEqual({ id: null, name: "A. TRAORE" });
    // Une classe d'une autre école n'est pas consultable via le lien de l'école A
    expect((await request(app).get(`/api/public/schools/${schoolA}/classes/${classB}/timetable`)).status).toBe(404);
  });

  // ─── Isolation entre établissements ───────────────────────────────────────

  it("aucune donnée de l'école A n'est accessible depuis l'école B", async () => {
    expect((await adminB.get("/api/admin/grades")).body.data).toEqual([]);
    expect((await adminB.get("/api/admin/grades/stats")).body.data).toMatchObject({ evaluations: 0, grades: 0 });
    expect((await adminB.get(`/api/admin/grades/evaluations/${evaluationId}`)).status).toBe(404);
    expect((await adminB.get(`/api/admin/grades/students/${A.students.koffi}`)).status).toBe(404);
    expect((await adminB.get(`/api/admin/timetable?classId=${A.classes["3ème A"]}`)).status).toBe(404);
    expect((await adminB.get(`/api/admin/timetable?teacherId=${A.teachers.Jean}`)).status).toBe(404);
    expect((await xhr(adminB.put(`/api/admin/timetable/${entryId}`)).send({ room: "Piratée" })).status).toBe(404);
    expect((await xhr(adminB.delete(`/api/admin/timetable/${entryId}`))).status).toBe(404);
    // Créer un créneau B avec des références A est refusé
    expect((await xhr(adminB.post("/api/admin/timetable")).send(slot({ classId: classB }))).status).toBe(404);
    expect((await xhr(adminB.post(`/api/students/${A.students.koffi}/account`))).status).toBe(404);
    // Côté élève : une classe d'une autre école est introuvable
    expect((await koffiStudent.get(`/api/student/classes/${classB}/timetable`)).status).toBe(404);
    expect((await prisma.timetableEntry.findUniqueOrThrow({ where: { id: entryId } })).room).toBe("Salle 4");
  });

  it("supprimer un élève supprime son compte ; un enseignant ayant saisi des notes n'est pas supprimable", async () => {
    const marc = await prisma.student.findUniqueOrThrow({ where: { id: A.students.marc } });
    expect((await xhr(adminA.delete(`/api/students/${A.students.marc}`))).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: marc.userId! } })).toBeNull();
    expect((await marcStudent.get("/api/student/me")).status).toBe(401);
    const del = await xhr(adminA.delete(`/api/teachers/${A.teachers.Jean}`));
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("TEACHER_HAS_HISTORY");
  });
});
