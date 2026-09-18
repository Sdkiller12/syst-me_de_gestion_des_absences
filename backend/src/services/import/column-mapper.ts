export interface StandardStudentRow {
  firstName: string;
  lastName: string;
  studentNumber?: string;
  phone?: string;
  parentPhone?: string;
  parentName?: string;
  email?: string;
  class?: string;
  [key: string]: unknown;
}

export interface ColumnMappingResult {
  mappedHeaders: Record<string, string>; // original -> standardField
  missingRequired: string[];
  fieldConfidence: Record<string, number>;
}

const FIELD_ALIASES: Record<string, string[]> = {
  lastName: [
    "nom",
    "nom de famille",
    "last name",
    "lastname",
    "surname",
    "family name",
    "nom_etudiant",
    "noms",
  ],
  firstName: [
    "prenom",
    "prénom",
    "first name",
    "firstname",
    "given name",
    "prenoms",
    "prénoms",
    "prenom_etudiant",
  ],
  studentNumber: [
    "matricule",
    "mat",
    "id",
    "numero etudiant",
    "numéro étudiant",
    "student id",
    "student_id",
    "code etudiant",
    "num_matricule",
    "n° matricule",
  ],
  phone: [
    "telephone",
    "téléphone",
    "contact",
    "phone",
    "mobile",
    "tel",
    "tél",
    "cel",
    "numero",
    "numéro",
    "contact etudiant",
  ],
  parentPhone: [
    "telephone parent",
    "téléphone parent",
    "tel parent",
    "tél parent",
    "contact parent",
    "phone parent",
    "parent phone",
    "parent_phone",
    "cel parent",
    "numero parent",
  ],
  parentName: [
    "parent",
    "nom parent",
    "tuteur",
    "nom du parent",
    "parent name",
    "responsable",
  ],
  email: [
    "email",
    "e-mail",
    "courriel",
    "mail",
    "adresse email",
  ],
  class: [
    "classe",
    "class",
    "niveau",
    "section",
    "filiere",
    "filière",
  ],
};

/**
 * Normalizes string header for matching (lowercase, no accents, alphanumeric/spaces only)
 */
export function cleanHeaderString(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, " ")     // replace punctuation with space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps raw object keys to standard student field names
 */
export function detectColumns(headers: string[]): ColumnMappingResult {
  const mappedHeaders: Record<string, string> = {};
  const fieldConfidence: Record<string, number> = {};
  const usedStandardFields = new Set<string>();

  for (const rawHeader of headers) {
    const cleaned = cleanHeaderString(rawHeader);
    let matchedField: string | null = null;
    let matchScore = 0;

    for (const [standardField, aliases] of Object.entries(FIELD_ALIASES)) {
      if (usedStandardFields.has(standardField)) continue;

      for (const alias of aliases) {
        const cleanedAlias = cleanHeaderString(alias);
        if (cleaned === cleanedAlias) {
          matchedField = standardField;
          matchScore = 1.0;
          break;
        } else if (cleaned.includes(cleanedAlias) || cleanedAlias.includes(cleaned)) {
          if (matchScore < 0.8) {
            matchedField = standardField;
            matchScore = 0.8;
          }
        }
      }

      if (matchScore === 1.0) break;
    }

    if (matchedField) {
      mappedHeaders[rawHeader] = matchedField;
      fieldConfidence[rawHeader] = matchScore;
      usedStandardFields.add(matchedField);
    }
  }

  const missingRequired: string[] = [];
  if (!usedStandardFields.has("lastName")) missingRequired.push("lastName");
  if (!usedStandardFields.has("firstName")) missingRequired.push("firstName");

  return { mappedHeaders, missingRequired, fieldConfidence };
}
