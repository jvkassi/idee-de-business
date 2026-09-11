import { describe, expect, it } from "vitest";
import { fileReport, isValidReason, REPORT_REASONS } from "./reports";

describe("isValidReason", () => {
  it("accepte chaque motif proposé", () => {
    for (const reason of REPORT_REASONS) {
      expect(isValidReason(reason)).toBe(true);
    }
  });

  it("refuse un motif inconnu", () => {
    expect(isValidReason("Spam")).toBe(false);
    expect(isValidReason("arnaque / demande d'argent")).toBe(false);
  });

  it("refuse un motif vide", () => {
    expect(isValidReason("")).toBe(false);
    expect(isValidReason("   ")).toBe(false);
  });
});

describe("fileReport validation", () => {
  it("rejette un motif invalide sans toucher la base", async () => {
    await expect(fileReport(1, "Spam", 1)).rejects.toThrow("Motif invalide");
  });

  it("rejette un motif vide sans toucher la base", async () => {
    await expect(fileReport(1, "", null)).rejects.toThrow("Motif invalide");
  });
});
