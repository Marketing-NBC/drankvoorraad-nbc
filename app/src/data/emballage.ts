import type { EmballageMutatie, EmballageRetour, EmballageSoort, EmballageStand } from "./types";

export interface EmballageRegel {
  soort: EmballageSoort;
  inHuis: number;
  binnen: number;
  retour: number;
  handmatig: number;
  /** In huis × borg. Alleen voor de beheerder; voor anderen is de borg 0. */
  waarde: number;
}

/**
 * Per soort hoeveel emballage er in huis staat en wat die aan borg waard is.
 *
 * De stand zelf rekent de database uit (emballage_stand(), migratie 030);
 * hier komt alleen de borg erbij. Een uitgezette soort blijft in beeld zolang
 * er nog iets van in huis staat — die borg is nog niet terug. Een negatieve
 * stand (meer retour dan er ooit binnenkwam) blijft ook zichtbaar: dat is het
 * teken dat er geteld moet worden, en telt in het totaal als 0.
 */
export function emballageOverzicht(
  soorten: EmballageSoort[],
  stand: EmballageStand[]
): EmballageRegel[] {
  const standVan = new Map(stand.map((s) => [s.emballageId, s]));
  return soorten
    .map((soort) => {
      const s = standVan.get(soort.id);
      const inHuis = s?.inHuis ?? 0;
      return {
        soort,
        inHuis,
        binnen: s?.binnen ?? 0,
        retour: s?.retour ?? 0,
        handmatig: s?.handmatig ?? 0,
        waarde: Math.max(inHuis, 0) * soort.borg,
      };
    })
    .filter((r) => r.soort.actief || r.inHuis !== 0)
    .sort(
      (a, b) =>
        (a.soort.artikelnummer ?? "999999").localeCompare(b.soort.artikelnummer ?? "999999") ||
        a.soort.naam.localeCompare(b.soort.naam)
    );
}

/** Totaal over alle soorten. Negatieve standen tellen als 0. */
export function emballageTotaal(regels: EmballageRegel[]): { stuks: number; waarde: number } {
  return {
    stuks: regels.reduce((som, r) => som + Math.max(r.inHuis, 0), 0),
    waarde: regels.reduce((som, r) => som + r.waarde, 0),
  };
}

/* De notities die de database zelf op `erbij` en `eraf` zet (migratie 030). */
const NOTITIE_BEGINSTAND = "Beginstand uit de drankvoorraad";
const NOTITIE_TELLING = "Emballagetelling";
const VOORVOEGSEL_HANDMATIG = "Handmatig: ";

/**
 * Wat voor beweging een regel emballage is, zoals Magazijn → Emballage het
 * noemt: erbij, eraf of tellen, plus de beginstand en de retourbon. De
 * database kent alleen `erbij`, `eraf` en `naar-leverancier`; de notitie
 * zegt of het een telling of de beginstand was.
 */
export type EmballageBeweging = "beginstand" | "erbij" | "eraf" | "telling" | "retourbon";

export function emballageBeweging(m: EmballageMutatie): EmballageBeweging {
  if (m.type === "naar-leverancier") return "retourbon";
  if (m.notitie === NOTITIE_BEGINSTAND) return "beginstand";
  if (m.notitie === NOTITIE_TELLING) return "telling";
  return m.type;
}

/** Wat de beweging met de stand in huis deed: positief erbij, negatief eraf. */
export function emballageVerschil(m: EmballageMutatie): number {
  return m.type === "erbij" ? m.aantal : -m.aantal;
}

/** De reden zoals iemand hem invulde, zonder het voorvoegsel van de database. */
export function emballageReden(m: EmballageMutatie): string | undefined {
  const beweging = emballageBeweging(m);
  if (beweging !== "erbij" && beweging !== "eraf") return undefined;
  return m.notitie?.startsWith(VOORVOEGSEL_HANDMATIG)
    ? m.notitie.slice(VOORVOEGSEL_HANDMATIG.length)
    : m.notitie;
}

/** De reden bij erbij en eraf, de leverancier en het bonnummer bij een retourbon. */
export function emballageNotitie(m: EmballageMutatie, retour: EmballageRetour | undefined): string {
  if (m.type === "naar-leverancier") {
    if (!retour) return "";
    return retour.bonnummer ? `${retour.leverancier}, bon ${retour.bonnummer}` : retour.leverancier;
  }
  return emballageReden(m) ?? "";
}
