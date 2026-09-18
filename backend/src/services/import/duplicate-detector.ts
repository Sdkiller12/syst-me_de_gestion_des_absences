import { prisma } from "../../config/database.js";
import type { ValidatedStudentRow } from "./validator.js";

export async function detectDuplicates(
  rows: ValidatedStudentRow[],
  schoolId: string,
  classId?: string
): Promise<ValidatedStudentRow[]> {
  const seenStudentNumbers = new Map<string, number>(); // studentNumber -> lineIndex
  const seenNameKeys = new Map<string, number>();       // nameKey -> lineIndex

  // Step 1: Internal file duplicate check
  for (const row of rows) {
    const { studentNumber, lastName, firstName } = row.data;

    // Check student number duplicate within file
    if (studentNumber) {
      const existingLine = seenStudentNumbers.get(studentNumber);
      if (existingLine !== undefined) {
        row.isDuplicateInternal = true;
        row.status = "DUPLICATE";
        row.errors.push(`Doublon dans le fichier (Matricule ${studentNumber} déjà présent ligne ${existingLine})`);
        row.duplicateInfo = `Matricule ${studentNumber} présent plusieurs fois`;
      } else {
        seenStudentNumbers.set(studentNumber, row.lineIndex);
      }
    }

    // Check (lastName, firstName) duplicate within file
    if (lastName && firstName) {
      const nameKey = `${lastName.toLowerCase()}|${firstName.toLowerCase()}`;
      const existingLine = seenNameKeys.get(nameKey);
      if (existingLine !== undefined) {
        row.isDuplicateInternal = true;
        row.status = "DUPLICATE";
        row.errors.push(`Doublon dans le fichier (Nom et prénom identiques à la ligne ${existingLine})`);
        if (!row.duplicateInfo) row.duplicateInfo = `Nom & prénom identiques à la ligne ${existingLine}`;
      } else {
        seenNameKeys.set(nameKey, row.lineIndex);
      }
    }
  }

  // Step 2: PostgreSQL Database duplicate check
  // Fetch existing students in school
  const studentNumbersInFile = Array.from(seenStudentNumbers.keys());
  const existingDbStudentsByNum = studentNumbersInFile.length > 0
    ? await prisma.student.findMany({
        where: { schoolId, studentNumber: { in: studentNumbersInFile } },
        select: { id: true, studentNumber: true, firstName: true, lastName: true, classId: true },
      })
    : [];

  const dbNumMap = new Map(existingDbStudentsByNum.map((s) => [s.studentNumber!, s]));

  // Also query by name within class if classId is supplied
  const existingClassStudentsByName = classId
    ? await prisma.student.findMany({
        where: { schoolId, classId },
        select: { id: true, studentNumber: true, firstName: true, lastName: true, classId: true },
      })
    : [];

  const dbNameMap = new Map(
    existingClassStudentsByName.map((s) => [
      `${s.lastName.toLowerCase()}|${s.firstName.toLowerCase()}`,
      s,
    ])
  );

  for (const row of rows) {
    const { studentNumber, lastName, firstName } = row.data;

    if (studentNumber && dbNumMap.has(studentNumber)) {
      const dbRecord = dbNumMap.get(studentNumber)!;
      row.isDuplicateDb = true;
      row.status = "DUPLICATE";
      row.duplicateInfo = `Matricule ${studentNumber} existe déjà dans la base (ID: ${dbRecord.id})`;
      if (!row.errors.some((e) => e.includes("Matricule déjà existant"))) {
        row.errors.push(`Matricule ${studentNumber} déjà existant dans la base de données`);
      }
    } else if (lastName && firstName) {
      const nameKey = `${lastName.toLowerCase()}|${firstName.toLowerCase()}`;
      if (dbNameMap.has(nameKey)) {
        const dbRecord = dbNameMap.get(nameKey)!;
        row.isDuplicateDb = true;
        row.status = "DUPLICATE";
        row.duplicateInfo = `Étudiant "${lastName} ${firstName}" existe déjà dans cette classe`;
        if (!row.errors.some((e) => e.includes("existe déjà dans la base"))) {
          row.errors.push(`Étudiant "${lastName} ${firstName}" déjà inscrit dans cette classe`);
        }
      }
    }
  }

  return rows;
}
