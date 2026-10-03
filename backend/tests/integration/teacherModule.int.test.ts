/**
 * Test d'intégration du module enseignants sur une VRAIE base PostgreSQL (aucun mock).
 *
 * Lancement : npm run test:integration
 * (DATABASE_URL doit pointer vers une base dont le nom se termine par "_test" : elle est vidée.)
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Test } from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import * as XLSX from "xlsx";
import { buildScannedPdf, buildTablePdf } from "../helpers/pdf.js";

const dbUrl = process.env.DATABASE_URL ?? "";
const enabled = /_test(\?|$)/.test(dbUrl.split("/").pop() ?? "");

type Agent = InstanceType<typeof TestAgent>;

// Les requêtes mutantes authentifiées par cookie doivent porter l'en-tête anti-CSRF
const xhr = (t: Test) => t.set("X-Requested-With", "XMLHttpRequest");

function xlsxBuffer(rows: Array<Record<string, string>>) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Enseignants");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe.skipIf(!enabled)("Module enseignants — workflow complet sur PostgreSQL", () => {
  let app: Parameters<typeof request>[0];
  let prisma: typeof import("../../src/config/database.js").prisma;
  let year: string;
  let adminA: Agent;
  let adminB: Agent;
  const classes: Record<string, string> = {};
  const students: Record<string, string> = {};
  const teachers: Record<string, string> = {};
  const creds: Record<string, { username: string; temporaryPassword: string }> = {};
  let jeanCourseId = "";

  async function registerSchool(agent: Agent, suffix: string) {
    const res = await agent.post("/api/auth/register-school").send({
      schoolName: `Lycée ${suffix}`,
      adminFirstName: "Admin",
      adminLastName: suffix,
      adminEmail: `admin-${suffix.toLowerCase()}@test.ci`,
      adminPassword: "AdminPass123",
    });
    expect(res.status).toBe(201);
  }

  async function teacherLogin(identifier: string, password: string) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ identifier, password });
    return { agent, res };
  }

  async function loginAndChangePassword(name: string, newPassword: string) {
    const { agent, res } = await teacherLogin(creds[name].username, creds[name].temporaryPassword);
    expect(res.status).toBe(200);
    const change = await xhr(agent.post("/api/auth/change-password")).send({
      currentPassword: creds[name].temporaryPassword,
      newPassword,
    });
    expect(change.status).toBe(200);
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
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("l'établissement crée son compte, ses classes et ses étudiants", async () => {
    await registerSchool(adminA, "ALPHA");
    for (const name of ["L1 Réseaux A", "L1 Réseaux B", "L2 Informatique"]) {
      const res = await xhr(adminA.post("/api/classes")).send({ name, academicYear: year });
      expect(res.status).toBe(201);
      classes[name] = res.body.data.id;
    }
    const people = [
      { key: "awa", firstName: "Awa", lastName: "BAMBA", classId: classes["L1 Réseaux A"], parentPhone: "0701020304" },
      { key: "koffi", firstName: "Koffi", lastName: "N'GUESSAN", classId: classes["L1 Réseaux A"], parentPhone: "0501020304" },
      { key: "marc", firstName: "Marc", lastName: "ZADI", classId: classes["L1 Réseaux B"], parentPhone: "0101020304" },
    ];
    for (const p of people) {
      const res = await xhr(adminA.post("/api/students")).send({ ...p, phone: p.parentPhone });
      expect(res.status).toBe(201);
      students[p.key] = res.body.data.id;
    }
  });

  it("un tableau vide ne montre aucun enseignant fictif", async () => {
    const res = await adminA.get("/api/teachers");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("prévisualise un import Excel : colonnes dans le désordre, variantes d'en-têtes, doublons et erreurs", async () => {
    const file = xlsxBuffer([
      { Discipline: "Mathématiques", NOM: "KOUASSI", Prenom: "Jean", Classe: "L1 Réseaux A", "Téléphone": "0707070707", "E-mail": "jean.kouassi@ecole.ci" },
      { Discipline: "Mathématiques", NOM: "KOUASSI", Prenom: "Jean", Classe: "L1 Réseaux B", "Téléphone": "0707070707", "E-mail": "jean.kouassi@ecole.ci" },
      { Discipline: "Français", NOM: "TRAORÉ", Prenom: "Aminata", Classe: "", "Téléphone": "0505050505", "E-mail": "" },
      { Discipline: "Informatique", NOM: "YAO", Prenom: "Serge", Classe: "", "Téléphone": "", "E-mail": "" },
      { Discipline: "Physique", NOM: "", Prenom: "Inconnu", Classe: "", "Téléphone": "123", "E-mail": "" },
      { Discipline: "Mathématiques", NOM: "KOUASSI", Prenom: "Jean", Classe: "L1 Réseaux A", "Téléphone": "0707070707", "E-mail": "jean.kouassi@ecole.ci" },
    ]);
    const res = await xhr(adminA.post("/api/teachers/import/preview")).attach("file", file, "enseignants.xlsx");
    expect(res.status).toBe(200);
    const { summary, rows } = res.body.data;
    expect(summary).toMatchObject({ total: 6, errors: 1, teachersToCreate: 3, subjectsToCreate: 3, assignmentsDetected: 2 });
    expect(rows[3].status).toBe("WARNING"); // Serge : téléphone manquant
    expect(rows[4].status).toBe("ERROR");
    expect(rows[4].issues.map((i: { field: string }) => i.field)).toEqual(expect.arrayContaining(["lastName", "phone"]));
    expect(rows[5].status).toBe("DUPLICATE");
    expect(rows[0].class).toMatchObject({ id: classes["L1 Réseaux A"] });

    // Le serveur revalide : impossible de confirmer tant qu'une erreur bloquante subsiste
    const blocked = await xhr(adminA.post("/api/teachers/import/confirm")).send({ rows: rows.map((r: { line: number; values: unknown }) => ({ line: r.line, values: r.values })) });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.code).toBe("IMPORT_HAS_ERRORS");

    // L'administrateur corrige la ligne en erreur
    const corrected = rows.map((r: { line: number; values: Record<string, string> }) =>
      r.line === rows[4].line ? { line: r.line, values: { ...r.values, lastName: "KONAN", phone: "0708080808" } } : { line: r.line, values: r.values },
    );
    const ok = await xhr(adminA.post("/api/teachers/import/confirm")).send({ rows: corrected });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ teachersCreated: 4, subjectsCreated: 4, assignmentsCreated: 2, duplicatesSkipped: 1 });

    const list = await adminA.get("/api/teachers");
    for (const t of list.body.data) teachers[t.firstName] = t.id;
    expect(Object.keys(teachers).sort()).toEqual(["Aminata", "Inconnu", "Jean", "Serge"]);
    const jean = list.body.data.find((t: { firstName: string }) => t.firstName === "Jean");
    expect(jean).toMatchObject({ lastName: "KOUASSI", phone: "+225707070707", account: null, assignmentCount: 2 });
  });

  it("analyse un vrai PDF texte et reconnaît les enseignants déjà enregistrés", async () => {
    const pdf = buildTablePdf([
      ["Liste des enseignants"],
      ["Nom", "Prénom", "Matière", "Téléphone"],
      ["KONE", "Paul", "Physique", "0709090909"],
      ["TRAORÉ", "Aminata", "Français", "0505050505"],
      ["DIALLO", "Fatou", "", "0102030405"],
    ]);
    const res = await xhr(adminA.post("/api/teachers/import/preview")).attach("file", pdf, "liste.pdf");
    expect(res.status).toBe(200);
    expect(res.body.data.fileType).toBe("PDF");
    const rows = res.body.data.rows;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ status: "VALID", values: { lastName: "KONE", firstName: "Paul", subject: "Physique" } });
    expect(rows[1]).toMatchObject({ status: "EXISTING", existingTeacherId: teachers.Aminata });
    // Cellule vide : les colonnes suivantes ne sont pas décalées
    expect(rows[2]).toMatchObject({ status: "WARNING", values: { lastName: "DIALLO", subject: "", phone: "0102030405" } });
  });

  it("lit un PDF scanné par OCR sans rien inventer", { timeout: 180_000 }, async () => {
    const pdf = await buildScannedPdf([
      ["Nom", "Prénom", "Matière", "Téléphone"],
      ["KONE", "Paul", "Physique", "0709090909"],
      ["DIALLO", "Fatou", "", "0102030405"],
    ]);
    const res = await xhr(adminA.post("/api/teachers/import/preview")).attach("file", pdf, "scan.pdf");
    expect(res.status).toBe(200);
    expect(res.body.data.fileType).toBe("PDF_OCR");
    expect(res.body.data.ocrConfidence).toBeGreaterThan(60);
    const rows = res.body.data.rows;
    expect(rows.map((r: { values: { lastName: string } }) => r.values.lastName)).toEqual(["KONE", "DIALLO"]);
    expect(rows[1].values.subject).toBe("");
  });

  it("refuse un faux fichier (contenu ne correspondant pas à l'extension)", async () => {
    const res = await xhr(adminA.post("/api/teachers/import/preview")).attach("file", Buffer.from("MZ fake executable"), "piege.xlsx");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_FILE");
  });

  it("crée les comptes en lot avec des identifiants uniques et des mots de passe temporaires", async () => {
    const res = await xhr(adminA.post("/api/teachers/accounts")).send({});
    expect(res.status).toBe(201);
    for (const c of res.body.data.created) creds[c.fullName.split(" ")[0]] = c;
    expect(creds.Jean.username).toBe("jean.kouassi");
    expect(creds.Aminata.username).toBe("aminata.traore");
    expect(creds.Jean.temporaryPassword).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12}$/);

    // Jamais de second compte pour un enseignant qui en a déjà un
    const again = await xhr(adminA.post(`/api/teachers/${teachers.Jean}/account`)).send({});
    expect(again.status).toBe(409);

    // Le mot de passe n'est stocké que haché
    const user = await prisma.user.findUnique({ where: { username: "jean.kouassi" } });
    expect(user?.passwordHash).not.toContain(creds.Jean.temporaryPassword);
    expect(user?.mustChangePassword).toBe(true);
  });

  it("un homonyme dans une autre école reçoit un identifiant distinct", async () => {
    await registerSchool(adminB, "BETA");
    const created = await xhr(adminB.post("/api/teachers")).send({ firstName: "Jean", lastName: "Kouassi" });
    expect(created.status).toBe(201);
    teachers.JeanB = created.body.data.id;
    const acc = await xhr(adminB.post(`/api/teachers/${teachers.JeanB}/account`)).send({});
    expect(acc.body.data.username).toBe("jean.kouassi2");
  });

  it("impose le changement du mot de passe temporaire à la première connexion", async () => {
    const { agent, res } = await teacherLogin("jean.kouassi", creds.Jean.temporaryPassword);
    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(true);

    const blocked = await agent.get("/api/teacher/me");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const weak = await xhr(agent.post("/api/auth/change-password")).send({ currentPassword: creds.Jean.temporaryPassword, newPassword: "faible" });
    expect(weak.status).toBe(400);

    const changed = await xhr(agent.post("/api/auth/change-password")).send({
      currentPassword: creds.Jean.temporaryPassword,
      newPassword: "JeanSecure2026",
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.user.mustChangePassword).toBe(false);

    const me = await agent.get("/api/teacher/me");
    expect(me.status).toBe(200);
    expect(me.body.data.assignments).toHaveLength(2);

    const old = await teacherLogin("jean.kouassi", creds.Jean.temporaryPassword);
    expect(old.res.status).toBe(401);
  });

  it("l'enseignant ne voit que ses affectations et n'accède à rien d'administratif", async () => {
    const jean = (await teacherLogin("jean.kouassi", "JeanSecure2026")).agent;
    const cls = await jean.get("/api/teacher/classes");
    expect(cls.body.data.map((c: { name: string }) => c.name).sort()).toEqual(["L1 Réseaux A", "L1 Réseaux B"]);

    expect((await jean.get(`/api/teacher/classes/${classes["L2 Informatique"]}/students`)).status).toBe(403);
    expect((await jean.get(`/api/teacher/attendance?classId=${classes["L2 Informatique"]}`)).status).toBe(403);
    for (const url of ["/api/classes", "/api/students", "/api/teachers", "/api/dashboard/stats", "/api/notifications", "/api/courses", "/api/subjects"]) {
      expect((await jean.get(url)).status, url).toBe(403);
    }
    expect((await xhr(jean.post("/api/teachers")).send({ firstName: "Pirate", lastName: "TEST" })).status).toBe(403);
  });

  it("affectation par lot : plusieurs classes d'un coup, sans doublon", async () => {
    const subjects = await adminA.get("/api/subjects");
    const francais = subjects.body.data.find((s: { name: string }) => s.name === "Français");
    const body = {
      academicYear: year,
      items: [
        { subjectId: francais.id, classId: classes["L2 Informatique"] },
        { subjectId: francais.id, classId: classes["L1 Réseaux B"] },
      ],
    };
    const first = await xhr(adminA.post(`/api/teachers/${teachers.Aminata}/assignments`)).send(body);
    expect(first.body.data).toEqual({ created: 2, skipped: 0 });
    const second = await xhr(adminA.post(`/api/teachers/${teachers.Aminata}/assignments`)).send(body);
    expect(second.body.data).toEqual({ created: 0, skipped: 2 });

    // Isolation : une école ne peut pas affecter les classes d'une autre
    const foreign = await xhr(adminB.post(`/api/teachers/${teachers.JeanB}/assignments`)).send({
      academicYear: year,
      items: [{ subjectId: francais.id, classId: classes["L1 Réseaux A"] }],
    });
    expect(foreign.status).toBe(404);
  });

  it("l'enseignant fait l'appel : séance créée côté serveur, présences en base, SMS en file", async () => {
    const jean = (await teacherLogin("jean.kouassi", "JeanSecure2026")).agent;
    const me = await jean.get("/api/teacher/me");
    const maths1A = me.body.data.assignments.find((a: { class: { name: string } }) => a.class.name === "L1 Réseaux A");

    const sheet = await jean.get(`/api/teacher/attendance/sheet?assignmentId=${maths1A.id}`);
    expect(sheet.status).toBe(200);
    expect(sheet.body.data.students.map((s: { firstName: string }) => s.firstName).sort()).toEqual(["Awa", "Koffi"]);

    // Un élève d'une autre classe est refusé
    const intruder = await xhr(jean.post("/api/teacher/attendance")).send({
      assignmentId: maths1A.id,
      records: [
        { studentId: students.awa, status: "PRESENT" },
        { studentId: students.koffi, status: "ABSENT" },
        { studentId: students.marc, status: "ABSENT" },
      ],
    });
    expect(intruder.status).toBe(400);

    const saved = await xhr(jean.post("/api/teacher/attendance")).send({
      assignmentId: maths1A.id,
      records: [
        { studentId: students.awa, status: "PRESENT" },
        { studentId: students.koffi, status: "ABSENT" },
      ],
    });
    expect(saved.status).toBe(201);
    expect(saved.body.data.counts).toMatchObject({ PRESENT: 1, ABSENT: 1, total: 2 });
    jeanCourseId = saved.body.data.courseId;

    const course = await prisma.course.findUnique({ where: { id: jeanCourseId } });
    expect(course).toMatchObject({ assignmentId: maths1A.id, subject: "Mathématiques", classId: classes["L1 Réseaux A"] });
    expect(course?.startTime).toMatch(/^\d{2}:\d{2}$/);

    const sms = await prisma.smsLog.findMany({ where: { attendance: { courseId: jeanCourseId } } });
    expect(sms).toHaveLength(1);
    expect(sms[0]).toMatchObject({ studentId: students.koffi, recipient: "+225501020304" });
    expect(["PENDING", "SENT", "FAILED", "RETRY_EXHAUSTED"]).toContain(sms[0].status);

    // Aucune séance ne reste créée après un appel refusé
    expect(await prisma.course.count({ where: { assignmentId: maths1A.id } })).toBe(1);
  });

  it("un enseignant ne peut ni lire ni modifier l'appel d'un collègue", async () => {
    const aminata = await loginAndChangePassword("Aminata", "AminataSecure26");
    expect((await aminata.get(`/api/teacher/attendance/${jeanCourseId}`)).status).toBe(403);
    const write = await xhr(aminata.post("/api/teacher/attendance")).send({
      courseId: jeanCourseId,
      records: [{ studentId: students.koffi, status: "PRESENT" }],
    });
    expect(write.status).toBe(403);
    const hist = await aminata.get("/api/teacher/attendance");
    expect(hist.body.data).toEqual([]);

    // Un enseignant d'une autre école ne voit même pas le cours
    const jeanBPass = (await xhr(adminB.post(`/api/teachers/${teachers.JeanB}/reset-password`)).send({})).body.data.temporaryPassword;
    const jeanB = (await teacherLogin("jean.kouassi2", jeanBPass)).agent;
    await xhr(jeanB.post("/api/auth/change-password")).send({ currentPassword: jeanBPass, newPassword: "JeanBSecure26" });
    expect((await jeanB.get(`/api/teacher/attendance/${jeanCourseId}`)).status).toBe(404);
  });

  it("l'historique de l'enseignant ne montre que ses propres appels", async () => {
    const jean = (await teacherLogin("jean.kouassi", "JeanSecure2026")).agent;
    const hist = await jean.get("/api/teacher/attendance");
    expect(hist.body.data).toHaveLength(1);
    expect(hist.body.data[0]).toMatchObject({ id: jeanCourseId, className: "L1 Réseaux A", counts: { ABSENT: 1, PRESENT: 1 } });
    const absentOnly = await jean.get("/api/teacher/attendance?status=LATE");
    expect(absentOnly.body.data).toHaveLength(0);
  });

  it("un cours planifié par l'administration apparaît dans « Mes cours »", async () => {
    const all = await adminA.get(`/api/assignments?classId=${classes["L1 Réseaux B"]}`);
    const maths1B = all.body.data.find((a: { subject: { name: string } }) => a.subject.name === "Mathématiques");
    const { businessNow } = await import("../../src/utils/businessTime.js");
    const created = await xhr(adminA.post("/api/courses")).send({
      assignmentId: maths1B.id,
      date: businessNow().date,
      startTime: "10:00",
      endTime: "12:00",
    });
    expect(created.status).toBe(201);
    const jean = (await teacherLogin("jean.kouassi", "JeanSecure2026")).agent;
    const courses = await jean.get("/api/teacher/courses");
    expect(courses.body.data.map((c: { id: string }) => c.id)).toContain(created.body.data.id);
    const dash = await jean.get("/api/teacher/dashboard");
    expect(dash.body.data).toMatchObject({ classes: 2, coursesToday: 2, callsPending: 1, absencesToday: 1 });
  });

  it("un compte désactivé ne peut plus se connecter ni utiliser sa session", async () => {
    const jean = (await teacherLogin("jean.kouassi", "JeanSecure2026")).agent;
    const off = await xhr(adminA.patch(`/api/teachers/${teachers.Jean}/account-status`)).send({ isActive: false });
    expect(off.status).toBe(200);
    expect((await jean.get("/api/teacher/me")).status).toBe(403);
    expect((await teacherLogin("jean.kouassi", "JeanSecure2026")).res.status).toBe(403);

    await xhr(adminA.patch(`/api/teachers/${teachers.Jean}/account-status`)).send({ isActive: true });
    expect((await teacherLogin("jean.kouassi", "JeanSecure2026")).res.status).toBe(200);
  });

  it("la réinitialisation invalide l'ancien mot de passe et redemande un changement", async () => {
    const reset = await xhr(adminA.post(`/api/teachers/${teachers.Aminata}/reset-password`)).send({});
    expect(reset.status).toBe(200);
    expect((await teacherLogin("aminata.traore", "AminataSecure26")).res.status).toBe(401);
    const fresh = await teacherLogin("aminata.traore", reset.body.data.temporaryPassword);
    expect(fresh.res.body.data.user.mustChangePassword).toBe(true);
  });

  it("isolation entre établissements côté administration", async () => {
    expect((await adminB.get(`/api/teachers/${teachers.Jean}`)).status).toBe(404);
    expect((await xhr(adminB.post(`/api/teachers/${teachers.Jean}/reset-password`)).send({})).status).toBe(404);
    const listB = await adminB.get("/api/teachers");
    expect(listB.body.data.map((t: { id: string }) => t.id)).toEqual([teachers.JeanB]);
  });

  it("un enseignant avec un historique ne peut pas être supprimé (traçabilité)", async () => {
    const del = await xhr(adminA.delete(`/api/teachers/${teachers.Jean}`));
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("TEACHER_HAS_HISTORY");
  });

  it("statistiques enseignants de l'administration", async () => {
    const stats = await adminA.get("/api/teachers/stats");
    expect(stats.body.data).toMatchObject({ total: 4, withoutAccount: 0, activeAccounts: 4, disabledAccounts: 0 });
  });
});
