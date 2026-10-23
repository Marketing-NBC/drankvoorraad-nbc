import type { EmballageSoort, EmballageStand } from "./types";

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
