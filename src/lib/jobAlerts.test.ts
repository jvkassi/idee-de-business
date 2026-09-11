import { describe, expect, it } from "vitest";
import { buildAlertPayload, isMatchReady, parseOfferInput, topMatches } from "./jobAlerts";

describe("topMatches", () => {
  it("filtre au seuil 70 par défaut et trie par score décroissant", () => {
    const out = topMatches([
      { id: 1, score: 69, reason: "Limite" },
      { id: 2, score: 85, reason: "Top" },
      { id: 3, score: 70, reason: "Seuil" },
      { id: 4, score: 95, reason: "Meilleur" },
    ]);
    expect(out.map((m) => m.id)).toEqual([4, 2, 3]);
  });

  it("accepte un seuil personnalisé", () => {
    const out = topMatches(
      [
        { id: 1, score: 50, reason: "Moyen" },
        { id: 2, score: 60, reason: "Correct" },
      ],
      50,
    );
    expect(out.map((m) => m.id)).toEqual([2, 1]);
  });

  it("retourne un tableau vide sans match au seuil", () => {
    expect(topMatches([{ id: 1, score: 10, reason: "Non" }])).toEqual([]);
    expect(topMatches([])).toEqual([]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const input = [
      { id: 1, score: 70, reason: "A" },
      { id: 2, score: 90, reason: "B" },
    ];
    topMatches(input);
    expect(input.map((m) => m.id)).toEqual([1, 2]);
  });
});

describe("isMatchReady", () => {
  it("est prêt avec un titre, un résumé ou des compétences", () => {
    expect(isMatchReady({ headline: "Serveuse", summary: "", skills: [] } as never)).toBe(true);
    expect(isMatchReady({ headline: "", summary: "Motivée", skills: [] } as never)).toBe(true);
    expect(isMatchReady({ headline: "", summary: "", skills: ["cuisine"] } as never)).toBe(true);
  });

  it("n'est pas prêt avec un profil vide ou absent", () => {
    expect(isMatchReady({ headline: "", summary: "", skills: [] } as never)).toBe(false);
    expect(isMatchReady({ headline: "  ", summary: "  ", skills: [] } as never)).toBe(false);
    expect(isMatchReady(null)).toBe(false);
    expect(isMatchReady(undefined)).toBe(false);
  });
});

describe("parseOfferInput", () => {
  it("parse une offre valide", () => {
    const out = parseOfferInput(
      7,
      JSON.stringify({ isJobOffer: true, title: "Serveuse", summary: "Service midi", skills: ["sourire"], location: "Abidjan", contractType: "CDI" }),
    );
    expect(out).toMatchObject({ id: 7, title: "Serveuse", location: "Abidjan", contractType: "CDI" });
  });

  it("ignore JSON absent, invalide ou pas une offre", () => {
    expect(parseOfferInput(1, null)).toBeNull();
    expect(parseOfferInput(1, "")).toBeNull();
    expect(parseOfferInput(1, "pas-json")).toBeNull();
    expect(parseOfferInput(1, JSON.stringify({ isJobOffer: false }))).toBeNull();
  });

  it("applique des valeurs par défaut françaises robustes", () => {
    const out = parseOfferInput(2, JSON.stringify({ isJobOffer: true }));
    expect(out?.title).toBe("Offre d'emploi");
    expect(out?.summary).toBe("");
    expect(out?.skills).toEqual([]);
    expect(out?.location).toBeNull();
  });
});

describe("buildAlertPayload", () => {
  it("construit une notif française vers /jobs", () => {
    const p = buildAlertPayload({ id: 3, score: 85, reason: "Tu as le profil idéal." }, "Serveuse");
    expect(p.title).toBe("💼 85% : Serveuse");
    expect(p.body).toBe("Tu as le profil idéal.");
    expect(p.url).toBe("/jobs");
  });

  it("gère un motif vide avec un repli français", () => {
    const p = buildAlertPayload({ id: 3, score: 72, reason: "  " }, "Caissier");
    expect(p.body).toBe("Nouvelle offre compatible avec ton profil.");
  });
});
