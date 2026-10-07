import { describe, expect, it } from "vitest";
import {
  eenheidLabel,
  heeftVerpakking,
  invoer,
  aantalTegenMinimum,
  eenheidVan,
  invoerNaarStuks,
  isHeleVerpakkingen,
  losOpLocatie,
  stuksNaarInvoer,
  omschrijfAantal,
  statiegeldWaarde,
  stuksNaarVerpakkingen,
  verpakkingLabel,
  verpakkingenNaarStuks,
} from "./verpakking";
import type { Locatie, Product } from "./types";

function product(velden: Partial<Product> & Pick<Product, "id" | "naam">): Product {
  return {
    categorie: "fris",
    inkoopprijs: 0,
    eenheid: "fles",
    stuksPerVerpakking: 1,
    alleenPerVerpakking: false,
    statiegeldPerStuk: 0,
    statiegeldPerVerpakking: 0,
    voorraadloos: false,
    ...velden,
  };
}

/** Het flesje van 0,2 L: gaat altijd per krat van 24, nooit los. */
const flesje = product({
  id: "p1",
  naam: "Coca Cola 0,2 L",
  inhoud: "0,2 L",
  inkoopprijs: 0.46,
  verpakking: "krat",
  stuksPerVerpakking: 24,
  alleenPerVerpakking: true,
  statiegeldPerVerpakking: 5,
});

/** De grote fles: los, met statiegeld per stuk. */
const petfles = product({
  id: "p2",
  naam: "Coca Cola 1,25 L",
  inhoud: "1,25 L",
  inkoopprijs: 2.05,
  statiegeldPerStuk: 0.25,
});

/** Spa zit in een krat van 12, maar mag wel los. */
const spa = product({
  id: "p3",
  naam: "Spa blauw 1 L",
  inkoopprijs: 0.95,
  verpakking: "krat",
  stuksPerVerpakking: 12,
  statiegeldPerVerpakking: 5,
});

describe("heeftVerpakking", () => {
  it("vraagt om zowel een naam als meer dan één stuk", () => {
    expect(heeftVerpakking(flesje)).toBe(true);
    expect(heeftVerpakking(petfles)).toBe(false);
    expect(heeftVerpakking(product({ id: "x", naam: "Los", verpakking: "krat" }))).toBe(false);
  });
});

describe("omrekenen", () => {
  it("rekent stuks naar verpakkingen en terug", () => {
    expect(stuksNaarVerpakkingen(flesje, 96)).toBe(4);
    expect(verpakkingenNaarStuks(flesje, 4)).toBe(96);
  });

  it("laat een product zonder verpakking ongemoeid", () => {
    expect(stuksNaarVerpakkingen(petfles, 7)).toBe(7);
    expect(verpakkingenNaarStuks(petfles, 7)).toBe(7);
  });

  it("herkent een aantal dat niet in hele kratten past", () => {
    expect(isHeleVerpakkingen(flesje, 96)).toBe(true);
    expect(isHeleVerpakkingen(flesje, 100)).toBe(false);
    expect(isHeleVerpakkingen(petfles, 7)).toBe(true);
  });
});

describe("omschrijfAantal", () => {
  it("toont kratten bij een product dat nooit los gaat", () => {
    expect(omschrijfAantal(flesje, 96)).toBe("4 kratten");
    expect(omschrijfAantal(flesje, 24)).toBe("1 krat");
  });

  it("laat een rest staan in plaats van hem weg te ronden", () => {
    // Kan voorkomen: een koelkast wordt met losse flesjes gevuld.
    expect(omschrijfAantal(flesje, 100)).toBe("4 kratten + 4");
    expect(omschrijfAantal(flesje, 12)).toBe("12 los");
  });

  it("laat nul gewoon nul zijn", () => {
    // "0 los" leest als een halve krat die er niet is.
    expect(omschrijfAantal(flesje, 0)).toBe("0");
    expect(omschrijfAantal(spa, 0)).toBe("0");
  });

  it("houdt stuks voorop bij een product dat wel los mag", () => {
    expect(omschrijfAantal(spa, 24)).toBe("24 (2 kratten)");
    expect(omschrijfAantal(spa, 25)).toBe("25");
    expect(omschrijfAantal(petfles, 7)).toBe("7");
  });
});

describe("verpakkingLabel", () => {
  it("beschrijft de verpakking inclusief inhoud", () => {
    expect(verpakkingLabel(flesje)).toBe("krat van 24 × 0,2 L");
    expect(verpakkingLabel(spa)).toBe("krat van 12");
    expect(verpakkingLabel(petfles)).toBe("fles");
  });
});

describe("eenheidLabel", () => {
  it("zet de inhoud achter de eenheid", () => {
    expect(eenheidLabel(petfles)).toBe("fles 1,25 L");
  });

  it("herhaalt de eenheid niet als de inhoud hetzelfde woord is", () => {
    const koffie = product({ id: "p9", naam: "Koffie", eenheid: "kop", inhoud: "kop" });
    expect(eenheidLabel(koffie)).toBe("kop");
    expect(eenheidLabel(product({ id: "p8", naam: "Thee", eenheid: "kop" }))).toBe("kop");
  });
});

describe("statiegeldWaarde", () => {
  it("telt de borg per verpakking", () => {
    expect(statiegeldWaarde(flesje, 96)).toBe(20);
  });

  it("telt de borg per stuk", () => {
    expect(statiegeldWaarde(petfles, 4)).toBe(1);
  });

  it("rekent een halve krat als een halve borg", () => {
    // Geen echt bedrag — je krijgt geen halve krat borg terug — maar wel de
    // eerlijkste benadering zolang niet besloten is hoe emballage terugkomt.
    expect(statiegeldWaarde(flesje, 12)).toBe(2.5);
  });
});

describe("invoer", () => {
  it("laat kratten invullen bij een product dat nooit los gaat", () => {
    expect(invoer(flesje)).toEqual({
      label: "Aantal kratten",
      eenheid: "krat van 24 × 0,2 L",
      factor: 24,
    });
  });

  it("laat stuks invullen zodra een product ook los mag", () => {
    expect(invoer(spa).factor).toBe(1);
    expect(invoer(petfles).factor).toBe(1);
  });
});

describe("kantine en kroeg: per stuk", () => {
  const magazijn: Locatie = { id: "l0", naam: "Hoofdmagazijn", type: "magazijn", merk: null, voorPersoneel: false };
  const kantine: Locatie = { id: "l9", naam: "Kantine", type: "kantine", merk: "NBC", voorPersoneel: true };

  it("werkt per stuk zodra een kantine of kroeg meedoet", () => {
    expect(losOpLocatie(magazijn)).toBe(false);
    expect(losOpLocatie(magazijn, kantine)).toBe(true);
    expect(losOpLocatie(undefined, null)).toBe(false);
  });

  it("laat 12 losse flesjes invullen in plaats van een halve krat", () => {
    const vorm = invoer(flesje, { los: true });
    expect(vorm.factor).toBe(1);
    expect(vorm.label).toBe("Aantal");
    expect(12 * vorm.factor).toBe(12);
  });

  it("toont de stand in flesjes in plaats van kratten plus rest", () => {
    expect(omschrijfAantal(flesje, 31, { los: true })).toBe("31");
    expect(omschrijfAantal(flesje, 31)).toBe("1 krat + 7");
  });
});

describe("minimum in kratten", () => {
  it("laat het minimum in kratten invullen en slaat stuks op", () => {
    expect(stuksNaarInvoer(flesje, 1152)).toBe(48);
    expect(invoerNaarStuks(flesje, 48)).toBe(1152);
  });

  it("houdt een product dat los mag in stuks", () => {
    expect(stuksNaarInvoer(spa, 120)).toBe(120);
    expect(invoerNaarStuks(spa, 120)).toBe(120);
  });

  it("laat een oud minimum dat geen hele kratten is zien zoals het is", () => {
    expect(stuksNaarInvoer(flesje, 30)).toBe(1.25);
    expect(invoerNaarStuks(flesje, 1.25)).toBe(30);
  });

  it("werkt in de kantine en kroeg gewoon per flesje", () => {
    expect(stuksNaarInvoer(flesje, 12, { los: true })).toBe(12);
  });

  it("zet voorraad en minimum in dezelfde eenheid", () => {
    expect(aantalTegenMinimum(flesje, 0, 1728)).toBe("0 van 72 kratten");
    expect(aantalTegenMinimum(flesje, 48, 1152)).toBe("2 kratten van 48 kratten");
    expect(aantalTegenMinimum(spa, 0, 120)).toBe("0 van 120");
    expect(aantalTegenMinimum(flesje, 5, 24, { los: true })).toBe("5 van 24");
  });
});

describe("eenheidVan", () => {
  it("zet de eenheid in het meervoud bij meer dan één", () => {
    expect(eenheidVan(petfles, 120)).toBe("flessen");
    expect(eenheidVan(petfles, 1)).toBe("fles");
    expect(eenheidVan(product({ id: "f", naam: "Fust", eenheid: "fust" }), 32)).toBe("fusten");
  });

  it("laat een onbekende eenheid zoals hij is", () => {
    expect(eenheidVan(product({ id: "t", naam: "Tray", eenheid: "tray" }), 6)).toBe("tray");
  });
});
