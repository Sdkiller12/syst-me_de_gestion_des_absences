import { randomInt } from "crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Politique commune à tous les mots de passe choisis par un utilisateur */
export const passwordPolicy = z
  .string()
  .min(8, "8 caractères minimum")
  .max(128, "128 caractères maximum")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/\d/, "Au moins un chiffre");

// Sans caractères ambigus (0/O, 1/l/I) : le mot de passe est souvent recopié à la main
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALL = LOWER + UPPER + DIGITS;

function pick(chars: string) {
  return chars[randomInt(chars.length)];
}

/** Mot de passe temporaire aléatoire (CSPRNG), conforme à passwordPolicy */
export function generateTemporaryPassword(length = 12): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Mélange de Fisher-Yates pour ne pas figer la position des classes de caractères
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** "Jean-Marc", "KOUASSI" → "jean-marc.kouassi" (ASCII, minuscules) */
export function usernameBase(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  const base = [clean(firstName), clean(lastName)].filter(Boolean).join(".");
  return (base || "enseignant").slice(0, 40);
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Identifiant unique sur toute la plateforme (la connexion ne demande pas l'école) :
 * jean.kouassi, puis jean.kouassi2, jean.kouassi3… sans jamais réutiliser un identifiant existant.
 * `reserved` couvre les identifiants attribués dans le même lot mais pas encore écrits en base.
 */
export async function allocateUsername(db: Db, firstName: string, lastName: string, reserved = new Set<string>()) {
  const base = usernameBase(firstName, lastName);
  const taken = new Set(
    (
      await db.user.findMany({
        where: { username: { startsWith: base } },
        select: { username: true },
      })
    ).map((u) => u.username),
  );
  let candidate = base;
  for (let n = 2; taken.has(candidate) || reserved.has(candidate); n++) candidate = `${base}${n}`;
  reserved.add(candidate);
  return candidate;
}
