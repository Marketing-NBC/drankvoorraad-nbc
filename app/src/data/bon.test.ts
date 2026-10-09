import { describe, expect, it } from "vitest";
import {
  bonNaarVoorstel,
  herkenLeverancier,
  normaliseerArtikelnummer,
  standaardStuksPerEenheid,
  type GelezenBon,
} from "./bon";
import type { LeverancierArtikel, Product } from "./types";

const artikelen: LeverancierArtikel[] = [
  { leverancier: "Swinkels", artikelnummer: "200084", productId: "cola", stuksPerEenheid: 24 },
  { leverancier: "Swinkels", artikelnummer: "216410", productId: "zero-groot", stuksPerEenheid: 12 },
  { leverancier: "Bidfood", artikelnummer: "200084", productId: "iets-anders", stuksPerEenheid: 1 },
];

function bon(regels: GelezenBon["regels"]): GelezenBon {
  return { leverancier: "Swinkels", bonnummer: "800758649", datum: "2026-10-02", regels };
}

describe("bonNaarVoorstel", () => {
  it("rekent kratten en trays om naar stuks", () => {
    const voorstel = bonNaarVoorstel(
      bon([
        { artikelnummer: "200084", omschrijving: "Coca-Cola Regular Crate Bot 24x20", besteld: 24, uitgeleverd: 24 },
        { artikelnummer: "216410", omschrijving: "Coca-Cola Zero Tray Bot 12x125", besteld: 6, uitgeleverd: 6 },
      ]),
      "Swinkels",
      artikelen
    );
    expect(voorstel.map((v) => [v.productId, v.aantalBon])).toEqual([
      ["cola", 576],
      ["zero-groot", 72],
    ]);
  });

  it("zoekt alleen bij de eigen leverancier", () => {
    const [regel] = bonNaarVoorstel(
      bon([{ artikelnummer: "200084", omschrijving: "x", besteld: 1, uitgeleverd: 1 }]),
      "Bidfood",
      artikelen
    );
    expect(regel.productId).toBe("iets-anders");
  });

  it("laat een onbekend artikel open, in eenheden van de bon", () => {
    const [regel] = bonNaarVoorstel(
      bon([{ artikelnummer: "205570", omschrijving: "Chaudf. Blauw Crate 12x100", besteld: 3, uitgeleverd: 3 }]),
      "Swinkels",
      artikelen
    );
    expect(regel.productId).toBeUndefined();
    expect(regel.eenheden).toBe(3);
    expect(regel.aantalBon).toBe(3);
  });

  it("valt terug op besteld als uitgeleverd niet te lezen was", () => {
    const [regel] = bonNaarVoorstel(
      bon([{ artikelnummer: "200084", omschrijving: "x", besteld: 2, uitgeleverd: null }]),
      "Swinkels",
      artikelen
    );
    expect(regel.aantalBon).toBe(48);
  });

  it("uitgeleverd gaat voor besteld", () => {
    const [regel] = bonNaarVoorstel(
      bon([{ artikelnummer: "200084", omschrijving: "x", besteld: 13, uitgeleverd: 12 }]),
      "Swinkels",
      artikelen
    );
    expect(regel.eenheden).toBe(12);
  });
});

describe("herkenLeverancier", () => {
  const bekend = ["Swinkels", "Bidfood"] as const;
  it("herkent de naam ook in een langere kop", () => {
    expect(herkenLeverancier("Swinkels Family Brewers", bekend)).toBe("Swinkels");
    expect(herkenLeverancier("BIDFOOD", bekend)).toBe("Bidfood");
  });
  it("geeft niets bij een onbekende leverancier", () => {
    expect(herkenLeverancier("Heineken", bekend)).toBeUndefined();
    expect(herkenLeverancier(null, bekend)).toBeUndefined();
  });
});

describe("normaliseerArtikelnummer", () => {
  it("negeert voorloopnullen en spaties", () => {
    expect(normaliseerArtikelnummer("0118573")).toBe("118573");
    expect(normaliseerArtikelnummer(" 118 573 ")).toBe("118573");
    expect(normaliseerArtikelnummer("0")).toBe("0");
  });
});

describe("standaardStuksPerEenheid", () => {
  const basis: Product = {
    id: "p", naam: "Coca Cola 0,2 L", categorie: "fris", inkoopprijs: 0, eenheid: "fles",
    stuksPerVerpakking: 24, verpakking: "krat", alleenPerVerpakking: true,
    statiegeldPerStuk: 0, statiegeldPerVerpakking: 0, voorraadloos: false, voorPersoneel: false,
  };
  it("neemt de krat van het product", () => {
    expect(standaardStuksPerEenheid(basis)).toBe(24);
  });
  it("is 1 zonder verpakking of product", () => {
    expect(standaardStuksPerEenheid({ ...basis, verpakking: undefined, stuksPerVerpakking: 1 })).toBe(1);
    expect(standaardStuksPerEenheid(undefined)).toBe(1);
  });
});
