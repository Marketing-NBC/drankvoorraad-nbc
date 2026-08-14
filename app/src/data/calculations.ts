import type { Evenement, Mutatie, Product, Voorraad } from "./types";
import { RETOUR_TYPES, UITGIFTE_TYPES } from "./types";

function isUitgifte(m: Mutatie): boolean {
  return UITGIFTE_TYPES.includes(m.type);
}

function isRetour(m: Mutatie): boolean {
  return RETOUR_TYPES.includes(m.type);
}

/** Werkelijk verbruik (per product) = aantal uitgegeven − aantal retour. */
export function werkelijkVerbruik(mutaties: Mutatie[], productId: string): number {
  let uitgifte = 0;
  let retour = 0;
  for (const m of mutaties) {
    if (m.productId !== productId) continue;
    if (isUitgifte(m)) uitgifte += m.aantal;
    else if (isRetour(m)) retour += m.aantal;
  }
  return uitgifte - retour;
}

export interface ProductVerbruik {
  productId: string;
  aantalUitgegeven: number;
  aantalRetour: number;
  werkelijkVerbruik: number;
}

/** Per-product breakdown (uitgifte, retour, werkelijk verbruik) for one event's mutations. */
export function productVerbruikPerEvenement(mutaties: Mutatie[]): ProductVerbruik[] {
  const byProduct = new Map<string, { uitgifte: number; retour: number }>();
  for (const m of mutaties) {
    if (!isUitgifte(m) && !isRetour(m)) continue;
    const entry = byProduct.get(m.productId) ?? { uitgifte: 0, retour: 0 };
    if (isUitgifte(m)) entry.uitgifte += m.aantal;
    else entry.retour += m.aantal;
    byProduct.set(m.productId, entry);
  }
  return Array.from(byProduct.entries()).map(([productId, { uitgifte, retour }]) => ({
    productId,
    aantalUitgegeven: uitgifte,
    aantalRetour: retour,
    werkelijkVerbruik: uitgifte - retour,
  }));
}

/** Kostprijs verbruik (per evenement) = Σ (werkelijk verbruik per product × inkoopprijs per product). */
export function kostprijsVerbruik(mutaties: Mutatie[], producten: Product[]): number {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  return productVerbruikPerEvenement(mutaties).reduce((totaal, regel) => {
    const product = productenById.get(regel.productId);
    if (!product) return totaal;
    return totaal + regel.werkelijkVerbruik * product.inkoopprijs;
  }, 0);
}

/**
 * Totale waarde van de uitgegeven voorraad (los van retouren) — gevraagd in de
 * oorspronkelijke specificatie naast het werkelijke verbruik.
 */
export function waardeUitgegeven(mutaties: Mutatie[], producten: Product[]): number {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  return productVerbruikPerEvenement(mutaties).reduce((totaal, regel) => {
    const product = productenById.get(regel.productId);
    if (!product) return totaal;
    return totaal + regel.aantalUitgegeven * product.inkoopprijs;
  }, 0);
}

/** Totale waarde van de geretourneerde voorraad. */
export function waardeRetour(mutaties: Mutatie[], producten: Product[]): number {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  return productVerbruikPerEvenement(mutaties).reduce((totaal, regel) => {
    const product = productenById.get(regel.productId);
    if (!product) return totaal;
    return totaal + regel.aantalRetour * product.inkoopprijs;
  }, 0);
}

/** Brutowinst = Omzet − Kostprijs verbruik. */
export function brutowinst(omzet: number, kostprijsVerbruikBedrag: number): number {
  return omzet - kostprijsVerbruikBedrag;
}

/**
 * Brutomarge (%) = (Brutowinst ÷ Omzet) × 100.
 * Returns null (never NaN/Infinity) when omzet is 0 or not filled in —
 * the display layer turns null into "nog niet beschikbaar".
 */
export function brutomarge(omzet: number, brutowinstBedrag: number): number | null {
  if (!omzet || omzet <= 0) return null;
  return (brutowinstBedrag / omzet) * 100;
}

export interface EvenementMarge {
  kostprijsVerbruik: number;
  waardeUitgegeven: number;
  waardeRetour: number;
  brutowinst: number;
  brutomarge: number | null;
}

/** Convenience wrapper computing the full marge block for one event's mutations + omzet. */
export function berekenMarge(omzet: number, mutaties: Mutatie[], producten: Product[]): EvenementMarge {
  const kostprijs = kostprijsVerbruik(mutaties, producten);
  const winst = brutowinst(omzet, kostprijs);
  return {
    kostprijsVerbruik: kostprijs,
    waardeUitgegeven: waardeUitgegeven(mutaties, producten),
    waardeRetour: waardeRetour(mutaties, producten),
    brutowinst: winst,
    brutomarge: brutomarge(omzet, winst),
  };
}

export interface TopProduct {
  product: Product;
  totaalVerbruik: number;
}

/** Ranks products by total werkelijk verbruik across all supplied mutations. */
export function topProducten(mutaties: Mutatie[], producten: Product[], n = 5): TopProduct[] {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  return productVerbruikPerEvenement(mutaties)
    .map((regel) => {
      const product = productenById.get(regel.productId);
      return product ? { product, totaalVerbruik: regel.werkelijkVerbruik } : null;
    })
    .filter((x): x is TopProduct => x !== null)
    .sort((a, b) => b.totaalVerbruik - a.totaalVerbruik)
    .slice(0, n);
}

/** Derving/verspilling: totale inkoopwaarde van als beschadigd geboekte producten. */
export function dervingWaarde(mutaties: Mutatie[], producten: Product[]): number {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  return mutaties
    .filter((m) => m.type === "beschadigd")
    .reduce((totaal, m) => {
      const product = productenById.get(m.productId);
      return product ? totaal + m.aantal * product.inkoopprijs : totaal;
    }, 0);
}

export interface LageVoorraadRegel {
  locatieId: string;
  productId: string;
  aantal: number;
  minVoorraad: number;
  /** Hoeveel er bij moet om weer op het minimum te komen. */
  tekort: number;
}

/**
 * Producten die onder hun ingestelde minimum zitten.
 *
 * Een minimum van 0 telt niet mee: dat is de standaardwaarde voor elk product
 * op elke locatie, dus zou anders elk product dat ergens niet ligt als
 * "te weinig" gemeld worden. Alleen een bewust ingesteld minimum is een signaal.
 */
export function lageVoorraad(voorraad: Voorraad[]): LageVoorraadRegel[] {
  return voorraad
    .filter((v) => v.minVoorraad > 0 && v.aantal < v.minVoorraad)
    .map((v) => ({
      locatieId: v.locatieId,
      productId: v.productId,
      aantal: v.aantal,
      minVoorraad: v.minVoorraad,
      tekort: v.minVoorraad - v.aantal,
    }))
    .sort((a, b) => b.tekort - a.tekort);
}

export interface EvenementUitstaand {
  evenement: Evenement;
  aantalUitgegeven: number;
  aantalRetour: number;
  /** Nog niet teruggeboekt: staat dus nog op het evenement, of is verbruikt. */
  aantalUitstaand: number;
  waardeUitstaand: number;
}

/**
 * Wat er per evenement nog uitstaat: uitgegeven min retour.
 *
 * Let op wat dit getal wél en niet zegt. Bij een lopend evenement is het de
 * voorraad die daar fysiek staat. Bij een afgerond evenement is het het
 * werkelijke verbruik — óf vergeten retour. Het verschil daartussen kan de app
 * niet zien; daarom staat de status erbij in het rapport.
 */
export function uitstaandPerEvenement(
  evenementen: Evenement[],
  mutatiesPerEvenement: Map<string, Mutatie[]>,
  producten: Product[]
): EvenementUitstaand[] {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  return evenementen
    .map((evenement) => {
      const regels = productVerbruikPerEvenement(mutatiesPerEvenement.get(evenement.id) ?? []);
      const aantalUitgegeven = regels.reduce((s, r) => s + r.aantalUitgegeven, 0);
      const aantalRetour = regels.reduce((s, r) => s + r.aantalRetour, 0);
      const waardeUitstaand = regels.reduce((s, r) => {
        const product = productenById.get(r.productId);
        return product ? s + r.werkelijkVerbruik * product.inkoopprijs : s;
      }, 0);
      return {
        evenement,
        aantalUitgegeven,
        aantalRetour,
        aantalUitstaand: aantalUitgegeven - aantalRetour,
        waardeUitstaand,
      };
    })
    .filter((r) => r.aantalUitgegeven > 0)
    .sort((a, b) => b.aantalUitstaand - a.aantalUitstaand);
}

/** Notitie die `rond_telling_af` op zijn correctiemutaties zet. */
const TELLING_NOTITIE = "Voorraadtelling";

export interface Voorraadverschil {
  mutatieId: string;
  productId: string;
  locatieId: string | undefined;
  /** Positief = meer gevonden dan verwacht, negatief = minder. */
  verschil: number;
  waarde: number;
  datumTijd: string;
}

/**
 * Voorraadverschillen uit afgeronde tellingen.
 *
 * Deze leidt af uit de mutaties in plaats van uit de tellingregels, om dezelfde
 * reden dat de voorraad zelf uit mutaties komt: het audit trail is de enige
 * bron van waarheid. Een correctie met richting "naar locatie" betekent dat er
 * méér stond dan verwacht; "van locatie" dat er minder stond.
 */
export function voorraadverschillen(mutaties: Mutatie[], producten: Product[]): Voorraadverschil[] {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  return mutaties
    .filter((m) => m.type === "correctie" && m.notitie === TELLING_NOTITIE)
    .map((m) => {
      const meerGevonden = Boolean(m.naarLocatieId);
      const verschil = meerGevonden ? m.aantal : -m.aantal;
      const product = productenById.get(m.productId);
      return {
        mutatieId: m.id,
        productId: m.productId,
        locatieId: m.naarLocatieId ?? m.vanLocatieId,
        verschil,
        waarde: verschil * (product?.inkoopprijs ?? 0),
        datumTijd: m.datumTijd,
      };
    });
}

export interface DervingRegel {
  product: Product;
  aantal: number;
  waarde: number;
}

/** Derving uitgesplitst per product — de onderbouwing onder `dervingWaarde`. */
export function dervingPerProduct(mutaties: Mutatie[], producten: Product[]): DervingRegel[] {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  const perProduct = new Map<string, number>();
  for (const m of mutaties) {
    if (m.type !== "beschadigd") continue;
    perProduct.set(m.productId, (perProduct.get(m.productId) ?? 0) + m.aantal);
  }
  return Array.from(perProduct.entries())
    .map(([productId, aantal]) => {
      const product = productenById.get(productId);
      return product ? { product, aantal, waarde: aantal * product.inkoopprijs } : null;
    })
    .filter((r): r is DervingRegel => r !== null)
    .sort((a, b) => b.waarde - a.waarde);
}

export interface EvenementMargeSamenvatting {
  evenement: Evenement;
  marge: EvenementMarge;
}

/**
 * Brutowinst over alle evenementen die daadwerkelijk hebben plaatsgevonden —
 * het kerncijfer op het dashboard.
 *
 * "Gepland" telt niet mee: daar is nog niets uitgegeven, dus zou het alleen
 * ruis toevoegen. "Afgerond" telt wél mee, en dat is de reden dat deze functie
 * niet meer alleen op "Actief" filtert: een evenement dat je netjes afsloot
 * verdween anders uit het totaal, waardoor het dashboard vrijwel altijd op
 * € 0,00 stond.
 */
export function totaleBrutowinst(
  evenementen: Evenement[],
  mutatiesPerEvenement: Map<string, Mutatie[]>,
  producten: Product[]
): { totaalBrutowinst: number; evenementen: EvenementMargeSamenvatting[] } {
  const meetellend = evenementen.filter((e) => e.status === "Actief" || e.status === "Afgerond");
  const samenvattingen = meetellend.map((evenement) => ({
    evenement,
    marge: berekenMarge(evenement.omzet, mutatiesPerEvenement.get(evenement.id) ?? [], producten),
  }));
  const totaalBrutowinst = samenvattingen.reduce((sum, s) => sum + s.marge.brutowinst, 0);
  return { totaalBrutowinst, evenementen: samenvattingen };
}
