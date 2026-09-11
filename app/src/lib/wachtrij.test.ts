import { beforeEach, describe, expect, it } from "vitest";
import {
  bewaarWachtrij,
  haalUitWachtrij,
  isAlBinnen,
  isNetwerkfout,
  leesWachtrij,
  nieuwKenmerk,
  voegToeAanWachtrij,
  werkItemBij,
  type WachtrijItem,
} from "./wachtrij";

function item(velden: Partial<WachtrijItem> = {}): WachtrijItem {
  return {
    id: nieuwKenmerk(),
    soort: "mutatie",
    gebruikerId: "u1",
    omschrijving: "4 kratten Coca Cola 0,2 L naar Koelcel NBC",
    payload: { productId: "p1", aantal: 96 },
    aangemaaktOp: new Date().toISOString(),
    pogingen: 0,
    ...velden,
  };
}

beforeEach(() => bewaarWachtrij([]));

describe("de wachtrij bewaren", () => {
  it("houdt items vast en geeft ze in volgorde terug", () => {
    const eerste = item({ omschrijving: "eerste" });
    const tweede = item({ omschrijving: "tweede" });
    voegToeAanWachtrij(eerste);
    voegToeAanWachtrij(tweede);
    expect(leesWachtrij().map((i) => i.omschrijving)).toEqual(["eerste", "tweede"]);
  });

  it("haalt alleen het verstuurde item eruit", () => {
    const blijft = item({ omschrijving: "blijft" });
    const gaatWeg = item({ omschrijving: "weg" });
    voegToeAanWachtrij(blijft);
    voegToeAanWachtrij(gaatWeg);
    expect(haalUitWachtrij(gaatWeg.id).map((i) => i.omschrijving)).toEqual(["blijft"]);
  });

  it("onthoudt een mislukte poging bij het item zelf", () => {
    const wacht = item();
    voegToeAanWachtrij(wacht);
    const na = werkItemBij(wacht.id, { pogingen: 2, laatsteFout: "geen verbinding" });
    expect(na[0].pogingen).toBe(2);
    expect(na[0].laatsteFout).toBe("geen verbinding");
  });

  it("geeft elk item een eigen kenmerk", () => {
    const kenmerken = new Set(Array.from({ length: 50 }, () => nieuwKenmerk()));
    expect(kenmerken.size).toBe(50);
  });
});

describe("isNetwerkfout", () => {
  it("herkent de meldingen die een haperende verbinding geeft", () => {
    expect(isNetwerkfout(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetwerkfout({ message: "NetworkError when attempting to fetch resource." })).toBe(true);
    expect(isNetwerkfout({ message: "Load failed" })).toBe(true);
  });

  it("houdt een weigering van de server géén netwerkfout", () => {
    // Zou dit als netwerkfout gelden, dan bleef een boeking die nooit mag
    // slagen eeuwig in de wachtrij staan.
    expect(isNetwerkfout({ code: "42501", message: "Geen rechten om een levering aan te nemen." })).toBe(false);
    expect(isNetwerkfout({ message: "Personeelsverbruik hoort niet bij een evenement." })).toBe(false);
  });
});

describe("isAlBinnen", () => {
  it("herkent de botsing op het kenmerk van de telefoon", () => {
    expect(isAlBinnen({ code: "23505", message: 'duplicate key value violates unique constraint "mutaties_client_uniek"' })).toBe(true);
  });

  it("verwart hem niet met een andere fout", () => {
    expect(isAlBinnen({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isAlBinnen(null)).toBe(false);
  });
});
