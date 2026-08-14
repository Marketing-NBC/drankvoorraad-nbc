import type { MutatieType } from "./types";

/** Leesbare namen voor de mutatietypen — één plek, zodat schermen niet uiteenlopen. */
export const mutatieLabels: Record<MutatieType, string> = {
  "magazijn-naar-evenement": "Uitgifte",
  "evenement-naar-magazijn": "Retour",
  "magazijn-naar-magazijn": "Verplaatsing",
  inkoop: "Inkoop",
  beschadigd: "Afschrijving",
  correctie: "Correctie",
};

/** Badge-variant per mutatietype, zodat de kleur overal hetzelfde betekent. */
export const mutatieVariant: Record<MutatieType, "tint" | "neutral" | "gold" | "success" | "outline"> = {
  "magazijn-naar-evenement": "tint",
  "evenement-naar-magazijn": "success",
  "magazijn-naar-magazijn": "neutral",
  inkoop: "success",
  beschadigd: "gold",
  correctie: "outline",
};

export const mutatieTypeOpties = (Object.keys(mutatieLabels) as MutatieType[]).map((type) => ({
  value: type,
  label: mutatieLabels[type],
}));
