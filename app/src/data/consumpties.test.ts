import { describe, expect, it } from "vitest";
import { berekenConsumpties, consumptiesPerStuk, inhoudInLiters } from "./consumpties";
import type { Mutatie, Product } from "./types";

function product(velden: Partial<Product> & Pick<Product, "id" | "naam">): Product {
  return {
    categorie: "overig",
    inkoopprijs: 0,
    eenheid: "fles",
    stuksPerVerpakking: 1,
    alleenPerVerpakking: false,
    statiegeldPerStuk: 0,
    statiegeldPerVerpakking: 0,
    voorraadloos: false,
    voorPersoneel: false,
    ...velden,
  };
}

const fust = product({ id: "fust", naam: "Fust Swinckels 20 L", categorie: "bier", inhoud: "20 L", eenheid: "fust" });
const cola = product({ id: "cola", naam: "Coca Cola 0,2 L", categorie: "fris", inhoud: "0,2 L" });
const wijn = product({ id: "wijn", naam: "Witte wijn 0,7 L", categorie: "wijn", inhoud: "0,7 L" });
const koffie = product({ id: "koffie", naam: "Koffie", categorie: "koffie", eenheid: "kop", voorraadloos: true });
const producten = [fust, cola, wijn, koffie];

let volgnummer = 0;
function boeking(productId: string, aantal: number, retour = false): Mutatie {
  volgnummer += 1;
  return {
    id: `m${volgnummer}`,
    productId,
    aantal,
    type: retour ? "evenement-naar-magazijn" : "magazijn-naar-evenement",
    evenementId: "e1",
    gebruikerId: "u1",
    datumTijd: "2026-10-10T18:00:00.000Z",
  };
}

describe("inhoudInLiters", () => {
  it("leest liters, centiliters en milliliters", () => {
    expect(inhoudInLiters("0,2 L")).toBe(0.2);
    expect(inhoudInLiters("20 L")).toBe(20);
    expect(inhoudInLiters("1,25 L")).toBe(1.25);
    expect(inhoudInLiters("33 cl")).toBeCloseTo(0.33);
    expect(inhoudInLiters("500 ml")).toBe(0.5);
  });
  it("geeft niets bij onbekende inhoud", () => {
    expect(inhoudInLiters(undefined)).toBeUndefined();
    expect(inhoudInLiters("doos")).toBeUndefined();
  });
});

describe("consumptiesPerStuk", () => {
  it("een flesje is één consumptie", () => {
    expect(consumptiesPerStuk(cola)).toBe(1);
  });
  it("een fust van 20 L is 80 glazen van 25 cl", () => {
    expect(consumptiesPerStuk(fust)).toBe(80);
  });
  it("een fles wijn van 0,7 L wordt ook in glazen geteld", () => {
    expect(consumptiesPerStuk(wijn)).toBeCloseTo(2.8);
  });
  it("zonder inhoud één per stuk", () => {
    expect(consumptiesPerStuk(koffie)).toBe(1);
  });
});

describe("berekenConsumpties", () => {
  it("rekent met verbruik na retour en deelt door het aantal personen", () => {
    const mutaties = [boeking("fust", 2), boeking("cola", 96), boeking("cola", 16, true)];
    const uitkomst = berekenConsumpties(mutaties, producten, 120);
    // 2 fusten = 160 glazen, 80 flesjes cola
    expect(uitkomst.totaal).toBe(240);
    expect(uitkomst.perPersoon).toBe(2);
    expect(uitkomst.perCategorie.map((c) => [c.categorie, c.consumpties])).toEqual([
      ["bier", 160],
      ["fris", 80],
    ]);
  });

  it("telt koffie en water uit de machines mee", () => {
    const uitkomst = berekenConsumpties([], producten, 50, [{ productId: "koffie", aantal: 100, waarde: 0 }]);
    expect(uitkomst.totaal).toBe(100);
    expect(uitkomst.perPersoon).toBe(2);
  });

  it("zonder aantal personen geen per-persooncijfer", () => {
    const uitkomst = berekenConsumpties([boeking("cola", 24)], producten, undefined);
    expect(uitkomst.totaal).toBe(24);
    expect(uitkomst.perPersoon).toBeUndefined();
    expect(uitkomst.perCategorie[0].perPersoon).toBeUndefined();
  });

  it("een retour groter dan de uitgifte telt niet negatief mee", () => {
    const uitkomst = berekenConsumpties([boeking("cola", 24), boeking("cola", 48, true)], producten, 10);
    expect(uitkomst.totaal).toBe(0);
  });
});
