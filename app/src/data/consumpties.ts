import type { MachineVerbruik } from "./calculations";
import { productVerbruikPerEvenement } from "./calculations";
import type { Mutatie, Product, ProductCategorie } from "./types";

/**
 * Consumpties per persoon bij een evenement.
 *
 * Een consumptie is wat een gast in zijn hand krijgt. Een flesje of blikje
 * is er één. Wat groter is dan één portie — een fust, een fles wijn — wordt
 * omgerekend naar glazen van 25 cl: een fust van 20 L is 80 glazen. Koffie
 * en water uit de machines tellen per kop of glas.
 *
 * Er wordt gerekend met het werkelijke verbruik (uitgegeven min retour), net
 * als bij de marge.
 */

/** Robin: een glas is 25 cl. */
export const GLAS_LITER = 0.25;

/** Tot en met deze inhoud is één stuk één consumptie (flesje 0,2 of 0,3 L, blikje 0,33 L). */
const PORTIE_TOT_LITER = 0.5;

/** "0,2 L" → 0.2, "33 cl" → 0.33, "20 L" → 20. Onbekend → undefined. */
export function inhoudInLiters(inhoud: string | undefined): number | undefined {
  if (!inhoud) return undefined;
  const match = inhoud.trim().toLowerCase().match(/^([\d.,]+)\s*(l|cl|ml)$/);
  if (!match) return undefined;
  const getal = Number(match[1].replace(",", "."));
  if (!Number.isFinite(getal) || getal <= 0) return undefined;
  if (match[2] === "cl") return getal / 100;
  if (match[2] === "ml") return getal / 1000;
  return getal;
}

/** Hoeveel consumpties er in één stuk van dit product zitten. */
export function consumptiesPerStuk(product: Product): number {
  const liters = inhoudInLiters(product.inhoud);
  if (liters === undefined || liters <= PORTIE_TOT_LITER) return 1;
  return liters / GLAS_LITER;
}

export interface ConsumptieGroep {
  categorie: ProductCategorie;
  consumpties: number;
}

export interface Consumpties {
  totaal: number;
  /** undefined zolang het aantal personen niet is ingevuld. */
  perPersoon: number | undefined;
  /** Per categorie, grootste eerst: bier, fris, wijn, koffie… */
  perCategorie: (ConsumptieGroep & { perPersoon: number | undefined })[];
}

export function berekenConsumpties(
  mutaties: Mutatie[],
  producten: Product[],
  aantalPersonen: number | undefined,
  machineVerbruik: MachineVerbruik[] = []
): Consumpties {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  const perCategorie = new Map<ProductCategorie, number>();
  const tel = (categorie: ProductCategorie, aantal: number) =>
    perCategorie.set(categorie, (perCategorie.get(categorie) ?? 0) + aantal);

  for (const regel of productVerbruikPerEvenement(mutaties)) {
    const product = productenById.get(regel.productId);
    if (!product || regel.werkelijkVerbruik <= 0) continue;
    tel(product.categorie, regel.werkelijkVerbruik * consumptiesPerStuk(product));
  }
  for (const regel of machineVerbruik) {
    const product = productenById.get(regel.productId);
    if (!product || regel.aantal <= 0) continue;
    tel(product.categorie, regel.aantal);
  }

  const personen = aantalPersonen && aantalPersonen > 0 ? aantalPersonen : undefined;
  const deel = (n: number) => (personen ? n / personen : undefined);
  const totaal = Array.from(perCategorie.values()).reduce((som, n) => som + n, 0);

  return {
    totaal,
    perPersoon: deel(totaal),
    perCategorie: Array.from(perCategorie.entries())
      .map(([categorie, consumpties]) => ({ categorie, consumpties, perPersoon: deel(consumpties) }))
      .sort((a, b) => b.consumpties - a.consumpties),
  };
}
