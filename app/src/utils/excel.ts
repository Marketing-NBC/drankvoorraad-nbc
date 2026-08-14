/**
 * Excel-export in NBC-huisstijl.
 *
 * ExcelJS wordt bewust dynamisch geladen (zie `laadExcelJS`): het is een fors
 * pakket, en zonder die splitsing zou iedereen het bij elke paginabezoek
 * meedownloaden terwijl exporteren maar zelden gebeurt.
 */
import type { Alignment, Borders, Fill, Font } from "exceljs";

/** Kleuren uit tokens/colors.css, als ARGB (Excel-notatie: alpha vooraan). */
const KLEUR = {
  teal: "FF229D96",
  tealDonker: "FF165E5A",
  cream: "FFF2E6DA",
  creamLicht: "FFFAF2E8",
  wit: "FFFFFFFF",
  inkt: "FF21282B",
  steen: "FF596165",
  steenLicht: "FFD9E0E2",
  goud: "FFF6A304",
  rood: "FFC0392B",
} as const;

const FONT_BODY = "Area Normal";
const FONT_DISPLAY = "Pockota";

export type KolomOpmaak = "tekst" | "getal" | "bedrag" | "datum";

export interface ExcelKolom<T> {
  header: string;
  opmaak?: KolomOpmaak;
  breedte?: number;
  value: (row: T) => string | number | Date | null;
}

export interface ExcelOpties<T> {
  bestandsnaam: string;
  /** Titel boven de tabel, bijv. "Voorraadmutaties". */
  titel: string;
  /** Optionele regel onder de titel, bijv. de evenementnaam of een filter. */
  ondertitel?: string;
  kolommen: ExcelKolom<T>[];
  rijen: T[];
  /** Optionele totaalregel onderaan, per kolomindex een waarde. */
  totalen?: Record<number, string | number>;
}

async function laadExcelJS() {
  const mod = await import("exceljs");
  return mod.default ?? mod;
}

function randOnder(kleur: string): Partial<Borders> {
  return { bottom: { style: "thin", color: { argb: kleur } } };
}

/**
 * Bouwt het werkboek op. Los van het downloaden gehouden zodat de opmaak
 * (kleuren, getalnotaties, bevroren kopregel) in een test controleerbaar is
 * zonder browser.
 */
export async function bouwWorkbook<T>({
  titel,
  ondertitel,
  kolommen,
  rijen,
  totalen,
}: Omit<ExcelOpties<T>, "bestandsnaam">) {
  const ExcelJS = await laadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NBC / Green Village — Drankvoorraad";
  workbook.created = new Date();

  const blad = workbook.addWorksheet(titel.slice(0, 31), {
    views: [{ state: "frozen", ySplit: ondertitel ? 4 : 3 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const laatsteKolom = kolommen.length;

  // ─── Titelblok ─────────────────────────────────────────────────────
  blad.mergeCells(1, 1, 1, laatsteKolom);
  const titelCel = blad.getCell(1, 1);
  titelCel.value = titel;
  titelCel.font = { name: FONT_DISPLAY, size: 20, bold: false, color: { argb: KLEUR.inkt } } as Font;
  titelCel.alignment = { vertical: "middle" } as Alignment;
  blad.getRow(1).height = 32;

  let rijIndex = 2;
  if (ondertitel) {
    blad.mergeCells(rijIndex, 1, rijIndex, laatsteKolom);
    const sub = blad.getCell(rijIndex, 1);
    sub.value = ondertitel;
    sub.font = { name: FONT_BODY, size: 11, color: { argb: KLEUR.steen } } as Font;
    rijIndex++;
  }

  blad.mergeCells(rijIndex, 1, rijIndex, laatsteKolom);
  const datumCel = blad.getCell(rijIndex, 1);
  datumCel.value = `Geëxporteerd op ${new Intl.DateTimeFormat("nl-NL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date())}`;
  datumCel.font = { name: FONT_BODY, size: 9, color: { argb: KLEUR.steen } } as Font;
  rijIndex++;

  // ─── Kopregel ──────────────────────────────────────────────────────
  const kopRij = blad.getRow(rijIndex);
  kolommen.forEach((kolom, i) => {
    const cel = kopRij.getCell(i + 1);
    cel.value = kolom.header;
    cel.font = { name: FONT_BODY, size: 10, bold: true, color: { argb: KLEUR.wit } } as Font;
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KLEUR.teal } } as Fill;
    cel.alignment = {
      vertical: "middle",
      horizontal: kolom.opmaak === "getal" || kolom.opmaak === "bedrag" ? "right" : "left",
    } as Alignment;
  });
  kopRij.height = 22;
  const kopRijIndex = rijIndex;
  rijIndex++;

  // ─── Gegevensrijen ─────────────────────────────────────────────────
  rijen.forEach((rij, r) => {
    const excelRij = blad.getRow(rijIndex);
    const oneven = r % 2 === 1;

    kolommen.forEach((kolom, i) => {
      const cel = excelRij.getCell(i + 1);
      const waarde = kolom.value(rij);
      cel.value = waarde;

      cel.font = { name: FONT_BODY, size: 10, color: { argb: KLEUR.inkt } } as Font;
      if (oneven) {
        cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KLEUR.creamLicht } } as Fill;
      }
      cel.border = randOnder(KLEUR.steenLicht);

      if (kolom.opmaak === "bedrag") {
        cel.numFmt = '€ #,##0.00';
        cel.alignment = { horizontal: "right" } as Alignment;
      } else if (kolom.opmaak === "getal") {
        cel.numFmt = "#,##0";
        cel.alignment = { horizontal: "right" } as Alignment;
      } else if (kolom.opmaak === "datum") {
        cel.numFmt = "dd-mm-yyyy hh:mm";
        cel.alignment = { horizontal: "left" } as Alignment;
      } else {
        cel.alignment = { horizontal: "left", wrapText: false } as Alignment;
      }
    });
    rijIndex++;
  });

  // ─── Totaalregel ───────────────────────────────────────────────────
  if (totalen) {
    const totaalRij = blad.getRow(rijIndex);
    kolommen.forEach((kolom, i) => {
      const cel = totaalRij.getCell(i + 1);
      const waarde = totalen[i];
      if (waarde !== undefined) cel.value = waarde;
      cel.font = { name: FONT_BODY, size: 10, bold: true, color: { argb: KLEUR.tealDonker } } as Font;
      cel.border = { top: { style: "medium", color: { argb: KLEUR.teal } } } as Partial<Borders>;
      if (kolom.opmaak === "bedrag") {
        cel.numFmt = '€ #,##0.00';
        cel.alignment = { horizontal: "right" } as Alignment;
      } else if (kolom.opmaak === "getal") {
        cel.numFmt = "#,##0";
        cel.alignment = { horizontal: "right" } as Alignment;
      }
    });
    totaalRij.height = 20;
  }

  // ─── Kolombreedtes en filter ───────────────────────────────────────
  kolommen.forEach((kolom, i) => {
    if (kolom.breedte) {
      blad.getColumn(i + 1).width = kolom.breedte;
      return;
    }
    // Breedte op basis van de langste inhoud, met een boven- en ondergrens.
    const langste = rijen.reduce((max, rij) => {
      const w = kolom.value(rij);
      const lengte = w instanceof Date ? 16 : String(w ?? "").length;
      return Math.max(max, lengte);
    }, kolom.header.length);
    blad.getColumn(i + 1).width = Math.min(46, Math.max(10, langste + 3));
  });

  if (rijen.length > 0) {
    blad.autoFilter = {
      from: { row: kopRijIndex, column: 1 },
      to: { row: kopRijIndex + rijen.length, column: laatsteKolom },
    };
  }

  return workbook;
}

export async function exporteerNaarExcel<T>(opties: ExcelOpties<T>): Promise<void> {
  const { bestandsnaam } = opties;
  const workbook = await bouwWorkbook(opties);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = bestandsnaam.endsWith(".xlsx") ? bestandsnaam : `${bestandsnaam}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
