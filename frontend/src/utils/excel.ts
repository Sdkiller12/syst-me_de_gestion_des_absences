import * as XLSX from "xlsx";

/** Modèle officiel : Prénom | Nom | Matricule | Téléphone | Téléphone parent | Email | Classe */

export function downloadTemplate(): void {
  const ws = XLSX.utils.json_to_sheet([
    { prenom: "Jean", nom: "KOUASSI", matricule: "MAT-001", telephone: "0700000000", "telephone parent": "0500000000", email: "", classe: "" },
    { prenom: "Marie", nom: "YAO", matricule: "MAT-002", telephone: "0500000000", "telephone parent": "", email: "", classe: "" },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Etudiants");
  XLSX.writeFile(wb, "modele-etudiants.xlsx");
}
