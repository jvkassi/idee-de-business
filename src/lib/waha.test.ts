import { describe, expect, it } from "vitest";
import { isAnalyzableMedia, rewriteMediaUrl } from "./waha";

describe("rewriteMediaUrl", () => {
  it("réécrit l'hôte interne vers l'hôte public", () => {
    process.env.WAHA_BASE_URL = "https://bot.labs.synelia.tech";
    expect(rewriteMediaUrl("http://waha:3000/api/files/S/abc.jpeg")).toBe(
      "https://bot.labs.synelia.tech/api/files/S/abc.jpeg",
    );
  });

  it("laisse passer les URL publiques et ignore le vide", () => {
    process.env.WAHA_BASE_URL = "https://bot.labs.synelia.tech";
    expect(rewriteMediaUrl("https://bot.labs.synelia.tech/api/files/S/a.pdf")).toBe(
      "https://bot.labs.synelia.tech/api/files/S/a.pdf",
    );
    expect(rewriteMediaUrl(undefined)).toBeUndefined();
    expect(rewriteMediaUrl("n'importe quoi")).toBeUndefined();
  });
});

describe("isAnalyzableMedia", () => {
  it("accepte images et PDF raisonnables", () => {
    expect(isAnalyzableMedia("image/jpeg", 140_000)).toBe(true);
    expect(isAnalyzableMedia("image/webp", 10_000)).toBe(true);
    expect(isAnalyzableMedia("application/pdf", 2_000_000)).toBe(true);
  });

  it("refuse le reste", () => {
    expect(isAnalyzableMedia("audio/ogg;codecs=opus", 50_000)).toBe(false);
    expect(isAnalyzableMedia("video/mp4", 50_000)).toBe(false);
    expect(isAnalyzableMedia("image/jpeg", 0)).toBe(false);
    expect(isAnalyzableMedia("image/jpeg", 8 * 1024 * 1024)).toBe(false);
    expect(isAnalyzableMedia(undefined, 1000)).toBe(false);
  });
});
