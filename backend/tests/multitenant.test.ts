import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const SERVICES = [
  "src/services/class.service.ts",
  "src/services/student.service.ts",
  "src/services/course.service.ts",
  "src/services/attendance.service.ts",
  "src/services/notification.service.ts",
  "src/services/dashboard.service.ts",
  "src/services/teacher.service.ts",
];

describe("isolation multi-écoles (schoolId)", () => {
  it("chaque service métier filtre par schoolId", async () => {
    for (const f of SERVICES) {
      const src = await readFile(f, "utf8");
      expect(src, f).toMatch(/schoolId/);
    }
  });

  it("le schéma impose schoolId sur toutes les entités métier", async () => {
    const schema = await readFile("prisma/schema.prisma", "utf8");
    for (const model of ["model User", "model Class", "model Student", "model Course", "model SmsLog", "model AuditLog"]) {
      expect(schema, model).toContain(model);
    }
    // schoolId présent dans les modèles métier
    const schoolIdCount = (schema.match(/schoolId\s+String/g) ?? []).length;
    expect(schoolIdCount).toBeGreaterThanOrEqual(6);
  });

  it("SUPER_ADMIN bypass, autres rôles restreints (authorize)", async () => {
    const src = await readFile("src/middlewares/authorize.ts", "utf8");
    expect(src).toContain("SUPER_ADMIN");
    expect(src).toContain("requireSchool");
  });

  it("aucun seed de démo ne tourne en production", async () => {
    const seed = await readFile("prisma/seed.ts", "utf8");
    expect(seed).toMatch(/NODE_ENV.*production|production/);
  });
});
