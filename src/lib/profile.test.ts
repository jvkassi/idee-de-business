import { describe, expect, it } from "vitest";
import { profileHasContent, profileReadyToMatch, type Profile } from "./profile";

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    headline: "",
    summary: "",
    skills: [],
    experience: [],
    education: [],
    languages: [],
    location: null,
    phone: null,
    email: null,
    photoUrl: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("profileHasContent", () => {
  it("returns false for null/undefined", () => {
    expect(profileHasContent(null)).toBe(false);
    expect(profileHasContent(undefined)).toBe(false);
  });

  it("returns false for a completely empty profile", () => {
    expect(profileHasContent(baseProfile())).toBe(false);
  });

  it("returns false for whitespace-only strings", () => {
    expect(profileHasContent(baseProfile({ headline: "   " }))).toBe(false);
  });

  it("returns true for a partial profile with only phone + location", () => {
    expect(
      profileHasContent(baseProfile({ phone: "+225 07 00 00 00", location: "Abidjan" })),
    ).toBe(true);
  });

  it("returns true when only an array field is filled", () => {
    expect(profileHasContent(baseProfile({ skills: ["Vente"] }))).toBe(true);
    expect(
      profileHasContent(
        baseProfile({
          experience: [{ title: "Serveuse", company: "Maquis", period: "2022-2024", description: "Service" }],
        }),
      ),
    ).toBe(true);
  });

  it("returns true for a full profile", () => {
    expect(
      profileHasContent(
        baseProfile({
          headline: "Serveuse expérimentée — Abidjan",
          summary: "Deux ans d'expérience en restauration.",
          skills: ["Service", "Caisse"],
          experience: [{ title: "Serveuse", company: "Maquis", period: "2022-2024", description: "Service" }],
          education: [{ degree: "BEPC", school: "Collège", period: "2020" }],
          languages: ["Français"],
          location: "Abidjan",
          phone: "+225 07 00 00 00",
          email: "a@example.com",
          photoUrl: "https://example.com/photo.jpg",
        }),
      ),
    ).toBe(true);
  });
});

describe("profileReadyToMatch", () => {
  it("returns false for null/undefined", () => {
    expect(profileReadyToMatch(null)).toBe(false);
    expect(profileReadyToMatch(undefined)).toBe(false);
  });

  it("returns false for a completely empty profile", () => {
    expect(profileReadyToMatch(baseProfile())).toBe(false);
  });

  it("returns false for a partial profile with only phone + location", () => {
    // Le cas du bug /jobs : contenu présent mais pas exploitable par l'IA.
    const partial = baseProfile({ phone: "+225 07 00 00 00", location: "Abidjan" });
    expect(profileHasContent(partial)).toBe(true);
    expect(profileReadyToMatch(partial)).toBe(false);
  });

  it("returns true with only a headline", () => {
    expect(profileReadyToMatch(baseProfile({ headline: "Serveuse — Abidjan" }))).toBe(true);
  });

  it("returns true with only a summary", () => {
    expect(profileReadyToMatch(baseProfile({ summary: "Deux ans d'expérience." }))).toBe(true);
  });

  it("returns true with only skills", () => {
    expect(profileReadyToMatch(baseProfile({ skills: ["Caisse"] }))).toBe(true);
  });

  it("returns true for a full profile", () => {
    expect(
      profileReadyToMatch(
        baseProfile({
          headline: "Serveuse expérimentée — Abidjan",
          summary: "Deux ans d'expérience en restauration.",
          skills: ["Service", "Caisse"],
        }),
      ),
    ).toBe(true);
  });
});
