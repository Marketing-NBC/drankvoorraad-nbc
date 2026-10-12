import type { GebruikerRol } from "../../data/types";

/** Eén lijst, zodat het rolmenu en het aanmaakformulier niet uiteenlopen. */
export const rolOpties: { value: GebruikerRol; label: string }[] = [
  { value: "beheerder", label: "Beheerder" },
  { value: "medewerker", label: "Medewerker" },
  { value: "housekeeping", label: "Housekeeping" },
];

export const rolLabel: Record<GebruikerRol, string> = {
  beheerder: "Beheerder",
  medewerker: "Medewerker",
  housekeeping: "Housekeeping",
};

export const rolToelichting: Record<GebruikerRol, string> = {
  beheerder: "Mag alles: bedragen, inrichting, gebruikers en evenementen afronden.",
  medewerker:
    "Werkt in het magazijn en bij evenementen: boeken, tellen, leveringen, emballage. Ziet geen bedragen en richt niets in.",
  housekeeping: "Regelt alleen de kantine en de kroeg: aanvullen, tellen en afboeken. Ziet geen bedragen.",
};
