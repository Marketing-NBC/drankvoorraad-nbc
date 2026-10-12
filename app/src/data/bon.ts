import type { LeverancierArtikel, Product } from "./types";
import { heeftVerpakking } from "./verpakking";

/**
 * Een afleverbon, gelezen van een foto.
 *
 * Nu door tekstherkenning op de telefoon (src/lib/bonHerkenning.ts en
 * src/data/bonTekst.ts); dezelfde vorm komt uit supabase/functions/lees-bon
 * als daar later een API-sleutel bij komt. Alles kan null zijn: wat niet te
 * lezen was, wordt niet gegokt.
 */
export interface GelezenBon {
  leverancier: string | null;
  bonnummer: string | null;
  datum: string | null;
  regels: GelezenBonregel[];
}

export interface GelezenBonregel {
  artikelnummer: string | null;
  omschrijving: string;
  besteld: number | null;
  uitgeleverd: number | null;
  /** De tekstherkenning twijfelt over deze regel: even nakijken. */
  onzeker?: boolean;
}

/**
 * Een regel van de bon, vertaald naar ons assortiment.
 *
 * `aantalBon` is in stuks, net als alles in de voorraad: 6 trays van 12
 * flessen is 72. De omrekening van de eenheid van de leverancier (krat, tray)
 * naar stuks zit in `stuksPerEenheid` van het gekoppelde artikel.
 */
export interface Bonvoorstel {
  regel: GelezenBonregel;
  /** Het product dat bij het artikelnummer hoort, of undefined als het nog onbekend is. */
  productId?: string;
  stuksPerEenheid: number;
  /** Uitgeleverd in eenheden van de bon (kratten, trays). */
  eenheden: number;
  /** Uitgeleverd in stuks — wat "op de bon" wordt. */
  aantalBon: number;
  /** Twijfel bij het lezen, of het artikelnummer week één cijfer af. */
  onzeker: boolean;
}

/** "Swinkels Family Brewers" en "SWINKELS" worden allebei Swinkels. */
export function herkenLeverancier(naam: string | null, bekend: readonly string[]): string | undefined {
  if (!naam) return undefined;
  const klein = naam.toLowerCase();
  return bekend.find((l) => klein.includes(l.toLowerCase()));
}

/**
 * Elke regel van de bon naast de bekende artikelnummers leggen.
 *
 * Uitgeleverd telt, niet besteld: de bon zegt dan wat er volgens de
 * leverancier op de kar stond. Wat er werkelijk stond, telt het magazijn
 * daarna zelf. Ontbreekt "uitgeleverd", dan geldt besteld; ontbreekt allebei,
 * dan 0 — dan moet er toch met de hand naar gekeken worden.
 */
export function bonNaarVoorstel(
  bon: GelezenBon,
  leverancier: string | undefined,
  artikelen: LeverancierArtikel[]
): Bonvoorstel[] {
  const perNummer = new Map(
    artikelen
      .filter((a) => a.leverancier === leverancier)
      .map((a) => [normaliseerArtikelnummer(a.artikelnummer), a])
  );

  return bon.regels.map((regel) => {
    const nummer = regel.artikelnummer ? normaliseerArtikelnummer(regel.artikelnummer) : undefined;
    const precies = nummer ? perNummer.get(nummer) : undefined;
    /* Tekstherkenning leest soms één cijfer verkeerd (408244 voor 108244).
       Lijkt het nummer op precies één bekend artikel, dan is het dat — met
       twijfel, zodat iemand even kijkt. */
    const bijna = !precies && nummer ? bijnaGelijk(nummer, Array.from(perNummer.keys())) : undefined;
    const artikel = precies ?? (bijna ? perNummer.get(bijna) : undefined);
    const stuksPerEenheid = artikel?.stuksPerEenheid ?? 1;
    const eenheden = Math.max(0, regel.uitgeleverd ?? regel.besteld ?? 0);
    return {
      regel,
      productId: artikel?.productId,
      stuksPerEenheid,
      eenheden,
      aantalBon: eenheden * stuksPerEenheid,
      onzeker: Boolean(regel.onzeker) || Boolean(bijna),
    };
  });
}

/** Het enige bekende nummer dat op één cijfer na gelijk is, of undefined. */
export function bijnaGelijk(nummer: string, bekend: string[]): string | undefined {
  const kandidaten = bekend.filter(
    (b) => b.length === nummer.length && b.split("").filter((c, i) => c !== nummer[i]).length === 1
  );
  return kandidaten.length === 1 ? kandidaten[0] : undefined;
}

/** "0118573" en "118573" zijn hetzelfde artikel; spaties tellen niet. */
export function normaliseerArtikelnummer(nummer: string): string {
  return nummer.replace(/\s+/g, "").replace(/^0+(?=\d)/, "");
}

/**
 * Een redelijke eerste gok voor een nieuw te koppelen artikel: een krat van
 * 24 bij een product dat per krat gaat, anders 1. Het magazijn past het aan
 * als de bon iets anders zegt (een tray van 6).
 */
export function standaardStuksPerEenheid(product: Product | undefined): number {
  if (!product || !heeftVerpakking(product)) return 1;
  return product.stuksPerVerpakking;
}
