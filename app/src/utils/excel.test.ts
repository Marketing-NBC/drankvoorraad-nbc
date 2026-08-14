import { describe, expect, it } from "vitest";
import { bouwWorkbook } from "./excel";

interface Rij {
  product: string;
  aantal: number;
  prijs: number;
  datum: Date;
}

const rijen: Rij[] = [
  { product: "Heineken Pils fust 50L", aantal: 6, prijs: 85, datum: new Date("2026-03-12T09:00:00Z") },
  { product: "Chardonnay huiswijn fles", aantal: 40, prijs: 6.5, datum: new Date("2026-03-12T09:10:00Z") },
];

async function maakBlad(metTotalen = false) {
  const wb = await bouwWorkbook<Rij>({
    titel: "Testexport",
    ondertitel: "2 regels",
    rijen,
    kolommen: [
      { header: "Product", value: (r) => r.product },
      { header: "Aantal", opmaak: "getal", value: (r) => r.aantal },
      { header: "Inkoopprijs", opmaak: "bedrag", value: (r) => r.prijs },
      { header: "Datum", opmaak: "datum", value: (r) => r.datum },
    ],
    ...(metTotalen ? { totalen: { 0: "Totaal", 2: 91.5 } } : {}),
  });
  return wb.getWorksheet("Testexport")!;
}

describe("Excel-export", () => {
  it("zet titel, ondertitel en exportdatum boven de tabel", async () => {
    const blad = await maakBlad();
    expect(blad.getCell(1, 1).value).toBe("Testexport");
    expect(blad.getCell(2, 1).value).toBe("2 regels");
    expect(String(blad.getCell(3, 1).value)).toContain("Geëxporteerd op");
  });

  it("geeft de kopregel de NBC-teal met witte vette tekst", async () => {
    const blad = await maakBlad();
    const kop = blad.getCell(4, 1);
    expect(kop.value).toBe("Product");
    expect((kop.fill as { fgColor: { argb: string } }).fgColor.argb).toBe("FF229D96");
    expect(kop.font?.bold).toBe(true);
    expect(kop.font?.color?.argb).toBe("FFFFFFFF");
    expect(kop.font?.name).toBe("Area Normal");
  });

  it("gebruikt euro-notatie voor bedragen en duizendtallen voor getallen", async () => {
    const blad = await maakBlad();
    expect(blad.getCell(5, 3).numFmt).toBe("€ #,##0.00");
    expect(blad.getCell(5, 2).numFmt).toBe("#,##0");
    expect(blad.getCell(5, 4).numFmt).toBe("dd-mm-yyyy hh:mm");
  });

  it("bewaart datums als echte datumwaarden, niet als tekst", async () => {
    const blad = await maakBlad();
    expect(blad.getCell(5, 4).value).toBeInstanceOf(Date);
  });

  it("streept om en om een rij in cream", async () => {
    const blad = await maakBlad();
    expect(blad.getCell(5, 1).fill).toBeUndefined();
    expect((blad.getCell(6, 1).fill as { fgColor: { argb: string } }).fgColor.argb).toBe("FFFAF2E8");
  });

  it("bevriest de kopregel en zet een filter op de tabel", async () => {
    const blad = await maakBlad();
    expect(blad.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });
    expect(blad.autoFilter).toMatchObject({ from: { row: 4, column: 1 }, to: { row: 6, column: 4 } });
  });

  it("zet een totaalregel onder de gegevens wanneer die is meegegeven", async () => {
    const blad = await maakBlad(true);
    expect(blad.getCell(7, 1).value).toBe("Totaal");
    expect(blad.getCell(7, 3).value).toBe(91.5);
    expect(blad.getCell(7, 3).numFmt).toBe("€ #,##0.00");
  });

  it("past de kolombreedte aan op de langste waarde", async () => {
    const blad = await maakBlad();
    // "Chardonnay huiswijn fles" is 24 tekens; breedte mag niet op het minimum blijven staan.
    expect(blad.getColumn(1).width).toBeGreaterThan(20);
    expect(blad.getColumn(1).width).toBeLessThanOrEqual(46);
  });
});
