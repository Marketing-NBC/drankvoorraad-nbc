/* Alleen voor de visuele preview (npm run preview:ui) — niet in de app. */
import { createContext, useContext, type ReactNode } from "react";
import type {
  EmballageMutatie, Evenement, Gebruiker, Koppeling, Levering, Leveringregel, Locatie, Machine, Meting, Mutatie,
  Pakbon, PakbonSamenvatting, Product, Profiel, Telling, Tellingregel, Voorraad, Vulplek,
  VulplekRegel, Zaal,
} from "../src/data/types";

const profielen: Profiel[] = [
  { id: "u1", naam: "Abel Bakker", rol: "beheerder", actief: true },
  { id: "u2", naam: "Sanne Vos", rol: "medewerker", actief: true },
  { id: "u3", naam: "Jeroen de Wit", rol: "housekeeping", actief: true },
  { id: "u4", naam: "Fleur Janssen", rol: "medewerker", actief: true },
  { id: "u5", naam: "Daan Peters", rol: "medewerker", actief: false },
];

const gebruikers: Gebruiker[] = profielen.map((p, i) => ({
  ...p,
  email: `${p.naam.split(" ")[0].toLowerCase()}@nbcevents.nl`,
  aangemaaktOp: new Date(2026, 0, 4 + i * 11).toISOString(),
}));

const locaties: Locatie[] = [
  { id: "l0", naam: "Hoofdmagazijn", type: "magazijn", merk: null, voorPersoneel: false },
  { id: "l1", naam: "Koelcellen NBC", type: "koelcel", merk: "NBC", voorPersoneel: false },
  { id: "l2", naam: "Koelkasten buffetten en bekkens NBC", type: "bar", merk: "NBC", voorPersoneel: false },
  { id: "l3", naam: "Koelcel Green Village", type: "koelcel", merk: "Green Village", voorPersoneel: false },
  { id: "l4", naam: "Bar NBC", type: "bar", merk: "NBC", voorPersoneel: false },
  { id: "l5", naam: "Kantine en kroeg", type: "kantine", merk: "NBC", voorPersoneel: true },
];
/* Na 031 is de kroeg samengevoegd met de kantine: niet meer te kiezen, wel
   nog de naam bij oude boekingen. */
const alleLocaties: Locatie[] = [
  ...locaties,
  { id: "l6", naam: "Kroeg", type: "kroeg", merk: "NBC", voorPersoneel: true },
];

/** Kale velden, zodat een regel hieronder alleen zegt wat afwijkt. */
function p(velden: Partial<Product> & Pick<Product, "id" | "naam">): Product {
  return {
    categorie: "fris",
    inkoopprijs: 0,
    eenheid: "fles",
    stuksPerVerpakking: 1,
    alleenPerVerpakking: false,
    statiegeldPerStuk: 0,
    statiegeldPerVerpakking: 0,
    voorraadloos: false,
    voorPersoneel: false,
    emballagePer: "verpakking",
    ...velden,
  };
}

const producten: Product[] = [
  p({ id: "p1", naam: "Fust Swinckels 20 L", categorie: "bier", inhoud: "20 L", eenheid: "fust", inkoopprijs: 40.7, statiegeldPerStuk: 30, barcode: "8712000012345", leverancier: "Swinkels", emballageId: "e5", emballagePer: "stuk" }),
  p({ id: "p2", naam: "Swinckels 0,3 L", categorie: "bier", inhoud: "0,3 L", inkoopprijs: 0.53, verpakking: "krat", stuksPerVerpakking: 24, alleenPerVerpakking: true, statiegeldPerVerpakking: 3.9, barcode: "8712000098765", leverancier: "Swinkels", emballageId: "e4" }),
  p({ id: "p3", naam: "Spa blauw 1 L", inhoud: "1 L", inkoopprijs: 0.95, verpakking: "krat", stuksPerVerpakking: 12, statiegeldPerVerpakking: 5, barcode: "8712000055512", leverancier: "Swinkels", emballageId: "e1" }),
  p({ id: "p4", naam: "Coca Cola 0,2 L", inhoud: "0,2 L", inkoopprijs: 0.46, verpakking: "krat", stuksPerVerpakking: 24, alleenPerVerpakking: true, statiegeldPerVerpakking: 5, barcode: "8712000044421", leverancier: "Swinkels", emballageId: "e1" }),
  p({ id: "p5", naam: "Coca Cola 1,25 L", inhoud: "1,25 L", inkoopprijs: 2.05, statiegeldPerStuk: 0.25, leverancier: "Swinkels", voorPersoneel: true, emballageId: "e2", emballagePer: "stuk" }),
  p({ id: "p6", naam: "Witte wijn 0,7 L", categorie: "wijn", inhoud: "0,7 L", inkoopprijs: 4.15, voorPersoneel: true, barcode: "8712000033310" }),
  p({ id: "p7", naam: "Prosecco 0,7 L", categorie: "wijn", inhoud: "0,7 L", inkoopprijs: 7.15, barcode: "8712000022209" }),
  p({ id: "p8", naam: "Koffie", categorie: "koffie", eenheid: "kop", inkoopprijs: 0.12, voorraadloos: true, leverancier: "Franke" }),
  p({ id: "p9", naam: "Water koud", categorie: "water", eenheid: "glas", inkoopprijs: 0, voorraadloos: true, leverancier: "Aquablu" }),
];

const voorraadRuw: [string, string, number, number][] = [
  ["l0", "p1", 120, 20], ["l0", "p2", 60, 10], ["l0", "p3", 1600, 400], ["l0", "p4", 900, 400],
  ["l0", "p5", 260, 60], ["l0", "p6", 180, 120], ["l0", "p7", 120, 60],
  ["l1", "p1", 38, 12], ["l1", "p3", 1240, 400], ["l1", "p4", 860, 400],
  ["l1", "p6", 96, 120], ["l1", "p7", 54, 60], ["l1", "p2", 16, 8], ["l1", "p5", 180, 60],
  ["l2", "p3", 220, 100], ["l4", "p1", 6, 4],
  ["l5", "p4", 96, 48], ["l5", "p3", 36, 24], ["l5", "p2", 72, 48], ["l5", "p6", 9, 6],
];
const voorraad: Voorraad[] = voorraadRuw.map(([locatieId, productId, aantal, minVoorraad]) => ({
  locatieId, productId, aantal, minVoorraad,
}));

const evenementen: Evenement[] = [
  { id: "NBC-2026-014", naam: "Rabobank Jaarcongres", datum: "2026-05-14", merk: "NBC", status: "Actief", opdrachtgever: "Rabobank", omzet: 5400, aantalPersonen: 180 },
  { id: "NBC-2026-015", naam: "Zorggroep Symposium", datum: "2026-05-19", merk: "NBC", status: "Gepland", omzet: 0 },
  { id: "GV-2026-004", naam: "Green Village Zomerborrel", datum: "2026-05-22", merk: "Green Village", status: "Gepland", omzet: 0 },
  { id: "NBC-2026-011", naam: "ASML Leiderschapsdag", datum: "2026-04-28", merk: "NBC", status: "Afgerond", omzet: 7200, aantalPersonen: 240 },
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

const zalen: Zaal[] = [
  { id: "z1", naam: "HOS 1", actief: true },
  { id: "z2", naam: "HOS 2", actief: true },
  { id: "z3", naam: "Lounge", actief: true },
  { id: "z4", naam: "Grand Hall", actief: true },
  { id: "z5", naam: "Event hall", actief: true },
];

const evenementZalen = [
  { evenementId: "NBC-2026-014", zaalId: "z1" },
  { evenementId: "NBC-2026-014", zaalId: "z3" },
  { evenementId: "NBC-2026-011", zaalId: "z4" },
];

const vulplekken: Vulplek[] = [
  { id: "vp1", naam: "Koelkast HOS 1", type: "koelkast", zaalId: "z1", actief: true },
  { id: "vp2", naam: "Bar Lounge", type: "bar", zaalId: "z3", actief: true },
];

const standaardvulling: VulplekRegel[] = [
  { vulplekId: "vp1", productId: "p4", aantal: 20 },
  { vulplekId: "vp1", productId: "p3", aantal: 12 },
  { vulplekId: "vp2", productId: "p4", aantal: 24 },
  { vulplekId: "vp2", productId: "p6", aantal: 12 },
];

const koppelingen: Koppeling[] = [
  {
    id: "k1", soort: "franke", naam: "Franke", actief: false,
    notitie: "Koffiemachines. Koppeling aangevraagd, nog niet beschikbaar — voer het dagverbruik zolang handmatig in.",
  },
  {
    id: "k2", soort: "aquablu", naam: "Aquablu", actief: false,
    notitie: "Watertappunten. Koppeling aangevraagd, nog niet beschikbaar — voer het dagverbruik zolang handmatig in.",
  },
];

const machines: Machine[] = [
  { id: "ma1", koppelingId: "k1", naam: "Koffiemachine HOS 1", productId: "p8", zaalId: "z1", actief: true },
  { id: "ma2", koppelingId: "k1", naam: "Koffiemachine Lounge", productId: "p8", zaalId: "z3", actief: true },
  { id: "ma3", koppelingId: "k2", naam: "Watertappunt HOS 1", productId: "p9", zaalId: "z1", actief: true },
];

const metingen: Meting[] = [
  { id: "mt1", machineId: "ma1", datum: "2026-05-14", aantal: 184, bron: "handmatig", evenementId: "NBC-2026-014", gebruikerId: "u2" },
  { id: "mt2", machineId: "ma2", datum: "2026-05-14", aantal: 96, bron: "handmatig", evenementId: "NBC-2026-014", gebruikerId: "u2" },
  { id: "mt3", machineId: "ma3", datum: "2026-05-14", aantal: 240, bron: "handmatig", evenementId: "NBC-2026-014", gebruikerId: "u2" },
  { id: "mt4", machineId: "ma1", datum: "2026-04-28", aantal: 210, bron: "handmatig", evenementId: "NBC-2026-011", gebruikerId: "u4" },
];

/* Personeelsverbruik met datums rond vandaag, zodat het scherm in de preview
   binnen de standaardperiode (deze maand) iets te laten zien heeft. */
const dagenGeleden = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
mutaties.push(
  mut({ productId: "p4", aantal: 96, type: "magazijn-naar-magazijn", vanLocatieId: "l0", naarLocatieId: "l5", gebruikerId: "u2", datumTijd: dagenGeleden(9) }),
  mut({ productId: "p4", aantal: 48, type: "personeelsverbruik", vanLocatieId: "l5", gebruikerId: "u2", notitie: "Uit telling", datumTijd: dagenGeleden(4) }),
  mut({ productId: "p3", aantal: 36, type: "magazijn-naar-magazijn", vanLocatieId: "l0", naarLocatieId: "l5", gebruikerId: "u4", datumTijd: dagenGeleden(9) }),
  mut({ productId: "p3", aantal: 12, type: "personeelsverbruik", vanLocatieId: "l5", gebruikerId: "u4", notitie: "Uit telling", datumTijd: dagenGeleden(4) }),
  mut({ productId: "p2", aantal: 72, type: "magazijn-naar-magazijn", vanLocatieId: "l0", naarLocatieId: "l6", gebruikerId: "u2", datumTijd: dagenGeleden(11) }),
  mut({ productId: "p2", aantal: 24, type: "personeelsverbruik", vanLocatieId: "l6", gebruikerId: "u3", notitie: "Uit telling", datumTijd: dagenGeleden(3) }),
  mut({ productId: "p6", aantal: 6, type: "personeelsverbruik", vanLocatieId: "l6", gebruikerId: "u3", notitie: "Uit telling", datumTijd: dagenGeleden(3) })
);

const leveringen: Levering[] = [
  { id: "lv1", locatieId: "l0", leverancier: "Swinkels", bonnummer: "BON-8842", aangenomenDoor: "Ricardo", gebruikerId: "u2", aangemaaktOp: dagenGeleden(2) },
  { id: "lv2", locatieId: "l0", leverancier: "Bidfood", bonnummer: "CC-19334", aangenomenDoor: "Mo", gebruikerId: "u4", aangemaaktOp: dagenGeleden(6) },
];

const leveringregels: Leveringregel[] = [
  { id: "lr1", leveringId: "lv1", productId: "p2", aantalBon: 240, aantalWerkelijk: 192, verschil: -48 },
  { id: "lr2", leveringId: "lv1", productId: "p1", aantalBon: 6, aantalWerkelijk: 6, verschil: 0 },
  { id: "lr3", leveringId: "lv2", productId: "p4", aantalBon: 480, aantalWerkelijk: 480, verschil: 0 },
  { id: "lr4", leveringId: "lv2", productId: "p5", aantalBon: 60, aantalWerkelijk: 54, verschil: -6, notitie: "Zes flessen gebroken aangekomen" },
];

const pakbonnen: PakbonSamenvatting[] = [
  { id: "a7f31c29-0000-0000-0000-000000000000", evenementId: "NBC-2026-014", vanLocatieId: "l0", ontvangerNaam: "Jeroen de Wit", gebruikerId: "u2", aangemaaktOp: "2026-05-13T16:40:00Z" },
  { id: "b21d0e84-0000-0000-0000-000000000000", evenementId: "NBC-2026-014", vanLocatieId: "l0", ontvangerNaam: "Sanne Vos", gebruikerId: "u2", aangemaaktOp: "2026-05-14T09:05:00Z" },
];

const tellingen: Telling[] = [
  { id: "t1", locatieId: "l1", status: "open", gebruikerId: "u2", aangemaaktOp: "2026-05-14T07:30:00Z" },
  { id: "t2", locatieId: "l0", status: "afgerond", gebruikerId: "u1", aangemaaktOp: "2026-05-01T08:00:00Z", afgerondOp: "2026-05-01T09:15:00Z" },
  /* De kantine en de kroeg worden geteld: dáár komt het personeelsverbruik
     vandaan. */
  { id: "t3", locatieId: "l5", status: "afgerond", gebruikerId: "u2", aangemaaktOp: dagenGeleden(4), afgerondOp: dagenGeleden(4) },
  { id: "t4", locatieId: "l6", status: "afgerond", gebruikerId: "u3", aangemaaktOp: dagenGeleden(3), afgerondOp: dagenGeleden(3) },
];

const tellingregels: Record<string, Tellingregel[]> = {
  t1: [
    { id: "tr1", tellingId: "t1", productId: "p5", verwachtAantal: 180, geteldAantal: 180 },
    { id: "tr2", tellingId: "t1", productId: "p6", verwachtAantal: 96, geteldAantal: 92 },
    { id: "tr3", tellingId: "t1", productId: "p4", verwachtAantal: 864, geteldAantal: 840, reden: "kapot" },
    { id: "tr4", tellingId: "t1", productId: "p1", verwachtAantal: 38, geteldAantal: 38 },
    { id: "tr5", tellingId: "t1", productId: "p2", verwachtAantal: 16, geteldAantal: 18 },
    { id: "tr6", tellingId: "t1", productId: "p7", verwachtAantal: 54, geteldAantal: null },
    { id: "tr7", tellingId: "t1", productId: "p3", verwachtAantal: 1240, geteldAantal: null },
  ],
  t2: [],
};

/* Zoals na migratie 027: de soorten van de retourbon van Swinkels. */
const emballage = [
  { id: "e1", naam: "Krat fris handel 8 t/m 28 vaks", artikelnummer: "800163", leverancier: "Swinkels", actief: true, borg: 5 },
  { id: "e2", naam: "PET-fles Coca-Cola", leverancier: "Swinkels", actief: true, borg: 0.25 },
  { id: "e3", naam: "Krat Spa 12 × 1 L", leverancier: "Bidfood", actief: false, borg: 5 },
  { id: "e4", naam: "Bierkrat Swinkels 24 × 0,3 L", artikelnummer: "800022", leverancier: "Swinkels", actief: true, borg: 3.9 },
  { id: "e5", naam: "Fust Swinkels 20 L", artikelnummer: "800004", leverancier: "Swinkels", actief: true, borg: 30 },
  { id: "e6", naam: "Blikje", leverancier: "Swinkels", actief: true, borg: 0.1 },
  { id: "e7", naam: "Rolcontainer", artikelnummer: "800307", leverancier: "Swinkels", actief: true, borg: 150 },
  { id: "e8", naam: "Koolzuurcilinder", artikelnummer: "800158", leverancier: "Swinkels", actief: true, borg: 120 },
  { id: "e9", naam: "Big bag PET (2,5 m)", artikelnummer: "800136", leverancier: "Swinkels", actief: true, borg: 0 },
];
const emballageRetouren = [
  { id: "er1", leverancier: "Swinkels", bonnummer: "800758649", gebruikerId: "u2", aangemaaktOp: dagenGeleden(3) },
  { id: "er2", leverancier: "Swinkels", gebruikerId: "u4", aangemaaktOp: dagenGeleden(9) },
];
const emballageRetourregels = [
  { id: "em1", retourId: "er1", emballageId: "e1", aantal: 18 },
  { id: "em2", retourId: "er1", emballageId: "e2", aantal: 40 },
  { id: "em3", retourId: "er2", emballageId: "e5", aantal: 12 },
  { id: "em4", retourId: "er2", emballageId: "e4", aantal: 6 },
];
/* Alle bewegingen voor Mutaties → Emballage: de beginstand, een telling,
   invoer erbij en eraf, en de regels van de twee retourbonnen hierboven. */
const emballageMutaties: EmballageMutatie[] = [
  { id: "em5", emballageId: "e1", aantal: 12, type: "erbij", gebruikerId: "u2", notitie: "Handmatig: lege kratten achter in het magazijn", datumTijd: dagenGeleden(0.2) },
  { id: "em6", emballageId: "e5", aantal: 3, type: "eraf", gebruikerId: "u4", notitie: "Handmatig: 3 fusten lek", datumTijd: dagenGeleden(1) },
  { id: "em1", emballageId: "e1", aantal: 18, type: "naar-leverancier", retourId: "er1", gebruikerId: "u2", notitie: "Retour naar leverancier", datumTijd: dagenGeleden(3) },
  { id: "em2", emballageId: "e2", aantal: 40, type: "naar-leverancier", retourId: "er1", gebruikerId: "u2", notitie: "Retour naar leverancier", datumTijd: dagenGeleden(3) },
  { id: "em7", emballageId: "e8", aantal: 4, type: "erbij", gebruikerId: "u1", notitie: "Emballagetelling", datumTijd: dagenGeleden(5) },
  { id: "em8", emballageId: "e2", aantal: 6, type: "eraf", gebruikerId: "u1", notitie: "Emballagetelling", datumTijd: dagenGeleden(5) },
  { id: "em3", emballageId: "e5", aantal: 12, type: "naar-leverancier", retourId: "er2", gebruikerId: "u4", notitie: "Retour naar leverancier", datumTijd: dagenGeleden(9) },
  { id: "em4", emballageId: "e4", aantal: 6, type: "naar-leverancier", retourId: "er2", gebruikerId: "u4", notitie: "Retour naar leverancier", datumTijd: dagenGeleden(9) },
  { id: "em9", emballageId: "e1", aantal: 122, type: "erbij", gebruikerId: "u1", notitie: "Beginstand uit de drankvoorraad", datumTijd: dagenGeleden(14) },
  { id: "em10", emballageId: "e2", aantal: 58, type: "erbij", gebruikerId: "u1", notitie: "Beginstand uit de drankvoorraad", datumTijd: dagenGeleden(14) },
];
/* Zoals emballage_stand() (migratie 030): binnen ± handmatig − retour. Eén
   soort negatief, zodat de melding "tellen" te beoordelen is. */
const emballageStand = [
  { emballageId: "e1", binnen: 24, handmatig: 134, retour: 18, inHuis: 140 },
  { emballageId: "e2", binnen: 60, handmatig: 52, retour: 40, inHuis: 72 },
  { emballageId: "e4", binnen: 10, handmatig: 20, retour: 6, inHuis: 24 },
  { emballageId: "e5", binnen: 8, handmatig: 35, retour: 12, inHuis: 31 },
  { emballageId: "e7", binnen: 0, handmatig: 0, retour: 2, inHuis: -2 },
  { emballageId: "e8", binnen: 0, handmatig: 4, retour: 0, inHuis: 4 },
];

/* Zoals de database: bedragen alleen voor de beheerder, anders 0. */
const zietBedragen = (new URLSearchParams(window.location.search).get("rol") ?? "beheerder") === "beheerder";
const state = {
  producten: zietBedragen
    ? producten
    : producten.map((x) => ({ ...x, inkoopprijs: 0, statiegeldPerStuk: 0, statiegeldPerVerpakking: 0 })),
  evenementen: zietBedragen ? evenementen : evenementen.map((e) => ({ ...e, omzet: 0 })),
  mutaties, locaties, alleLocaties, voorraad, profielen, tellingen, pakbonnen,
  zalen, evenementZalen, vulplekken, standaardvulling, koppelingen, machines, metingen,
  leveringen, leveringregels,
  emballage: zietBedragen ? emballage : emballage.map((e) => ({ ...e, borg: 0 })),
  emballageRetouren, emballageRetourregels, emballageMutaties, emballageStand,
};

/* Eén wachtende boeking, zodat de balk in de preview te beoordelen is. */
const wachtrij = [
  {
    id: "w1",
    soort: "mutatie" as const,
    gebruikerId: "u1",
    omschrijving: "4 kratten Coca Cola 0,2 L naar Koelcel NBC",
    payload: {},
    aangemaaktOp: dagenGeleden(0),
    pogingen: 2,
    laatsteFout: "Nog geen verbinding.",
  },
];

const mutatiesPerEvenement = new Map<string, Mutatie[]>();
for (const m of mutaties) {
  if (!m.evenementId) continue;
  mutatiesPerEvenement.set(m.evenementId, [...(mutatiesPerEvenement.get(m.evenementId) ?? []), m]);
}

const metingenPerEvenement = new Map<string, Meting[]>();
for (const m of metingen) {
  if (!m.evenementId) continue;
  metingenPerEvenement.set(m.evenementId, [...(metingenPerEvenement.get(m.evenementId) ?? []), m]);
}

const niets = async () => {};
const waarde: Record<string, unknown> = {
  state,
  laden: false,
  fout: null,
  mutatiesPerEvenement,
  metingenPerEvenement,
  hoofdmagazijn: locaties[0],
  uitgiftelocatie: locaties[1],
  herlaad: niets,
  voegEvenementToe: niets,
  wijzigEvenement: niets,
  verwijderEvenement: niets,
  voegProductToe: async () => null,
  wijzigProduct: niets,
  verwijderProduct: niets,
  voegMutatieToe: async () => ({ inWachtrij: false }),
  voegLocatieToe: niets,
  wijzigLocatie: niets,
  verwijderLocatie: niets,
  stelMinVoorraadIn: niets,
  wijzigGebruiker: niets,
  startTelling: async () => "t1",
  haalTellingregels: async (id: string) => tellingregels[id] ?? [],
  zetGeteldAantal: niets,
  zetTelReden: niets,
  rondTellingAf: async () => 2,
  annuleerTelling: niets,
  terugzettenOverzicht: async () => ({
    mutaties: 37,
    pakbonnen: 2,
    tellingen: 1,
    leveringen: 1,
    evenementen: [{ id: "NBC-2026-015", naam: "Najaarsborrel Rabobank", datum: "2026-11-06" }],
    uitgezetMetVoorraad: null,
  }),
  zetTerug: niets,
  haalTerugzettingen: async () => [
    {
      id: "tz1",
      vanaf: "2026-09-14T22:00:00Z",
      reden: "Uitgifte bij de bruiloft niet geboekt",
      gebruikerId: "u1",
      uitgevoerdOp: "2026-09-15T08:12:00Z",
      aantalMutaties: 12,
      aantalEvenementen: 0,
      aantalPakbonnen: 1,
      aantalTellingen: 0,
    },
  ],
  maakPakbon: async () => pakbonnen[0].id,
  zetEvenementZalen: niets,
  zetStandaardvulling: niets,
  boekMeting: niets,
  voegMachineToe: niets,
  wijzigMachine: niets,
  verwijderMachine: niets,
  wijzigKoppeling: niets,
  boekLevering: async () => ({ inWachtrij: false }),
  handelVerschilAf: niets,
  boekEmballageRetour: async () => "er1",
  telEmballage: async () => 0,
  boekEmballageHandmatig: async () => 0,
  wachtrij,
  verstuurWachtrij: niets,
  verwijderUitWachtrij: () => {},
  haalGebruikers: async () => gebruikers,
  maakGebruiker: niets,
  zetWachtwoord: niets,
  zetToegang: niets,
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
