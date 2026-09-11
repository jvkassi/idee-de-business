import { describe, expect, it } from "vitest";
import { buildMessageThreads, resolveAuthorPhone } from "./jobOffers";
import type { WahaMessage } from "./waha";

function msg(partial: Partial<WahaMessage> & { id: string }): WahaMessage {
  return {
    body: "",
    timestamp: 0,
    from: "",
    fromMe: false,
    hasMedia: false,
    ...partial,
  };
}

describe("buildMessageThreads", () => {
  it("recolle 2 messages du même auteur rapprochés", () => {
    const threads = buildMessageThreads([
      msg({ id: "1", body: "Offre chauffeur à Abidjan.", timestamp: 1000, participant: "a@x" }),
      msg({ id: "2", body: "Contact WhatsApp 07 07 07 07 07.", timestamp: 1000 + 60, participant: "a@x" }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0].partIds).toEqual(["1", "2"]);
    expect(threads[0].thread.body).toContain("07 07 07 07 07");
    expect(threads[0].thread.id).toBe("1");
  });

  it("sépare les auteurs différents ou trop espacés", () => {
    const threads = buildMessageThreads([
      msg({ id: "1", body: "Offre 1..........long message pour passer le filtre", timestamp: 1000, participant: "a" }),
      msg({ id: "2", body: "Autre personne qui parle d'autre chose ici", timestamp: 1060, participant: "b" }),
      msg({ id: "3", body: "Suite tardive du premier auteur bien plus tard", timestamp: 1000 + 3600, participant: "a" }),
    ]);
    expect(threads).toHaveLength(3);
  });

  it("suit les pièces jointes dans le thread", () => {
    const threads = buildMessageThreads([
      msg({ id: "1", body: "Recrutement, voir flyer.", timestamp: 1000, participant: "a@x" }),
      msg({
        id: "2",
        body: "",
        timestamp: 1030,
        participant: "a@x",
        hasMedia: true,
        mediaUrl: "http://waha:3000/api/files/S/flyer.jpeg",
        mediaMime: "image/jpeg",
      }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0].media).toEqual([{ url: "http://waha:3000/api/files/S/flyer.jpeg", mime: "image/jpeg" }]);
  });
});

describe("resolveAuthorPhone", () => {
  const lidMap = new Map([["88759978705003@lid", "2250707070707@c.us"]]);

  it("direct pour @c.us, via table pour @lid", () => {
    expect(resolveAuthorPhone("2250707070707@c.us")).toBe("+225707070707");
    expect(resolveAuthorPhone("88759978705003@lid", lidMap)).toBe("+225707070707");
  });

  it("null si inconnu ou groupe", () => {
    expect(resolveAuthorPhone("99999999999999@lid", lidMap)).toBeNull();
    expect(resolveAuthorPhone("99999999999999@lid")).toBeNull();
    expect(resolveAuthorPhone("120363406705817551@g.us", lidMap)).toBeNull();
    expect(resolveAuthorPhone(null, lidMap)).toBeNull();
  });
});
