import { prisma } from "../config/database.js";
import { AppError, forbidden } from "../utils/errors.js";
import { validatePhone } from "../utils/phone.js";
import { assertFileSignature } from "../utils/fileSignature.js";
import { currentAcademicYear } from "../utils/businessTime.js";
import { extractTable, mapTable, normalizeHeader } from "./import/tabular.js";
import { normalizeTeacherInput } from "./teacher.service.js";
import { cleanSubjectName } from "./subject.service.js";

function scope(schoolId: string | null) {
  if (!schoolId) throw forbidden("Aucune école associée à ce compte");
  return schoolId;
}

export const TEACHER_FIELDS = ["lastName", "firstName", "subject", "className", "phone", "email", "employeeNumber"] as const;
export type TeacherField = (typeof TEACHER_FIELDS)[number];
export type TeacherRowValues = Partial<Record<TeacherField, string>>;

const TEACHER_ALIASES: Record<TeacherField, string[]> = {
  lastName: ["nom", "noms", "nom de famille", "last name", "lastname", "surname", "family name", "nom enseignant", "nom du professeur"],
  firstName: ["prenom", "prenoms", "first name", "firstname", "given name", "prenom enseignant"],
  subject: ["matiere", "matieres", "subject", "discipline", "disciplines", "module", "enseignement", "specialite", "cours"],
  className: ["classe", "classes", "class", "groupe", "filiere", "niveau"],
  phone: ["telephone", "tel", "contact", "phone", "mobile", "portable", "cel", "cellulaire", "numero de telephone"],
  email: ["email", "e mail", "courriel", "mail", "adresse email", "adresse mail"],
  employeeNumber: [
    "matricule",
    "matricule enseignant",
    "numero matricule",
    "employee number",
    "employee id",
    "id enseignant",
    "code enseignant",
    "numero employe",
  ],
};

const MAX_ROWS = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RowStatus = "VALID" | "WARNING" | "EXISTING" | "DUPLICATE" | "ERROR";

export interface RowIssue {
  field: TeacherField | null;
  message: string;
  blocking: boolean;
}

export interface AnalyzedRow {
  line: number;
  values: TeacherRowValues;
  status: RowStatus;
  issues: RowIssue[];
  existingTeacherId: string | null;
  subject: { id: string | null; name: string } | null;
  class: { id: string; name: string; academicYear: string } | null;
}

interface SchoolContext {
  teachers: Array<{ id: string; firstName: string; lastName: string; email: string | null; employeeNumber: string | null }>;
  subjects: Map<string, { id: string; name: string }>;
  classes: Map<string, Array<{ id: string; name: string; academicYear: string }>>;
  assignments: Set<string>;
}

const key = (s: string) => normalizeHeader(s);

async function loadSchoolContext(sid: string): Promise<SchoolContext> {
  const [teachers, subjects, classes, assignments] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId: sid },
      select: { id: true, firstName: true, lastName: true, email: true, employeeNumber: true },
    }),
    prisma.subject.findMany({ where: { schoolId: sid }, select: { id: true, name: true } }),
    prisma.class.findMany({ where: { schoolId: sid }, select: { id: true, name: true, academicYear: true } }),
    prisma.teachingAssignment.findMany({
      where: { schoolId: sid },
      select: { teacherId: true, subjectId: true, classId: true, academicYear: true },
    }),
  ]);
  const classMap = new Map<string, Array<{ id: string; name: string; academicYear: string }>>();
  for (const c of classes) classMap.set(key(c.name), [...(classMap.get(key(c.name)) ?? []), c]);
  return {
    teachers,
    subjects: new Map(subjects.map((s) => [key(s.name), s])),
    classes: classMap,
    assignments: new Set(assignments.map((a) => `${a.teacherId}|${a.subjectId}|${a.classId}|${a.academicYear}`)),
  };
}

/** Une classe peut exister sur plusieurs années : on privilégie l'année en cours, sinon la plus récente */
function pickClass(ctx: SchoolContext, name: string) {
  const found = ctx.classes.get(key(name));
  if (!found || found.length === 0) return null;
  const current = currentAcademicYear();
  return found.find((c) => c.academicYear === current) ?? [...found].sort((a, b) => b.academicYear.localeCompare(a.academicYear))[0];
}

function personKey(v: { firstName: string; lastName: string; email: string | null; employeeNumber: string | null }) {
  if (v.employeeNumber) return `mat:${v.employeeNumber}`;
  if (v.email) return `mail:${v.email}`;
  return `nom:${key(v.lastName)}|${key(v.firstName)}`;
}

function findExisting(ctx: SchoolContext, v: { firstName: string; lastName: string; email: string | null; employeeNumber: string | null }) {
  return (
    (v.employeeNumber && ctx.teachers.find((t) => t.employeeNumber === v.employeeNumber)) ||
    (v.email && ctx.teachers.find((t) => t.email === v.email)) ||
    ctx.teachers.find((t) => key(t.lastName) === key(v.lastName) && key(t.firstName) === key(v.firstName)) ||
    null
  );
}

/**
 * Validation complète d'un lot de lignes. Utilisée pour la prévisualisation ET rejouée côté
 * serveur à la confirmation : les corrections envoyées par le navigateur ne sont jamais crues sur parole.
 */
function analyzeRows(
  rows: Array<{ line: number; values: TeacherRowValues; uncertain?: string[] }>,
  ctx: SchoolContext,
): AnalyzedRow[] {
  const seen = new Map<string, number>();
  return rows.map(({ line, values: raw, uncertain = [] }) => {
    const values: TeacherRowValues = Object.fromEntries(TEACHER_FIELDS.map((f) => [f, (raw[f] ?? "").trim()]));
    const issues: RowIssue[] = [];
    const block = (field: TeacherField | null, message: string) => issues.push({ field, message, blocking: true });
    const warn = (field: TeacherField | null, message: string) => issues.push({ field, message, blocking: false });

    for (const f of uncertain) {
      if (TEACHER_FIELDS.includes(f as TeacherField)) warn(f as TeacherField, "Lecture OCR incertaine : vérifiez cette valeur");
    }
    if (!values.lastName) block("lastName", "Nom manquant");
    else if (values.lastName.length < 2 || values.lastName.length > 80) block("lastName", "Nom invalide (2 à 80 caractères)");
    if (!values.firstName) block("firstName", "Prénom manquant");
    else if (values.firstName.length < 2 || values.firstName.length > 80) block("firstName", "Prénom invalide (2 à 80 caractères)");
    if (values.phone && !validatePhone(values.phone)) block("phone", "Numéro de téléphone invalide");
    if (!values.phone) warn("phone", "Téléphone non renseigné");
    if (values.email && !EMAIL_RE.test(values.email)) block("email", "Adresse email invalide");
    if (values.subject && values.subject.length > 120) block("subject", "Nom de matière trop long");
    if (!values.subject) warn("subject", "Matière non renseignée : aucune affectation ne sera créée");

    const norm = normalizeTeacherInput({
      firstName: values.firstName ?? "",
      lastName: values.lastName ?? "",
      email: values.email,
      employeeNumber: values.employeeNumber,
      phone: values.phone,
    });

    const subjectName = values.subject ? cleanSubjectName(values.subject) : null;
    const subject = subjectName ? { id: ctx.subjects.get(key(subjectName))?.id ?? null, name: subjectName } : null;

    let cls: AnalyzedRow["class"] = null;
    if (values.className) {
      cls = pickClass(ctx, values.className);
      if (!cls) warn("className", `Classe « ${values.className} » introuvable dans l'établissement : affectation non créée`);
      else if (!subject) warn("className", "Classe indiquée sans matière : affectation non créée");
    }

    const existing = norm.lastName && norm.firstName ? findExisting(ctx, norm) : null;
    const dupKey = `${personKey(norm)}|${subjectName ? key(subjectName) : ""}|${cls?.id ?? key(values.className ?? "")}`;
    const firstLine = seen.get(dupKey);
    let status: RowStatus;
    if (issues.some((i) => i.blocking)) status = "ERROR";
    else if (firstLine !== undefined) {
      status = "DUPLICATE";
      warn(null, `Ligne en double (identique à la ligne ${firstLine}) : ignorée`);
    } else if (existing) {
      status = "EXISTING";
      const alreadyAssigned =
        subject?.id && cls && ctx.assignments.has(`${existing.id}|${subject.id}|${cls.id}|${cls.academicYear}`);
      warn(
        null,
        alreadyAssigned
          ? `Déjà enregistré (${existing.firstName} ${existing.lastName}) avec cette affectation : rien à ajouter`
          : `Déjà enregistré (${existing.firstName} ${existing.lastName}) : la fiche existante sera complétée`,
      );
    } else status = issues.length > 0 ? "WARNING" : "VALID";
    if (status !== "ERROR" && firstLine === undefined) seen.set(dupKey, line);

    return { line, values, status, issues, existingTeacherId: existing?.id ?? null, subject, class: cls };
  });
}

function summarize(rows: AnalyzedRow[]) {
  const count = (s: RowStatus) => rows.filter((r) => r.status === s).length;
  const importable = rows.filter((r) => r.status !== "ERROR" && r.status !== "DUPLICATE");
  const newPeople = new Set(
    importable
      .filter((r) => !r.existingTeacherId)
      .map((r) =>
        personKey(
          normalizeTeacherInput({
            firstName: r.values.firstName ?? "",
            lastName: r.values.lastName ?? "",
            email: r.values.email,
            employeeNumber: r.values.employeeNumber,
          }),
        ),
      ),
  );
  const newSubjects = new Set(importable.filter((r) => r.subject && !r.subject.id).map((r) => key(r.subject!.name)));
  return {
    total: rows.length,
    valid: count("VALID") + count("WARNING"),
    warnings: count("WARNING"),
    existing: count("EXISTING"),
    duplicates: count("DUPLICATE") + count("EXISTING"),
    errors: count("ERROR"),
    teachersToCreate: newPeople.size,
    subjectsToCreate: newSubjects.size,
    assignmentsDetected: importable.filter((r) => r.subject && r.class).length,
  };
}

export const teacherImportService = {
  async preview(buffer: Buffer, fileName: string, schoolId: string | null) {
    const sid = scope(schoolId);
    if (!buffer?.length) throw new AppError(400, "Fichier manquant ou vide", "FILE_EMPTY");
    assertFileSignature(buffer, fileName);
    const table = await extractTable(buffer, fileName);
    const mapped = mapTable(table, TEACHER_ALIASES, ["lastName", "firstName"]);
    if (mapped.missingRequired.length > 0) {
      throw new AppError(
        400,
        "Colonnes « Nom » et « Prénom » introuvables. Le fichier doit contenir une ligne d'en-tête (Nom, Prénom, Matière, Téléphone…).",
        "COLUMNS_NOT_FOUND",
      );
    }
    if (mapped.rows.length === 0) throw new AppError(400, "Aucun enseignant détecté dans ce fichier.", "NO_DATA_EXTRACTED");
    if (mapped.rows.length > MAX_ROWS) throw new AppError(400, `Trop de lignes (maximum ${MAX_ROWS} par import).`, "TOO_MANY_ROWS");

    const rows = analyzeRows(mapped.rows, await loadSchoolContext(sid));
    return {
      fileName,
      fileType: table.source,
      ocrConfidence: table.ocrConfidence ?? null,
      columns: mapped.columns,
      summary: summarize(rows),
      rows,
    };
  },

  /** Réanalyse sans fichier : utilisée quand l'administrateur corrige des lignes */
  async revalidate(rows: Array<{ line: number; values: TeacherRowValues }>, schoolId: string | null) {
    const analyzed = analyzeRows(rows, await loadSchoolContext(scope(schoolId)));
    return { summary: summarize(analyzed), rows: analyzed };
  },

  async confirm(rows: Array<{ line: number; values: TeacherRowValues }>, schoolId: string | null) {
    const sid = scope(schoolId);
    const analyzed = analyzeRows(rows, await loadSchoolContext(sid));
    const errors = analyzed.filter((r) => r.status === "ERROR");
    if (errors.length > 0) {
      throw new AppError(
        400,
        `Import impossible : ${errors.length} ligne(s) contiennent encore des erreurs (lignes ${errors
          .slice(0, 10)
          .map((r) => r.line)
          .join(", ")}${errors.length > 10 ? "…" : ""}).`,
        "IMPORT_HAS_ERRORS",
      );
    }
    const importable = analyzed.filter((r) => r.status !== "DUPLICATE");

    return prisma.$transaction(
      async (tx) => {
        const subjectIds = new Map<string, string>();
        const teacherIds = new Map<string, string>();
        const createdTeacherIds: string[] = [];
        let subjectsCreated = 0;
        let teachersUpdated = 0;
        const assignmentData: Array<{ schoolId: string; teacherId: string; subjectId: string; classId: string; academicYear: string }> = [];

        for (const r of importable) {
          const norm = normalizeTeacherInput({
            firstName: r.values.firstName!,
            lastName: r.values.lastName!,
            phone: r.values.phone,
            email: r.values.email,
            employeeNumber: r.values.employeeNumber,
          });

          // Matière : réutilisée si elle existe, créée à partir du fichier sinon
          let subjectId: string | null = null;
          if (r.subject) {
            const k = key(r.subject.name);
            subjectId = r.subject.id ?? subjectIds.get(k) ?? null;
            if (!subjectId) {
              subjectId = (await tx.subject.create({ data: { schoolId: sid, name: r.subject.name } })).id;
              subjectsCreated++;
            }
            subjectIds.set(k, subjectId);
          }

          // Enseignant : une seule fiche par personne, même s'il apparaît sur plusieurs lignes
          const pk = personKey(norm);
          let teacherId = r.existingTeacherId ?? teacherIds.get(pk) ?? null;
          if (!teacherId) {
            teacherId = (await tx.teacher.create({ data: { schoolId: sid, ...norm } })).id;
            createdTeacherIds.push(teacherId);
          } else if (r.existingTeacherId && !teacherIds.has(pk)) {
            // Complète la fiche existante sans écraser ce qui est déjà renseigné
            const current = await tx.teacher.findUnique({ where: { id: teacherId } });
            const patch = {
              ...(!current?.phone && norm.phone ? { phone: norm.phone } : {}),
              ...(!current?.email && norm.email ? { email: norm.email } : {}),
              ...(!current?.employeeNumber && norm.employeeNumber ? { employeeNumber: norm.employeeNumber } : {}),
            };
            if (Object.keys(patch).length > 0) {
              await tx.teacher.update({ where: { id: teacherId }, data: patch });
              teachersUpdated++;
            }
          }
          teacherIds.set(pk, teacherId);

          if (subjectId && r.class) {
            assignmentData.push({ schoolId: sid, teacherId, subjectId, classId: r.class.id, academicYear: r.class.academicYear });
          }
        }

        const assignments = assignmentData.length
          ? await tx.teachingAssignment.createMany({ data: assignmentData, skipDuplicates: true })
          : { count: 0 };

        return {
          teachersCreated: createdTeacherIds.length,
          teachersUpdated,
          subjectsCreated,
          assignmentsCreated: assignments.count,
          duplicatesSkipped: analyzed.length - importable.length,
          createdTeacherIds,
        };
      },
      { timeout: 120_000 },
    );
  },
};
