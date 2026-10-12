import { describe, expect, it } from "vitest";
import swinkelsBon from "./__fixtures__/afleverbon-swinkels-2026-10-02.txt?raw";
import { bijnaGelijk, bonNaarVoorstel } from "./bon";
import { leesArtikelregel, leesBonTekst } from "./bonTekst";
import type { LeverancierArtikel } from "./types";

/* De fixture is de echte uitvoer van Tesseract op een telefoonfoto van de
   afleverbon van Swinkels van 2 oktober 2026 — gekreukt, met ruis van de
   vouw, gelezen met dezelfde instellingen als src/lib/bonHerkenning.ts. */

describe("leesBonTekst op de echte bon van Swinkels", () => {
  const bon = leesBonTekst(swinkelsBon);

  it("vindt leverancier, bonnummer en datum", () => {
    expect(bon.leverancier).toBe("Swinkels");
    expect(bon.bonnummer).toBe("800758649");
    expect(bon.datum).toBe("2026-10-02");
  });

  it("vindt alle twaalf regels met de juiste aantallen", () => {
    expect(bon.regels.map((r) => [r.artikelnummer, r.uitgeleverd])).toEqual([
      ["118573", 12],
      ["117919", 24],
      ["200084", 24],
      ["206110", 48],
      ["216410", 6],
      ["216418", 4],
      ["213774", 12],
      ["213770", 13],
      ["205570", 3],
      ["217335", 12],
      ["224865", 5],
      // 108244 op de bon; de herkenning las een 4 voor de 1. Zie hieronder.
      ["408244", 16],
    ]);
  });

  it("haalt de omschrijving zonder ruis eruit", () => {
    expect(bon.regels[0].omschrijving).toBe("Swinckels 0.0 Crate 4x6x30");
    expect(bon.regels[8].omschrijving).toBe("Chaudf. Blauw Crate 12x100");
  });

  it("twijfelt waar de aantallen niet netjes naast elkaar stonden", () => {
    const chaudfontaine = bon.regels.find((r) => r.artikelnummer === "205570");
    expect(chaudfontaine?.onzeker).toBe(true);
    expect(bon.regels[0].onzeker).toBe(false);
  });

  it("koppelt het verkeerd gelezen artikelnummer aan het bekende, met twijfel", () => {
    const artikelen: LeverancierArtikel[] = [
      { leverancier: "Swinkels", artikelnummer: "108244", productId: "fust", stuksPerEenheid: 1 },
    ];
    const voorstel = bonNaarVoorstel(bon, "Swinkels", artikelen);
    const fust = voorstel.find((v) => v.regel.artikelnummer === "408244");
    expect(fust?.productId).toBe("fust");
    expect(fust?.aantalBon).toBe(16);
    expect(fust?.onzeker).toBe(true);
  });
});

describe("leesArtikelregel", () => {
  it("leest een S als 5 in de aantallen", () => {
    const regel = leesArtikelregel("-   Jao   224865 Minute Maid Orange Nectar Crate Bot24x208,   !   S   S");
    expect(regel?.uitgeleverd).toBe(5);
    expect(regel?.onzeker).toBe(false);
  });

  it("negeert de regel met volgnummers van ladingdragers", () => {
    expect(leesArtikelregel("4  i  112976 112.983 112.990 113.003 113.010")).toBeNull();
  });

  it("negeert regels zonder artikelnummer", () => {
    expect(leesArtikelregel("Levering  SFB ordernummer  Referentie")).toBeNull();
    expect(leesArtikelregel("7200 x 80,00 x 16500 = RCB |Rolcontainer Swinkels Blauw 8")).toBeNull();
  });

  it("neemt bij twee verschillende getallen de laatste als uitgeleverd, met twijfel", () => {
    const regel = leesArtikelregel("80 213770 Fuze Tea Green Tea Crate 24x20 13 12");
    expect(regel?.besteld).toBe(13);
    expect(regel?.uitgeleverd).toBe(12);
    expect(regel?.onzeker).toBe(true);
  });
});

describe("bijnaGelijk", () => {
  it("vindt het enige nummer dat één cijfer afwijkt", () => {
    expect(bijnaGelijk("408244", ["108244", "118573"])).toBe("108244");
  });
  it("kiest niet als er twee kandidaten zijn of geen", () => {
    expect(bijnaGelijk("100000", ["100001", "100002"])).toBeUndefined();
    expect(bijnaGelijk("999999", ["108244"])).toBeUndefined();
  });
});
