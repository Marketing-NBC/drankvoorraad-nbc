/* Alleen voor de visuele preview (npm run preview:ui) — niet in de app. */
import { createContext, useContext, type ReactNode } from "react";
import type {
  Evenement, Locatie, Mutatie, Pakbon, PakbonSamenvatting, Product, Profiel, Telling, Tellingregel, Voorraad,
} from "../src/data/types";

const profielen: Profiel[] = [
  { id: "u1", naam: "Abel Bakker", rol: "beheerder" },
  { id: "u2", naam: "Sanne Vos", rol: "magazijnmedewerker" },
  { id: "u3", naam: "Jeroen de Wit", rol: "evenementmanager" },
  { id: "u4", naam: "Fleur Janssen", rol: "magazijnmedewerker" },
  { id: "u5", naam: "Daan Peters", rol: "evenementmanager" },
];

const locaties: Locatie[] = [
  { id: "l0", naam: "Hoofdmagazijn", type: "magazijn", merk: null },
  { id: "l1", naam: "Koelcel NBC", type: "koelcel", merk: "NBC" },
  { id: "l2", naam: "Bar Green Village", type: "bar", merk: "Green Village" },
  { id: "l3", naam: "Koelcel Green Village", type: "koelcel", merk: "Green Village" },
  { id: "l4", naam: "Bar Foyer", type: "bar", merk: null },
];

const producten: Product[] = [
  { id: "p1", naam: "Heineken fust 50 L", categorie: "bier", inkoopprijs: 96.5, verkoopprijs: 0, eenheid: "fust", barcode: "8712000012345", leverancier: "Heineken" },
  { id: "p2", naam: "Jupiler fust 20 L", categorie: "bier", inkoopprijs: 42, verkoopprijs: 0, eenheid: "fust", barcode: "8712000098765", leverancier: "Heineken" },
  { id: "p3", naam: "Spa Blauw 0,5 L", categorie: "overig", inkoopprijs: 0.42, verkoopprijs: 2.75, eenheid: "krat", barcode: "8712000055512", leverancier: "Spadel" },
  { id: "p4", naam: "Coca-Cola 0,25 L", categorie: "fris", inkoopprijs: 0.48, verkoopprijs: 2.95, eenheid: "krat", barcode: "8712000044421", leverancier: "Coca-Cola" },
  { id: "p5", naam: "Appelsap 1 L", categorie: "fris", inkoopprijs: 1.1, verkoopprijs: 3.25, eenheid: "pak", leverancier: "Riedel" },
  { id: "p6", naam: "Chardonnay wit", categorie: "wijn", inkoopprijs: 5.2, verkoopprijs: 24.5, eenheid: "fles", barcode: "8712000033310", leverancier: "Wijnhuis" },
  { id: "p7", naam: "Prosecco", categorie: "wijn", inkoopprijs: 6.8, verkoopprijs: 29.5, eenheid: "fles", barcode: "8712000022209", leverancier: "Wijnhuis" },
];

const voorraadRuw: [string, string, number, number][] = [
  ["l0", "p1", 120, 20], ["l0", "p2", 60, 10], ["l0", "p3", 1600, 400], ["l0", "p4", 900, 400],
  ["l0", "p5", 260, 60], ["l0", "p6", 180, 120], ["l0", "p7", 120, 60],
  ["l1", "p1", 38, 12], ["l1", "p3", 1240, 400], ["l1", "p4", 860, 400],
  ["l1", "p6", 96, 120], ["l1", "p7", 54, 60], ["l1", "p2", 16, 8], ["l1", "p5", 180, 60],
  ["l2", "p3", 220, 100], ["l4", "p1", 6, 4],
];
const voorraad: Voorraad[] = voorraadRuw.map(([locatieId, productId, aantal, minVoorraad]) => ({
  locatieId, productId, aantal, minVoorraad,
}));

const evenementen: Evenement[] = [
  { id: "NBC-2026-014", naam: "Rabobank Jaarcongres", datum: "2026-05-14", merk: "NBC", status: "Actief", opdrachtgever: "Rabobank", omzet: 5400 },
  { id: "NBC-2026-015", naam: "Zorggroep Symposium", datum: "2026-05-19", merk: "NBC", status: "Gepland", omzet: 0 },
  { id: "GV-2026-004", naam: "Green Village Zomerborrel", datum: "2026-05-22", merk: "Green Village", status: "Gepland", omzet: 0 },
  { id: "NBC-2026-011", naam: "ASML Leiderschapsdag", datum: "2026-04-28", merk: "NBC", status: "Afgerond", omzet: 7200 },
  { id: "GV-2026-003", naam: "Provincie Utrecht Netwerkcafé", datum: "2026-04-21", merk: "Green Village", status: "Afgerond", omzet: 3100 },
  { id: "NBC-2026-009", naam: "KPN Kick-off", datum: "2026-04-09", merk: "NBC", status: "Afgerond", omzet: 4800 },
];

let n = 0;
function mut(m: Omit<Mutatie, "id">): Mutatie {
  n += 1;
  return { id: `m${n}`, ...m };
}
const mutaties: Mutatie[] = [
  mut({ productId: "p3", aantal: 600, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l1", evenementId: "NBC-2026-014", gebruikerId: "u2", datumTijd: "2026-05-14T09:12:00Z", pakbonId: "a7f31c29-0000-0000-0000-000000000000" }),
  mut({ productId: "p1", aantal: 14, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l4", evenementId: "NBC-2026-014", gebruikerId: "u2", datumTijd: "2026-05-14T08:40:00Z", pakbonId: "a7f31c29-0000-0000-0000-000000000000" }),
  mut({ productId: "p4", aantal: 480, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l1", evenementId: "NBC-2026-014", gebruikerId: "u2", datumTijd: "2026-05-13T16:40:00Z" }),
  mut({ productId: "p6", aantal: 180, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l4", evenementId: "NBC-2026-014", gebruikerId: "u2", datumTijd: "2026-05-13T16:35:00Z" }),
  mut({ productId: "p7", aantal: 146, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l4", evenementId: "NBC-2026-014", gebruikerId: "u2", datumTijd: "2026-05-13T16:30:00Z" }),
  mut({ productId: "p6", aantal: 30, type: "evenement-naar-magazijn", vanLocatieId: "l4", naarLocatieId: "l0", evenementId: "NBC-2026-014", gebruikerId: "u3", datumTijd: "2026-05-13T17:02:00Z" }),
  mut({ productId: "p3", aantal: 80, type: "evenement-naar-magazijn", vanLocatieId: "l1", naarLocatieId: "l0", evenementId: "NBC-2026-014", gebruikerId: "u3", datumTijd: "2026-05-13T17:05:00Z" }),
  mut({ productId: "p4", aantal: 60, type: "evenement-naar-magazijn", vanLocatieId: "l1", naarLocatieId: "l0", evenementId: "NBC-2026-014", gebruikerId: "u3", datumTijd: "2026-05-13T17:08:00Z" }),
  mut({ productId: "p1", aantal: 2, type: "evenement-naar-magazijn", vanLocatieId: "l4", naarLocatieId: "l0", evenementId: "NBC-2026-014", gebruikerId: "u3", datumTijd: "2026-05-13T17:10:00Z" }),
  mut({ productId: "p7", aantal: 18, type: "evenement-naar-magazijn", vanLocatieId: "l4", naarLocatieId: "l0", evenementId: "NBC-2026-014", gebruikerId: "u3", datumTijd: "2026-05-13T17:12:00Z" }),
  mut({ productId: "p7", aantal: 4, type: "beschadigd", vanLocatieId: "l4", gebruikerId: "u3", notitie: "beschadigd bij het uitladen", datumTijd: "2026-05-13T16:35:00Z" }),
  mut({ productId: "p4", aantal: 12, type: "correctie", vanLocatieId: "l1", gebruikerId: "u1", notitie: "verschil uit telling", datumTijd: "2026-05-13T11:20:00Z" }),
  mut({ productId: "p1", aantal: 24, type: "inkoop", naarLocatieId: "l0", gebruikerId: "u2", datumTijd: "2026-05-11T10:00:00Z" }),
  mut({ productId: "p3", aantal: 400, type: "magazijn-naar-magazijn", vanLocatieId: "l0", naarLocatieId: "l2", gebruikerId: "u4", datumTijd: "2026-05-10T14:20:00Z" }),
  mut({ productId: "p3", aantal: 500, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l2", evenementId: "NBC-2026-011", gebruikerId: "u2", datumTijd: "2026-04-28T09:00:00Z" }),
  mut({ productId: "p3", aantal: 120, type: "evenement-naar-magazijn", vanLocatieId: "l2", naarLocatieId: "l0", evenementId: "NBC-2026-011", gebruikerId: "u2", datumTijd: "2026-04-28T20:00:00Z" }),
  mut({ productId: "p6", aantal: 90, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l2", evenementId: "GV-2026-003", gebruikerId: "u4", datumTijd: "2026-04-21T09:00:00Z" }),
  mut({ productId: "p4", aantal: 300, type: "magazijn-naar-evenement", vanLocatieId: "l0", naarLocatieId: "l1", evenementId: "NBC-2026-009", gebruikerId: "u4", datumTijd: "2026-04-09T09:00:00Z" }),
];

const pakbonnen: PakbonSamenvatting[] = [
  { id: "a7f31c29-0000-0000-0000-000000000000", evenementId: "NBC-2026-014", vanLocatieId: "l0", ontvangerNaam: "Jeroen de Wit", gebruikerId: "u2", aangemaaktOp: "2026-05-13T16:40:00Z" },
  { id: "b21d0e84-0000-0000-0000-000000000000", evenementId: "NBC-2026-014", vanLocatieId: "l0", ontvangerNaam: "Sanne Vos", gebruikerId: "u2", aangemaaktOp: "2026-05-14T09:05:00Z" },
];

const tellingen: Telling[] = [
  { id: "t1", locatieId: "l1", status: "open", gebruikerId: "u2", aangemaaktOp: "2026-05-14T07:30:00Z" },
  { id: "t2", locatieId: "l0", status: "afgerond", gebruikerId: "u1", aangemaaktOp: "2026-05-01T08:00:00Z", afgerondOp: "2026-05-01T09:15:00Z" },
];

const tellingregels: Record<string, Tellingregel[]> = {
  t1: [
    { id: "tr1", tellingId: "t1", productId: "p5", verwachtAantal: 180, geteldAantal: 180 },
    { id: "tr2", tellingId: "t1", productId: "p6", verwachtAantal: 96, geteldAantal: 92 },
    { id: "tr3", tellingId: "t1", productId: "p4", verwachtAantal: 860, geteldAantal: 860 },
    { id: "tr4", tellingId: "t1", productId: "p1", verwachtAantal: 38, geteldAantal: 38 },
    { id: "tr5", tellingId: "t1", productId: "p2", verwachtAantal: 16, geteldAantal: 18 },
    { id: "tr6", tellingId: "t1", productId: "p7", verwachtAantal: 54, geteldAantal: null },
    { id: "tr7", tellingId: "t1", productId: "p3", verwachtAantal: 1240, geteldAantal: null },
  ],
  t2: [],
};

const state = { producten, evenementen, mutaties, locaties, voorraad, profielen, tellingen, pakbonnen };

const mutatiesPerEvenement = new Map<string, Mutatie[]>();
for (const m of mutaties) {
  if (!m.evenementId) continue;
  mutatiesPerEvenement.set(m.evenementId, [...(mutatiesPerEvenement.get(m.evenementId) ?? []), m]);
}

const niets = async () => {};
const waarde: Record<string, unknown> = {
  state,
  laden: false,
  fout: null,
  mutatiesPerEvenement,
  hoofdmagazijn: locaties[0],
  herlaad: niets,
  voegEvenementToe: niets,
  wijzigEvenement: niets,
  verwijderEvenement: niets,
  voegProductToe: async () => null,
  wijzigProduct: niets,
  verwijderProduct: niets,
  voegMutatieToe: niets,
  voegLocatieToe: niets,
  wijzigLocatie: niets,
  verwijderLocatie: niets,
  stelMinVoorraadIn: niets,
  wijzigGebruiker: niets,
  startTelling: async () => "t1",
  haalTellingregels: async (id: string) => tellingregels[id] ?? [],
  zetGeteldAantal: niets,
  rondTellingAf: async () => 2,
  annuleerTelling: niets,
  maakPakbon: async () => pakbonnen[0].id,
  haalPakbon: async (id: string) => {
    const p = pakbonnen.find((b) => b.id === id);
    return p ? ({ ...p, handtekening: undefined } as Pakbon) : null;
  },
};

const Ctx = createContext(waarde);
export function AppStateProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={waarde}>{children}</Ctx.Provider>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAppState(): any { return useContext(Ctx); }
export function useEvenement(id: string | undefined) { return evenementen.find((e) => e.id === id); }
export function useTotaleVoorraad(productId: string) {
  return voorraad.filter((v) => v.productId === productId).reduce((s, v) => s + v.aantal, 0);
}
