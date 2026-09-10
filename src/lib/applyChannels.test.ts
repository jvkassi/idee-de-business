import { describe, expect, it } from "vitest";
import {
  extractApplyChannels,
  mergeChannels,
  normalizePhone,
  threadPartCount,
  THREAD_SEPARATOR,
  whatsappLink,
} from "./applyChannels";

describe("applyChannels", () => {
  it("extrait mail + numéro ivoirien + lien", () => {
    const c = extractApplyChannels(
      "Recrute commercial à Abidjan. CV à rh@example.com ou WhatsApp 07 07 07 07 07. Formulaire : https://forms.gle/abc123",
    );
    expect(c.emails).toEqual(["rh@example.com"]);
    expect(c.phones).toEqual(["+225707070707"]);
    expect(c.urls).toEqual(["https://forms.gle/abc123"]);
  });

  it("normalise les formats locaux", () => {
    expect(normalizePhone("07-07-07-07-07")).toBe("+225707070707");
    expect(normalizePhone("+225 07 07 07 07 07")).toBe("+225707070707");
    expect(normalizePhone("2024")).toBeNull();
    expect(normalizePhone("150 000")).toBeNull();
  });

  it("fusionne regex + Gemini sans doublons", () => {
    const base = extractApplyChannels("Contact 07 07 07 07 07");
    const merged = mergeChannels(base, {
      phones: ["+225707070707", "+2250505050505"],
      emails: ["RH@Example.com"],
      urls: ["https://forms.gle/abc123"],
    });
    expect(merged.phones).toEqual(["+225707070707", "+225505050505"]);
    expect(merged.emails).toEqual(["rh@example.com"]);
  });

  it("construit un lien wa.me pré-rempli", () => {
    expect(whatsappLink("+225707070707", "Caissier")).toContain("https://wa.me/225707070707?text=");
  });

  it("compte les morceaux recollés", () => {
    expect(threadPartCount("hello")).toBe(1);
    expect(threadPartCount(`part1${THREAD_SEPARATOR}part2`)).toBe(2);
  });
});
