import type { Locatie, Product } from "./types";

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

/** "krat" of "kratten", "doos" of "dozen" — afhankelijk van het aantal. */
export function meervoudVan(naam: string, aantal: number): string {
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
export function omschrijfAantal(
  product: Product,
  stuks: number,
  opties: { los?: boolean } = {}
): string {
  if (!heeftVerpakking(product) || stuks === 0) return String(stuks);
  // In de kantine en de kroeg telt iedereen flesjes; zie losOpLocatie.
  if (opties.los) return String(stuks);

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
 * Wordt er op deze locaties per stuk geteld en gevuld, ook bij een product
 * dat in het magazijn alleen per krat gaat?
 *
 * Ja zodra er een kantine of kroeg bij betrokken is. Daar staat een koelkast
 * die met losse flesjes bijgevuld wordt, en het personeel pakt ze er ook los
 * uit — een tekort van 7 flesjes is daar gewoon 7 flesjes, geen 0,29 krat.
 * Het magazijn zelf blijft per krat werken.
 */
export function losOpLocatie(...locaties: (Locatie | null | undefined)[]): boolean {
  return locaties.some((l) => l?.voorPersoneel === true);
}

/**
 * Hoe een aantal ingevoerd wordt: in kratten of in stuks.
 *
 * `factor` is waarmee de invoer vermenigvuldigd wordt om op stuks uit te
 * komen. Alleen producten die nooit los gaan wijken af; de rest wordt gewoon
 * in stuks ingevoerd, ook als er een krat omheen zit.
 *
 * `los` zet het per-krat-invoeren uit — voor de kantine en de kroeg, zie
 * `losOpLocatie`.
 */
export function invoer(
  product: Product,
  opties: { los?: boolean } = {}
): { label: string; eenheid: string; factor: number } {
  if (!opties.los && product.alleenPerVerpakking && heeftVerpakking(product)) {
    return {
      label: `Aantal ${meervoudVan(product.verpakking!, 2)}`,
      eenheid: verpakkingLabel(product),
      factor: product.stuksPerVerpakking,
    };
  }
  return { label: "Aantal", eenheid: product.eenheid, factor: 1 };
}

/**
 * Een aantal dat in een veld getypt wordt (kratten of stuks, zie `invoer`)
 * terug naar stuks. Afgerond: 1,5 krat van 24 is 36, geen 36,0000001.
 */
export function invoerNaarStuks(product: Product, ingevoerd: number, opties: { los?: boolean } = {}): number {
  return Math.round(ingevoerd * invoer(product, opties).factor);
}

/** Omgekeerd: stuks zoals ze in het invoerveld horen te staan. */
export function stuksNaarInvoer(product: Product, stuks: number, opties: { los?: boolean } = {}): number {
  const factor = invoer(product, opties).factor;
  return Math.round((stuks / factor) * 100) / 100;
}

/**
 * "0 van 72 kratten" — voorraad tegen het minimum, in de eenheid waarin het
 * magazijn denkt. Bij een product dat los mag blijft het in stuks.
 */
export function aantalTegenMinimum(
  product: Product,
  aantal: number,
  minimum: number,
  opties: { los?: boolean } = {}
): string {
  if (opties.los || !product.alleenPerVerpakking || !heeftVerpakking(product)) {
    return `${aantal} van ${minimum}`;
  }
  return `${omschrijfAantal(product, aantal)} van ${omschrijfAantal(product, minimum)}`;
}
