import type { Product } from "./types";

/**
 * Rekenen met verpakkingen.
 *
 * De hele app rekent in stuks: de voorraad, de mutaties, de tellingen. Een
 * verpakking verandert daar niets aan — hij bepaalt alleen hoe er ingevoerd
 * en getoond wordt. Bij de flesjes van 0,2 L wil NBC nooit losse flesjes
 * hoeven boeken; die gaan per krat van 24 in en uit.
 *
 * Waarom niet gewoon "het product ís een krat"? Omdat een koelkast met 12
 * flesjes gevuld wordt en niet met een halve krat. In stuks rekenen en in
 * kratten invoeren is het enige dat allebei aankan.
 */

/** Meervoud van de verpakkingsnaam. Onbekende namen krijgen "3 × doos". */
const meervoud: Record<string, string> = {
  krat: "kratten",
  fust: "fusten",
  doos: "dozen",
  tray: "trays",
  pallet: "pallets",
};

export function heeftVerpakking(product: Product): boolean {
  return Boolean(product.verpakking) && product.stuksPerVerpakking > 1;
}

/** Aantal verpakkingen in een aantal stuks. Kan een halve krat opleveren. */
export function stuksNaarVerpakkingen(product: Product, stuks: number): number {
  if (!heeftVerpakking(product)) return stuks;
  return stuks / product.stuksPerVerpakking;
}

export function verpakkingenNaarStuks(product: Product, aantal: number): number {
  if (!heeftVerpakking(product)) return aantal;
  return aantal * product.stuksPerVerpakking;
}

/** Past dit aantal stuks precies in hele verpakkingen? */
export function isHeleVerpakkingen(product: Product, stuks: number): boolean {
  if (!heeftVerpakking(product)) return true;
  return stuks % product.stuksPerVerpakking === 0;
}

/** "krat van 24 × 0,2 L" — de uitleg bij een invoerveld. */
export function verpakkingLabel(product: Product): string {
  if (!heeftVerpakking(product)) return product.eenheid;
  const inhoud = product.inhoud ? ` × ${product.inhoud}` : "";
  return `${product.verpakking} van ${product.stuksPerVerpakking}${inhoud}`;
}

/**
 * De eenheid zoals hij op het scherm hoort: "fles 0,7 L", maar gewoon "kop"
 * wanneer de inhoud niets toevoegt aan de eenheid.
 */
export function eenheidLabel(product: Product): string {
  if (!product.inhoud || product.inhoud === product.eenheid) return product.eenheid;
  return `${product.eenheid} ${product.inhoud}`;
}

function meervoudVan(naam: string, aantal: number): string {
  if (aantal === 1) return naam;
  return meervoud[naam] ?? `× ${naam}`;
}

/**
 * Voorraad zoals hij op het scherm hoort te staan.
 *
 * Bij een product dat alleen per krat gaat is "4 kratten" het getal waar
 * iemand in het magazijn iets aan heeft; 96 zegt hem niets. Blijft er een
 * rest over — wat kan, want een koelkast wordt met losse flesjes gevuld —
 * dan staat die er expliciet bij in plaats van dat hij wegvalt.
 */
export function omschrijfAantal(product: Product, stuks: number): string {
  if (!heeftVerpakking(product)) return String(stuks);

  const heel = Math.floor(stuks / product.stuksPerVerpakking);
  const rest = stuks - heel * product.stuksPerVerpakking;

  if (!product.alleenPerVerpakking) {
    return heel > 0 && rest === 0
      ? `${stuks} (${heel} ${meervoudVan(product.verpakking!, heel)})`
      : String(stuks);
  }

  if (heel === 0) return `${rest} los`;
  const kern = `${heel} ${meervoudVan(product.verpakking!, heel)}`;
  return rest === 0 ? kern : `${kern} + ${rest}`;
}

/**
 * Statiegeld over een aantal stuks: per stuk plus per verpakking.
 *
 * Een halve krat levert een half kratstatiegeld op. Dat is geen echt bedrag —
 * je krijgt geen halve krat borg terug — maar het is wel de eerlijkste
 * benadering zolang niet besloten is hoe emballage terugkomt. Zodra dat
 * besloten is, rekent de emballageadministratie met hele verpakkingen en is
 * dit alleen nog een indicatie.
 */
export function statiegeldWaarde(product: Product, stuks: number): number {
  const perStuk = stuks * product.statiegeldPerStuk;
  const perVerpakking = heeftVerpakking(product)
    ? (stuks / product.stuksPerVerpakking) * product.statiegeldPerVerpakking
    : stuks * product.statiegeldPerVerpakking;
  return perStuk + perVerpakking;
}

/**
 * Hoe een aantal ingevoerd wordt: in kratten of in stuks.
 *
 * `factor` is waarmee de invoer vermenigvuldigd wordt om op stuks uit te
 * komen. Alleen producten die nooit los gaan wijken af; de rest wordt gewoon
 * in stuks ingevoerd, ook als er een krat omheen zit.
 */
export function invoer(product: Product): { label: string; eenheid: string; factor: number } {
  if (product.alleenPerVerpakking && heeftVerpakking(product)) {
    return {
      label: `Aantal ${meervoudVan(product.verpakking!, 2)}`,
      eenheid: verpakkingLabel(product),
      factor: product.stuksPerVerpakking,
    };
  }
  return { label: "Aantal", eenheid: product.eenheid, factor: 1 };
}
