import { describe, expect, it } from "vitest";
import { SCHEMA } from "./db";

/**
 * Garde-fou : une coquille dans SCHEMA (ex: un "<" parasite devant un
 * commentaire) fait échouer init() au premier appel DB et met TOUTES les
 * pages de données en erreur en prod, alors que lint/test/build restent
 * verts (aucun n'exécute le SQL). Ce test rejoue le découpage d'init().
 */
describe("SCHEMA", () => {
  const statements = SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  it("ne contient que des ordres SQL valides (pas de caractère parasite)", () => {
    expect(statements.length).toBeGreaterThan(10);
    for (const s of statements) {
      // Hors lignes de commentaire : le code doit commencer par un ordre.
      const codeLines = s.split("\n").filter((l) => !l.trim().startsWith("--"));
      const firstCode = (codeLines[0] || "").trim();
      expect(firstCode, `statement: ${s.slice(0, 80)}`).not.toMatch(/^[<>&|]/);
      expect(firstCode).toMatch(/^(CREATE|ALTER|DELETE|INSERT)/);
    }
  });

  it("a des parenthèses équilibrées par statement", () => {
    for (const s of statements) {
      // Hors commentaires SQL.
      const code = s
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n");
      const open = (code.match(/\(/g) || []).length;
      const close = (code.match(/\)/g) || []).length;
      expect(`${open}/${close} : ${s.slice(0, 80)}`).toBe(`${open}/${open} : ${s.slice(0, 80)}`);
      expect(close).toBe(open);
    }
  });

  it("crée job_matches après job_offers (référence FK)", () => {
    const joined = statements.join(";");
    expect(joined.indexOf("CREATE TABLE IF NOT EXISTS job_offers")).toBeLessThan(
      joined.indexOf("CREATE TABLE IF NOT EXISTS job_matches"),
    );
  });
});
