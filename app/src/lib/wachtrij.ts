/**
 * Boekingen die op verbinding staan te wachten.
 *
 * In de koelcel en achter in het magazijn valt het bereik weg. Een boeking
 * gaat dan niet verloren maar blijft op de telefoon staan tot er weer
 * verbinding is. Dat is het hele idee — en meteen het gevaar: een boeking
 * die stilletjes in een la ligt is erger dan een boeking die mislukt.
 * Daarom is de wachtrij overal zichtbaar en verdwijnt er nooit iets vanzelf.
 *
 * Wat hier NIET in komt: tellingen. Die rekenen af tegen de voorraad zoals
 * die op dat moment in de database staat, dus achteraf versturen zou een
 * verkeerde correctie kunnen boeken. Voor tellen heb je verbinding nodig.
 *
 * Elk item heeft een eigen kenmerk (`id`) dat als `client_id` meegaat naar
 * de database. Daar ligt een unieke index op, zodat een tweede poging nooit
 * tot een dubbele afboeking leidt — zie supabase/migraties/016_wachtrij.sql.
 */

const SLEUTEL = "drankvoorraad-wachtrij-v1";

export type WachtrijSoort = "mutatie" | "levering";

export interface WachtrijItem {
  /** Gaat als client_id mee naar de database; uniek, dus dubbel versturen kan niet. */
  id: string;
  soort: WachtrijSoort;
  /** Op wiens naam de boeking staat. Alleen die persoon kan hem versturen. */
  gebruikerId: string;
  /** Eén regel die vertelt wat er wacht, bijvoorbeeld "4 kratten Coca Cola naar Koelcel NBC". */
  omschrijving: string;
  payload: unknown;
  aangemaaktOp: string;
  pogingen: number;
  laatsteFout?: string;
}

/**
 * localStorage kan ontbreken of weigeren (privémodus, geblokkeerde
 * site-gegevens). Dan valt de wachtrij terug op het geheugen: hij overleeft
 * het sluiten van de app niet, maar de app blijft wel werken. Stilletjes
 * omvallen is hier het ergste wat er kan gebeuren.
 */
const geheugen = new Map<string, string>();

function opslag(): Pick<Storage, "getItem" | "setItem"> {
  try {
    if (typeof localStorage !== "undefined") {
      const proef = "__proef__";
      localStorage.setItem(proef, "1");
      localStorage.removeItem(proef);
      return localStorage;
    }
  } catch {
    /* valt door naar het geheugen */
  }
  return {
    getItem: (sleutel: string) => geheugen.get(sleutel) ?? null,
    setItem: (sleutel: string, waarde: string) => void geheugen.set(sleutel, waarde),
  };
}

export function nieuwKenmerk(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback voor oudere browsers: geen echte UUID-garantie, wel uniek genoeg
  // om twee boekingen van hetzelfde apparaat uit elkaar te houden.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
}

export function leesWachtrij(): WachtrijItem[] {
  try {
    const ruw = opslag().getItem(SLEUTEL);
    if (!ruw) return [];
    const gelezen: unknown = JSON.parse(ruw);
    return Array.isArray(gelezen) ? (gelezen as WachtrijItem[]) : [];
  } catch {
    // Kapotte inhoud gooien we niet weg: overschrijven gebeurt pas bij de
    // eerstvolgende schrijfactie, zodat er iets terug te halen valt.
    return [];
  }
}

export function bewaarWachtrij(items: WachtrijItem[]): void {
  try {
    opslag().setItem(SLEUTEL, JSON.stringify(items));
  } catch {
    /* vol of geweigerd — de app draait door met wat er in het geheugen staat */
  }
}

export function voegToeAanWachtrij(item: WachtrijItem): WachtrijItem[] {
  const items = [...leesWachtrij(), item];
  bewaarWachtrij(items);
  return items;
}

export function haalUitWachtrij(id: string): WachtrijItem[] {
  const items = leesWachtrij().filter((i) => i.id !== id);
  bewaarWachtrij(items);
  return items;
}

export function werkItemBij(id: string, changes: Partial<WachtrijItem>): WachtrijItem[] {
  const items = leesWachtrij().map((i) => (i.id === id ? { ...i, ...changes } : i));
  bewaarWachtrij(items);
  return items;
}

/**
 * Is dit een haperende verbinding, of weigert de server?
 *
 * Het verschil bepaalt alles: bij een netwerkfout wacht de boeking en gaat
 * hij later alsnog weg, bij een weigering (geen rechten, ongeldige regel)
 * moet de gebruiker het nú weten. Bij twijfel geldt het als weigering — een
 * boeking die eeuwig in de wachtrij blijft hangen is erger dan een
 * foutmelding die je meteen ziet.
 */
export function isNetwerkfout(fout: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (fout instanceof TypeError) return true;

  const bericht = (
    fout && typeof fout === "object" && "message" in fout ? String((fout as Error).message) : String(fout ?? "")
  ).toLowerCase();

  return (
    bericht.includes("failed to fetch") ||
    bericht.includes("networkerror") ||
    bericht.includes("network request failed") ||
    bericht.includes("load failed") ||
    bericht.includes("timeout") ||
    bericht.includes("fetch failed")
  );
}

/**
 * De database meldt een botsing op de unieke index: deze boeking is al
 * eerder binnengekomen. Dat is geen fout maar het bewijs dat de wachtrij
 * zijn werk doet — het item mag weg.
 */
export function isAlBinnen(fout: unknown): boolean {
  if (!fout || typeof fout !== "object") return false;
  const code = "code" in fout ? String((fout as { code?: unknown }).code) : "";
  const bericht = "message" in fout ? String((fout as Error).message).toLowerCase() : "";
  return code === "23505" || bericht.includes("duplicate key") || bericht.includes("client_id");
}
