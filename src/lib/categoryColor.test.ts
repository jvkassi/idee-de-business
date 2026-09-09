import { describe, expect, it } from "vitest";
import { categoryColor, categoryStyle } from "./categoryColor";

describe("categoryColor", () => {
  it("returns the mapped color for a known slug", () => {
    expect(categoryColor("tech")).toBe("#2f5cff");
    expect(categoryColor("sante")).toBe("#0d9488");
  });

  it("returns the 'autre' color for an unknown slug", () => {
    expect(categoryColor("nope")).toBe(categoryColor("autre"));
    expect(categoryColor("")).toBe("#6b7280");
  });
});

describe("categoryStyle", () => {
  it("exposes the color under the --cat CSS custom property", () => {
    expect(categoryStyle("tech")).toEqual({ "--cat": "#2f5cff" });
  });

  it("falls back to 'autre' for an unknown slug", () => {
    expect(categoryStyle("unknown")).toEqual({ "--cat": "#6b7280" });
  });
});
