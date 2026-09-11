import { describe, expect, it } from "vitest";
import { validateDirectOffer } from "./directOffers";

const VALID = {
  title: "Serveuse demandée pour maquis à Cocody",
  company: "Maquis Le Baobab",
  location: "Cocody, Abidjan",
  contractType: "CDI",
  salary: "75 000 FCFA / mois",
  contact: "+225 07 00 00 00 00",
  description:
    "Je cherche une serveuse pour mon maquis à Cocody, du mardi au dimanche de 11 h à 23 h. Logement et repas sur place.",
};

describe("validateDirectOffer", () => {
  it("accepte une offre complète et valide", () => {
    expect(validateDirectOffer(VALID)).toBeNull();
  });

  it("accepte une offre sans les champs facultatifs", () => {
    expect(
      validateDirectOffer({ title: VALID.title, contact: VALID.contact, description: VALID.description }),
    ).toBeNull();
  });

  it("refuse un titre trop court", () => {
    expect(validateDirectOffer({ ...VALID, title: "Serveuse" })).toMatch(/10 caractères/);
  });

  it("refuse un titre fait uniquement d'espaces", () => {
    expect(validateDirectOffer({ ...VALID, title: "          " })).toMatch(/10 caractères/);
  });

  it("refuse une description trop courte", () => {
    expect(validateDirectOffer({ ...VALID, description: "Serveuse demandée vite." })).toMatch(/30 caractères/);
  });

  it("refuse un contact trop court", () => {
    expect(validateDirectOffer({ ...VALID, contact: "07" })).toMatch(/5 caractères/);
  });

  it("refuse un champ facultatif trop long", () => {
    expect(validateDirectOffer({ ...VALID, company: "x".repeat(151) })).toMatch(/150 caractères/);
  });

  it("refuse un type de contrat hors liste", () => {
    expect(validateDirectOffer({ ...VALID, contractType: "Bénévolat" })).toMatch(/contrat/);
  });
});
