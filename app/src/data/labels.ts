import type { EmballageBeweging } from "./emballage";
import type { MutatieType } from "./types";

/** Leesbare namen voor de mutatietypen — één plek, zodat schermen niet uiteenlopen. */
export const mutatieLabels: Record<MutatieType, string> = {
  "magazijn-naar-evenement": "Uitgifte",
  "evenement-naar-magazijn": "Retour",
  "magazijn-naar-magazijn": "Verplaatsing",
  inkoop: "Inkoop",
  beschadigd: "Afschrijving",
  correctie: "Correctie",
  personeelsverbruik: "Personeel",
};

/**
 * Badge-variant per mutatietype, zodat de kleur overal hetzelfde betekent.
 * Petrol = voorraad gaat de deur uit of komt binnen, groen = komt terug,
 * geel = je raakt het kwijt, neutraal = het schuift alleen op papier.
 */
export const mutatieVariant: Record<MutatieType, "tint" | "neutral" | "gold" | "success"> = {
  "magazijn-naar-evenement": "tint",
  "evenement-naar-magazijn": "success",
  "magazijn-naar-magazijn": "neutral",
  inkoop: "tint",
  beschadigd: "gold",
  correctie: "neutral",
  personeelsverbruik: "gold",
};

export const mutatieTypeOpties = (Object.keys(mutatieLabels) as MutatieType[]).map((type) => ({
  value: type,
  label: mutatieLabels[type],
}));

/** Dezelfde woorden als in "Emballage invoeren" onder Magazijn. */
export const emballageBewegingLabels: Record<EmballageBeweging, string> = {
  beginstand: "Beginstand",
  erbij: "Erbij",
  eraf: "Eraf",
  telling: "Telling",
  retourbon: "Retourbon",
};

/** Zelfde betekenis als bij de drank: petrol in of uit, geel kwijt, neutraal op papier. */
export const emballageBewegingVariant: Record<EmballageBeweging, "tint" | "neutral" | "gold" | "success"> = {
  beginstand: "neutral",
  erbij: "tint",
  eraf: "gold",
  telling: "neutral",
  retourbon: "tint",
};

export const emballageBewegingOpties = (Object.keys(emballageBewegingLabels) as EmballageBeweging[]).map(
  (beweging) => ({ value: beweging, label: emballageBewegingLabels[beweging] })
);
