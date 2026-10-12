import type { GelezenBon, GelezenBonregel } from "./bon";

/**
 * Herkende tekst van een afleverbon omzetten in bonnummer en regels.
 *
 * De tekst komt van tekstherkenning op de telefoon (Tesseract, zie
 * src/lib/bonHerkenning.ts). Die is niet foutloos: een gekreukte bon geeft
 * losse tekens van de vouw, een "S" waar een 5 staat, een punt achter een
 * artikelnummer. Deze functie is daarom ruimhartig in wat ze leest en zegt
 * eerlijk wanneer ze twijfelt (`onzeker`). Wat ze mist, vult het magazijn met
 * de hand aan.
 *
 * Gebouwd op de afleverbon van Swinkels: per regel een regelnummer, een
 * artikelnummer van zes cijfers, de omschrijving, en aan het eind besteld en
 * uitgeleverd.
 */

/** Tekens die tekstherkenning in een getal vaak voor een letter aanziet. */
const ALS_CIJFER: Record<string, string> = { S: "5", s: "5", O: "0", o: "0", l: "1", I: "1", "|": "1", B: "8" };

/** Een losse aantal-kolom: hooguit drie cijfers. Leestekens eromheen tellen niet. */
function alsAantal(token: string): number | undefined {
  const kaal = token.replace(/^[^\w|]+|[^\w|]+$/g, "");
  if (!kaal || kaal.length > 3) return undefined;
  const cijfers = kaal.split("").map((t) => ALS_CIJFER[t] ?? t).join("");
  return /^\d{1,3}$/.test(cijfers) ? Number(cijfers) : undefined;
}

/**
 * Hoort dit token nog bij de omschrijving? "Crate", "24x20", "Bot24x208,",
 * "A-Kopp": drie of meer letters en cijfers. Korter is ruis van de vouw
 * ("al", "gt", "¥").
 */
function isOmschrijving(token: string): boolean {
  return token.replace(/[^\p{L}\p{N}]/gu, "").length >= 3 && alsAantal(token) === undefined;
}

/** Eén regel van de artikeltabel, of null als dit geen artikelregel is. */
export function leesArtikelregel(regel: string): GelezenBonregel | null {
  const tokens = regel.trim().split(/\s+/);
  const artikelIndex = tokens.findIndex((t) => /^\d{6}$/.test(t.replace(/^[^\d]+|[^\d]+$/g, "")));
  if (artikelIndex < 0) return null;
  const artikelnummer = tokens[artikelIndex].replace(/[^\d]/g, "");

  // Van achter naar voren: eerst de aantallen (met ruis ertussen), dan de omschrijving.
  const rest = tokens.slice(artikelIndex + 1);
  const aantallen: number[] = [];
  let eindeOmschrijving = rest.length;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (isOmschrijving(rest[i])) break;
    const aantal = alsAantal(rest[i]);
    if (aantal !== undefined) aantallen.unshift(aantal);
    eindeOmschrijving = i;
  }

  const omschrijving = rest
    .slice(0, eindeOmschrijving)
    .join(" ")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N})]+$/u, "");
  if (!/\p{L}{3,}/u.test(omschrijving) || aantallen.length === 0) return null;

  // Meestal is besteld gelijk aan uitgeleverd. Staat er ergens zo'n paar,
  // dan is dat het; anders de laatste twee, met twijfel.
  let besteld: number | null;
  let uitgeleverd: number | null;
  let onzeker = false;
  const paar = aantallen.findIndex((n, i) => i > 0 && n === aantallen[i - 1]);
  if (aantallen.length >= 2 && aantallen[aantallen.length - 1] === aantallen[aantallen.length - 2]) {
    besteld = uitgeleverd = aantallen[aantallen.length - 1];
  } else if (paar > 0) {
    besteld = uitgeleverd = aantallen[paar];
    onzeker = true;
  } else if (aantallen.length >= 2) {
    besteld = aantallen[aantallen.length - 2];
    uitgeleverd = aantallen[aantallen.length - 1];
    onzeker = true;
  } else {
    besteld = null;
    uitgeleverd = aantallen[0];
    onzeker = true;
  }

  return { artikelnummer, omschrijving, besteld, uitgeleverd, onzeker };
}

function leesLeverancier(tekst: string): string | null {
  if (/swink|lieshout/i.test(tekst)) return "Swinkels";
  if (/bidfood/i.test(tekst)) return "Bidfood";
  return null;
}

/**
 * Het nummer van de levering. Bij Swinkels staat het onder het kopje
 * "Levering"; het SFB-ordernummer ernaast is langer en begint met nullen.
 */
function leesBonnummer(regels: string[]): string | null {
  const kop = regels.findIndex((r) => /\blevering\b/i.test(r));
  if (kop >= 0) {
    for (const regel of regels.slice(kop + 1, kop + 3)) {
      const nummer = regel.match(/\b[1-9]\d{6,9}\b/);
      if (nummer) return nummer[0];
    }
  }
  return regels.join("\n").match(/\b8\d{8}\b/)?.[0] ?? null;
}

function leesDatum(tekst: string): string | null {
  const match = tekst.match(/afleverdatum\D{0,20}(\d{2})[/.-](\d{2})[/.-](\d{4})/i);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export function leesBonTekst(tekst: string): GelezenBon {
  const regels = tekst.split(/\r?\n/);
  const gezien = new Set<string>();
  const artikelregels: GelezenBonregel[] = [];
  for (const regel of regels) {
    const gelezen = leesArtikelregel(regel);
    // Meerdere foto's van dezelfde pagina: elke regel één keer.
    if (!gelezen || gezien.has(gelezen.artikelnummer ?? "")) continue;
    gezien.add(gelezen.artikelnummer ?? "");
    artikelregels.push(gelezen);
  }
  return {
    leverancier: leesLeverancier(tekst),
    bonnummer: leesBonnummer(regels),
    datum: leesDatum(tekst),
    regels: artikelregels,
  };
}
