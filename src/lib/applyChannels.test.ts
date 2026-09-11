import { describe, expect, it } from "vitest";
import {
  authorDisplayPhone,
  authorWaLink,
  extractApplyChannels,
  isPrivateApply,
  jidToPhone,
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

  describe("jidToPhone", () => {
    it("convertit un JID c.us simple", () => {
      expect(jidToPhone("2250707070707@c.us")).toBe("+225707070707");
    });
    it("supporte espaces / tirets / plus dans un JID c.us", () => {
      expect(jidToPhone("+225 07 07 07 07 07@c.us")).toBe("+225707070707");
      expect(jidToPhone("07-07-07-07-07@c.us")).toBe("+225707070707");
      expect(jidToPhone("+22507-07-07-07-07@c.us")).toBe("+225707070707");
      expect(jidToPhone("07 07 07 07 07@c.us")).toBe("+225707070707");
    });
    it("convertit un JID s.whatsapp.net", () => {
      expect(jidToPhone("2250707070707@s.whatsapp.net")).toBe("+225707070707");
      expect(jidToPhone("0707070707@s.whatsapp.net")).toBe("+225707070707");
    });
    it("retourne null pour les JID lid opaques", () => {
      expect(jidToPhone("88759978705003@lid")).toBeNull();
      expect(jidToPhone("1234567890@lid")).toBeNull();
      expect(jidToPhone("88759978705003@LID")).toBeNull();
    });
    it("retourne null pour les JID de groupe g.us", () => {
      expect(jidToPhone("120363406705817551@g.us")).toBeNull();
      expect(jidToPhone("120363406705817551@G.US")).toBeNull();
    });
    it("retourne null pour vide / invalide", () => {
      expect(jidToPhone(null)).toBeNull();
      expect(jidToPhone(undefined)).toBeNull();
      expect(jidToPhone("")).toBeNull();
      expect(jidToPhone("   ")).toBeNull();
      expect(jidToPhone("@c.us")).toBeNull();
      expect(jidToPhone("not-a-phone@c.us")).toBeNull();
    });
  });

  describe("isPrivateApply", () => {
    it.each([
      "Contactez en PV",
      "contactez en pv",
      "CONTACTEZ EN PV",
      "écrivez-moi en inbox",
      "Ecrivez-moi en inbox",
      "MP en privé",
      "mp en prive",
      "interessé ib moi",
      "intéressé ib moi",
      "Contactez-moi en privé",
      "ecris-moi en privé",
      "écris-moi en privé",
      "vous pouvez me contacter en privé",
      "envoyez un message privé",
      "intéressé, contact en pv",
      "interesse pv",
      "me ib",
      "ib moi",
      "contacte-moi en i.b",
      "envoyez-moi un DM",
      "DM moi",
      "contact en inbox svp",
      "viens en pv",
      "écrire en DM",
    ])("détecte une demande privée : %s", (text) => {
      expect(isPrivateApply(text)).toBe(true);
    });

    it.each([
      "contact: 07 07 07 07 07",
      "Contact au 0707070707",
      "envoyez CV à rh@example.com",
      "postulez sur https://forms.gle/abc123",
      "",
      "   ",
      "ib",
      "IB",
      "cible disponible",
      "secteur privé cherche commercial",
      "admin cherche un vendeur",
      "emploi complet à pourvoir",
      "Offre de caissier à Abidjan, salaire 150 000 FCFA",
    ])("reste faux pour : %s", (text) => {
      expect(isPrivateApply(text)).toBe(false);
    });

    it("ib seul est trop bruité, exige un contexte me/moi/inbox", () => {
      expect(isPrivateApply("ib")).toBe(false);
      expect(isPrivateApply("me ib")).toBe(true);
      expect(isPrivateApply("ib moi")).toBe(true);
      expect(isPrivateApply("i.b")).toBe(true);
    });
  });

  describe("authorWaLink", () => {
    it("retourne un lien wa.me avec chiffres + titre encodé", () => {
      const link = authorWaLink("2250707070707@c.us", "Caissier");
      expect(link).not.toBeNull();
      expect(link).toContain("https://wa.me/225707070707?text=");
      expect(link).toContain(encodeURIComponent("Caissier"));
    });
    it("fonctionne sans titre et via s.whatsapp.net", () => {
      const link = authorWaLink("2250707070707@s.whatsapp.net");
      expect(link).toContain("https://wa.me/225707070707?text=");
    });
    it("encode les titres avec accents / espaces", () => {
      const link = authorWaLink("2250707070707@c.us", "Caissier à Abidjan");
      expect(link).toContain(encodeURIComponent("Caissier à Abidjan"));
    });
    it("retourne null sans téléphone (lid / groupe / vide)", () => {
      expect(authorWaLink("88759978705003@lid", "Caissier")).toBeNull();
      expect(authorWaLink("120363406705817551@g.us", "Caissier")).toBeNull();
      expect(authorWaLink(null, "Caissier")).toBeNull();
      expect(authorWaLink(undefined)).toBeNull();
      expect(authorWaLink("")).toBeNull();
    });
  });

  describe("authorDisplayPhone", () => {
    it("affiche le E.164 déduit du JID", () => {
      expect(authorDisplayPhone("2250707070707@c.us")).toBe("+225707070707");
      expect(authorDisplayPhone("+225 07-07-07-07-07@c.us")).toBe(
        "+225707070707",
      );
      expect(authorDisplayPhone("2250707070707@s.whatsapp.net")).toBe(
        "+225707070707",
      );
    });
    it("retourne null sans téléphone", () => {
      expect(authorDisplayPhone("88759978705003@lid")).toBeNull();
      expect(authorDisplayPhone("120363406705817551@g.us")).toBeNull();
      expect(authorDisplayPhone(null)).toBeNull();
      expect(authorDisplayPhone(undefined)).toBeNull();
      expect(authorDisplayPhone("")).toBeNull();
    });
  });
});
