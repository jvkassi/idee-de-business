import { describe, expect, it } from "vitest";
import { KIT_SCORE_THRESHOLD } from "./constants";

describe("KIT_SCORE_THRESHOLD", () => {
  it("is a sane score threshold between 0 and 100", () => {
    expect(KIT_SCORE_THRESHOLD).toBe(70);
    expect(KIT_SCORE_THRESHOLD).toBeGreaterThan(0);
    expect(KIT_SCORE_THRESHOLD).toBeLessThanOrEqual(100);
  });
});
