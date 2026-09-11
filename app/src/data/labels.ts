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
