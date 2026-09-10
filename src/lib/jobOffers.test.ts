import { describe, expect, it } from "vitest";
import { buildMessageThreads } from "./jobOffers";
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
});
