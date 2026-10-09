import type { GebruikerRol } from "../../data/types";

/** Eén lijst, zodat het rolmenu en het aanmaakformulier niet uiteenlopen. */
export const rolOpties: { value: GebruikerRol; label: string }[] = [
  { value: "beheerder", label: "Beheerder" },
  { value: "magazijnmedewerker", label: "Magazijnmedewerker" },
  { value: "evenementmanager", label: "Evenementmanager" },
];

export const rolToelichting: Record<GebruikerRol, string> = {
  beheerder: "Mag alles, inclusief gebruikers en locaties beheren.",
  magazijnmedewerker: "Neemt leveringen aan, boekt voorraad en doet tellingen.",
  evenementmanager: "Beheert evenementen en werkt in het magazijn (boeken, tellen, leveringen). Ziet geen bedragen en richt niets in.",
};
