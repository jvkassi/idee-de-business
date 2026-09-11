import { describe, expect, it } from "vitest";
import { dedupeById, historySpanDays, shouldStopPaging, type PagingState } from "./waArchive";
import type { WahaMessage } from "./waha";

function msg(id: string, timestamp = 1_700_000_000): WahaMessage {
  return { id, body: `corps ${id}`, timestamp, from: "a@c.us", fromMe: false, hasMedia: false };
}

function paging(over: Partial<PagingState>): PagingState {
  return { pageLength: 100, requested: 100, addedNew: 100, totalSoFar: 100, maxTotal: 1000, ...over };
}

describe("dedupeById", () => {
  it("supprime les doublons en gardant la première occurrence", () => {
    const a = msg("a", 100);
    const b = msg("b", 200);
    const out = dedupeById([a, b, msg("a", 100), b]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
    expect(out[0]).toBe(a);
  });

  it("laisse passer une liste sans doublons et gère le vide", () => {
    expect(dedupeById([msg("a"), msg("b")]).map((m) => m.id)).toEqual(["a", "b"]);
    expect(dedupeById([])).toEqual([]);
  });
});

describe("shouldStopPaging", () => {
  it("continue sur une page pleine de nouveautés", () => {
    expect(shouldStopPaging(paging({}))).toBe(false);
  });

  it("s'arrête sur page vide (fin du store)", () => {
    expect(shouldStopPaging(paging({ pageLength: 0, addedNew: 0, totalSoFar: 240 }))).toBe(true);
  });

  it("s'arrête quand la page n'apporte que des doublons (fenêtres qui se recouvrent)", () => {
    expect(shouldStopPaging(paging({ pageLength: 100, addedNew: 0, totalSoFar: 105 }))).toBe(true);
  });

  it("s'arrête au plafond maxTotal même sur page pleine", () => {
    expect(shouldStopPaging(paging({ totalSoFar: 1000, maxTotal: 1000 }))).toBe(true);
    expect(
      shouldStopPaging(paging({ pageLength: 100, addedNew: 100, totalSoFar: 500, maxTotal: 500 })),
    ).toBe(true);
  });

  it("s'arrête sur page partielle (queue du store)", () => {
    expect(shouldStopPaging(paging({ pageLength: 23, requested: 100, addedNew: 5, totalSoFar: 245 }))).toBe(
      true,
    );
  });

  it("ne confond pas une page exactement à la taille demandée avec une page partielle", () => {
    expect(
      shouldStopPaging(paging({ pageLength: 50, requested: 50, addedNew: 50, totalSoFar: 150 })),
    ).toBe(false);
  });
});

describe("historySpanDays", () => {
  it("calcule l'étendue en jours entre le plus vieux et le plus récent", () => {
    expect(historySpanDays([msg("a", 1_000_000), msg("b", 1_000_000 + 86400 * 7)])).toBeCloseTo(7, 6);
  });

  it("ignore les timestamps absents et rend null si aucune date", () => {
    expect(historySpanDays([msg("a", 0), msg("b", 1_000_000)])).toBe(0);
    expect(historySpanDays([msg("a", 0)])).toBeNull();
    expect(historySpanDays([])).toBeNull();
  });
});
