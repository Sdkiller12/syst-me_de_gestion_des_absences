import { useState } from "react";
import { Check, Copy, Download, Printer, ShieldAlert } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import type { IssuedCredentials } from "../types";

const LABELS = {
  teacher: { person: "Enseignant", each: "enseignant", plural: "enseignants" },
  student: { person: "Élève", each: "élève", plural: "élèves" },
};

function toCsv(rows: IssuedCredentials[], person: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    [person, "Identifiant", "Email", "Mot de passe temporaire"].map(esc).join(";"),
    ...rows.map((r) => [r.fullName, r.username, r.email ?? "", r.temporaryPassword].map(esc).join(";")),
  ];
  // BOM : accents correctement lus par Excel
  return `﻿${lines.join("\r\n")}`;
}

/**
 * Identifiants remis à l'administrateur. Ils ne sont affichés qu'une fois (le serveur ne
 * conserve que le hash) : l'administrateur les transmet à chaque enseignant ou élève.
 */
export function CredentialsDialog({
  title,
  credentials,
  onClose,
  audience = "teacher",
}: {
  title: string;
  credentials: IssuedCredentials[];
  onClose: () => void;
  audience?: keyof typeof LABELS;
}) {
  const label = LABELS[audience];
  const [copied, setCopied] = useState(false);
  const loginUrl = `${window.location.origin}/login`;

  function copyAll() {
    const text = credentials
      .map((c) => `${c.fullName}\nIdentifiant : ${c.username}\nMot de passe temporaire : ${c.temporaryPassword}\nConnexion : ${loginUrl}`)
      .join("\n\n");
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function download() {
    const blob = new Blob([toCsv(credentials, label.person)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `identifiants-${label.plural}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>
            Ces mots de passe temporaires ne seront <strong>plus jamais affichés</strong>. Transmettez-les maintenant à chaque{" "}
            {label.each} : il devra choisir son propre mot de passe à sa première connexion sur <span className="font-mono">{loginUrl}</span>.
          </p>
        </div>
        {credentials.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun compte n'a été créé : tous les {label.plural} sélectionnés en possèdent déjà un.</p>
        ) : (
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 print:max-h-none">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">{label.person}</th>
                  <th className="px-3 py-2">Identifiant</th>
                  <th className="px-3 py-2">Mot de passe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credentials.map((c) => (
                  <tr key={c.username}>
                    <td className="px-3 py-2 font-medium text-slate-900">{c.fullName}</td>
                    <td className="px-3 py-2 font-mono text-slate-800">{c.username}</td>
                    <td className="px-3 py-2 font-mono font-bold text-indigo-700">{c.temporaryPassword}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {credentials.length > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={copyAll}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copié" : "Copier"}
              </Button>
              <Button variant="outline" size="sm" onClick={download}>
                <Download size={14} /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer size={14} /> Imprimer
              </Button>
            </>
          ) : null}
          <Button size="sm" onClick={onClose}>
            J'ai transmis les identifiants
          </Button>
        </div>
      </div>
    </Modal>
  );
}
