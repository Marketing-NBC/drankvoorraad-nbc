import { describe, expect, it } from "vitest";
import {
  berekenMarge,
  brutomarge,
  brutowinst,
  dervingPerProduct,
  dervingWaarde,
  kostprijsVerbruik,
  lageVoorraad,
  topProducten,
  totaleBrutowinst,
  uitstaandPerEvenement,
  voorraadverschillen,
  werkelijkVerbruik,
} from "./calculations";
import type { Evenement, Mutatie, Product, Voorraad } from "./types";

const bier: Product = { id: "p1", naam: "Heineken Pils fust 50L", categorie: "bier", inkoopprijs: 85, verkoopprijs: 180, eenheid: "fust" };
const wijn: Product = { id: "p2", naam: "Chardonnay huiswijn fles", categorie: "wijn", inkoopprijs: 6.5, verkoopprijs: 22, eenheid: "fles" };
const producten = [bier, wijn];

function mutatie(partial: Partial<Mutatie>): Mutatie {
  return {
    id: "m1",
    evenementId: "e1",
    productId: bier.id,
    type: "magazijn-naar-evenement",
    aantal: 1,
    gebruikerId: "u1",
    datumTijd: "2026-01-01T10:00:00.000Z",
    ...partial,
  };
}

const uitgifte = (partial: Partial<Mutatie>) => mutatie({ type: "magazijn-naar-evenement", ...partial });
const retour = (partial: Partial<Mutatie>) => mutatie({ type: "evenement-naar-magazijn", ...partial });

describe("werkelijkVerbruik", () => {
  it("subtracts retour from uitgifte", () => {
    const mutaties = [uitgifte({ id: "m1", aantal: 10 }), retour({ id: "m2", aantal: 3 })];
    expect(werkelijkVerbruik(mutaties, bier.id)).toBe(7);
  });

  it("allows retour to exceed uitgifte (negative verbruik, correction scenario)", () => {
    const mutaties = [uitgifte({ id: "m1", aantal: 2 }), retour({ id: "m2", aantal: 5 })];
    expect(werkelijkVerbruik(mutaties, bier.id)).toBe(-3);
  });

  it("returns 0 for a product with no mutations", () => {
    expect(werkelijkVerbruik([], bier.id)).toBe(0);
  });

  it("ignores mutation types that are not event uitgifte/retour", () => {
    const mutaties = [
      uitgifte({ id: "m1", aantal: 10 }),
      mutatie({ id: "m2", type: "beschadigd", aantal: 4 }),
      mutatie({ id: "m3", type: "inkoop", aantal: 50 }),
    ];
    expect(werkelijkVerbruik(mutaties, bier.id)).toBe(10);
  });
});

describe("kostprijsVerbruik", () => {
  it("sums werkelijk verbruik x inkoopprijs across multiple products", () => {
    const mutaties = [
      uitgifte({ id: "m1", productId: bier.id, aantal: 10 }),
      retour({ id: "m2", productId: bier.id, aantal: 2 }),
      uitgifte({ id: "m3", productId: wijn.id, aantal: 4 }),
    ];
    // bier: (10-2) * 85 = 680, wijn: 4 * 6.5 = 26
    expect(kostprijsVerbruik(mutaties, producten)).toBe(706);
  });

  it("is 0 for an event with zero mutations", () => {
    expect(kostprijsVerbruik([], producten)).toBe(0);
  });
});

describe("brutowinst", () => {
  it("subtracts kostprijs verbruik from omzet", () => {
    expect(brutowinst(1000, 400)).toBe(600);
  });
});

describe("brutomarge", () => {
  it("computes percentage for a normal case", () => {
    expect(brutomarge(1000, 600)).toBe(60);
  });

  it("returns null when omzet is 0", () => {
    expect(brutomarge(0, 600)).toBeNull();
  });

  it("returns null when omzet is negative", () => {
    expect(brutomarge(-100, 600)).toBeNull();
  });
});

describe("berekenMarge", () => {
  it("returns null brutomarge when omzet is empty (0), never NaN/Infinity", () => {
    const mutaties = [uitgifte({ productId: bier.id, aantal: 5 })];
    const marge = berekenMarge(0, mutaties, producten);
    expect(marge.brutomarge).toBeNull();
    expect(Number.isNaN(marge.brutowinst)).toBe(false);
  });

  it("computes a full marge block for a normal event", () => {
    const mutaties = [
      uitgifte({ id: "m1", productId: bier.id, aantal: 10 }),
      uitgifte({ id: "m2", productId: wijn.id, aantal: 4 }),
    ];
    const marge = berekenMarge(2000, mutaties, producten);
    expect(marge.kostprijsVerbruik).toBe(876); // 10*85 + 4*6.5
    expect(marge.brutowinst).toBe(1124);
    expect(marge.brutomarge).toBeCloseTo(56.2, 5);
  });

  it("reports uitgegeven and retour values separately", () => {
    const mutaties = [
      uitgifte({ id: "m1", productId: bier.id, aantal: 10 }),
      retour({ id: "m2", productId: bier.id, aantal: 4 }),
    ];
    const marge = berekenMarge(1000, mutaties, producten);
    expect(marge.waardeUitgegeven).toBe(850);
    expect(marge.waardeRetour).toBe(340);
    expect(marge.kostprijsVerbruik).toBe(510);
  });
});

describe("topProducten", () => {
  it("ranks products by total werkelijk verbruik, descending", () => {
    const mutaties = [
      uitgifte({ id: "m1", productId: bier.id, aantal: 5 }),
      uitgifte({ id: "m2", productId: wijn.id, aantal: 20 }),
    ];
    const top = topProducten(mutaties, producten, 5);
    expect(top[0].product.id).toBe(wijn.id);
    expect(top[1].product.id).toBe(bier.id);
  });
});

describe("dervingWaarde", () => {
  it("sums the inkoopprijs of products booked as beschadigd", () => {
    const mutaties = [
      uitgifte({ id: "m1", productId: bier.id, aantal: 10 }),
      mutatie({ id: "m2", type: "beschadigd", productId: wijn.id, aantal: 6 }),
    ];
    expect(dervingWaarde(mutaties, producten)).toBe(39); // 6 * 6.50
  });

  it("is 0 when nothing was damaged", () => {
    expect(dervingWaarde([uitgifte({ aantal: 5 })], producten)).toBe(0);
  });
});

// ─── Fase 7: rapportages ──────────────────────────────────────────────────────

describe("lageVoorraad", () => {
  const regel = (partial: Partial<Voorraad>): Voorraad => ({
    locatieId: "l1", productId: bier.id, aantal: 0, minVoorraad: 0, ...partial,
  });

  it("flags stock below its minimum, sorted by largest shortfall", () => {
    const resultaat = lageVoorraad([
      regel({ productId: bier.id, aantal: 4, minVoorraad: 5 }),
      regel({ productId: wijn.id, aantal: 1, minVoorraad: 12 }),
    ]);
    expect(resultaat.map((r) => r.productId)).toEqual([wijn.id, bier.id]);
    expect(resultaat[0].tekort).toBe(11);
  });

  it("ignores a minimum of 0, the default for every product on every location", () => {
    expect(lageVoorraad([regel({ aantal: 0, minVoorraad: 0 })])).toEqual([]);
  });

  it("does not flag stock exactly at its minimum", () => {
    expect(lageVoorraad([regel({ aantal: 5, minVoorraad: 5 })])).toEqual([]);
  });
});

describe("uitstaandPerEvenement", () => {
  const evenement = (id: string, status: Evenement["status"] = "Actief"): Evenement => ({
    id, naam: `Event ${id}`, datum: "2026-09-15", merk: "NBC", status, omzet: 0,
  });

  it("reports uitgifte minus retour, valued at inkoopprijs", () => {
    const mutaties = new Map([["e1", [uitgifte({ aantal: 10 }), retour({ aantal: 4 })]]]);
    const [regel] = uitstaandPerEvenement([evenement("e1")], mutaties, producten);
    expect(regel.aantalUitstaand).toBe(6);
    expect(regel.waardeUitstaand).toBe(6 * bier.inkoopprijs);
  });

  it("leaves out events that never had anything issued", () => {
    expect(uitstaandPerEvenement([evenement("e1")], new Map(), producten)).toEqual([]);
  });

  it("keeps a fully returned event visible, so a zero is confirmed rather than assumed", () => {
    const mutaties = new Map([["e1", [uitgifte({ aantal: 5 }), retour({ aantal: 5 })]]]);
    const [regel] = uitstaandPerEvenement([evenement("e1")], mutaties, producten);
    expect(regel.aantalUitstaand).toBe(0);
  });
});

describe("voorraadverschillen", () => {
  const correctie = (partial: Partial<Mutatie>) =>
    mutatie({ type: "correctie", notitie: "Voorraadtelling", evenementId: undefined, ...partial });

  it("reads a correction towards a location as a surplus", () => {
    const [regel] = voorraadverschillen([correctie({ aantal: 3, naarLocatieId: "l1" })], producten);
    expect(regel.verschil).toBe(3);
    expect(regel.waarde).toBe(3 * bier.inkoopprijs);
  });

  it("reads a correction away from a location as a shortage", () => {
    const [regel] = voorraadverschillen([correctie({ aantal: 2, vanLocatieId: "l1" })], producten);
    expect(regel.verschil).toBe(-2);
    expect(regel.waarde).toBe(-2 * bier.inkoopprijs);
  });

  it("ignores manual corrections, which are not counting results", () => {
    const handmatig = mutatie({ type: "correctie", notitie: "Handmatig rechtgezet", vanLocatieId: "l1" });
    expect(voorraadverschillen([handmatig], producten)).toEqual([]);
  });
});

describe("dervingPerProduct", () => {
  const beschadigd = (partial: Partial<Mutatie>) => mutatie({ type: "beschadigd", ...partial });

  it("adds up damage per product and ranks by value", () => {
    const resultaat = dervingPerProduct(
      [
        beschadigd({ id: "m1", productId: wijn.id, aantal: 2 }),
        beschadigd({ id: "m2", productId: bier.id, aantal: 1 }),
        beschadigd({ id: "m3", productId: wijn.id, aantal: 3 }),
      ],
      producten
    );
    expect(resultaat.map((r) => r.product.id)).toEqual([bier.id, wijn.id]);
    expect(resultaat.find((r) => r.product.id === wijn.id)?.aantal).toBe(5);
  });

  it("totals to the same value as dervingWaarde", () => {
    const mutaties = [beschadigd({ productId: bier.id, aantal: 2 }), beschadigd({ productId: wijn.id, aantal: 4 })];
    const som = dervingPerProduct(mutaties, producten).reduce((s, r) => s + r.waarde, 0);
    expect(som).toBe(dervingWaarde(mutaties, producten));
  });
});

describe("totaleBrutowinst", () => {
  const ev = (id: string, status: Evenement["status"], omzet: number): Evenement => ({
    id, naam: `Event ${id}`, datum: "2026-09-24", merk: "NBC", status, omzet,
  });
  const mutaties = new Map([
    ["e1", [uitgifte({ aantal: 2 })]],
    ["e2", [uitgifte({ aantal: 2 })]],
    ["e3", [uitgifte({ aantal: 2 })]],
  ]);

  it("counts a finished event, so closing one does not erase its profit", () => {
    const { totaalBrutowinst } = totaleBrutowinst(
      [ev("e1", "Afgerond", 1000)], mutaties, producten
    );
    expect(totaalBrutowinst).toBe(1000 - 2 * bier.inkoopprijs);
  });

  it("leaves planned events out — nothing has been issued yet", () => {
    const { totaalBrutowinst } = totaleBrutowinst(
      [ev("e1", "Gepland", 1000)], mutaties, producten
    );
    expect(totaalBrutowinst).toBe(0);
  });

  it("adds active and finished events together", () => {
    const { totaalBrutowinst, evenementen } = totaleBrutowinst(
      [ev("e1", "Actief", 1000), ev("e2", "Afgerond", 500), ev("e3", "Gepland", 9999)],
      mutaties, producten
    );
    expect(evenementen).toHaveLength(2);
    expect(totaalBrutowinst).toBe(1500 - 4 * bier.inkoopprijs);
  });
});
