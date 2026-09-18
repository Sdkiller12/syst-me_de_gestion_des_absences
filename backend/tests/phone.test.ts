import { describe, expect, it } from "vitest";
import { normalizePhone, validatePhone } from "../src/utils/phone.js";

describe("phone utils (CI)", () => {
  it("normalise le format local 10 chiffres vers E.164", () => {
    expect(normalizePhone("0700000001")).toBe("+225700000001");
    expect(normalizePhone("05 00 00 00 02")).toBe("+225500000002");
  });

  it("accepte +225 et 225", () => {
    expect(validatePhone("+225700000001")).toBe(true);
    expect(validatePhone("2250700000001")).toBe(true);
  });

  it("rejette les numéros invalides", () => {
    expect(validatePhone("12345")).toBe(false);
    expect(validatePhone("0600000000")).toBe(false); // préfixe 06 invalide
    expect(validatePhone("")).toBe(false);
  });
});
