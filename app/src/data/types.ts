export type Merk = "NBC" | "Green Village";

/**
 * Sinds migratie 026: de magazijnmedewerker en de evenementmanager zijn samen
 * "medewerker". Housekeeping regelt alleen het personeelsverbruik.
 */
export type GebruikerRol = "beheerder" | "medewerker" | "housekeeping";

/** De enige twee leveranciers (025, 027). */
export const LEVERANCIERS = ["Swinkels", "Bidfood"] as const;

export type EvenementStatus = "Gepland" | "Actief" | "Afgerond";

export type ProductCategorie =
  | "bier"
  | "wijn"
  | "fris"
  | "sterke drank"
  | "koffie"
  | "water"
  | "overig";

export type LocatieType = "magazijn" | "koelcel" | "bar" | "kantine" | "kroeg";

export interface Profiel {
  id: string;
  naam: string;
  rol: GebruikerRol;
  /** False = toegang ingetrokken; diegene kan niet meer inloggen. */
  actief: boolean;
}

/**
 * Een profiel mét inlognaam, zoals alleen een beheerder het te zien krijgt.
 * Het e-mailadres komt uit `gebruikers_overzicht()` en niet uit een gewone
 * query: de kolom is voor andere rollen ingetrokken.
 */
export interface Gebruiker extends Profiel {
  email?: string;
  aangemaaktOp: string;
}

/** merk === null betekent gedeeld tussen NBC en Green Village (het hoofdmagazijn). */
export interface Locatie {
  id: string;
  naam: string;
  type: LocatieType;
  merk: Merk | null;
  /**
   * Kantine en kroeg: wat hier opgaat is personeelsverbruik en telt nooit mee
   * in de cijfers van een evenement. De database weigert een boeking die die
   * twee mengt — zie supabase/migraties/011_personeelslocaties.sql.
   */
  voorPersoneel: boolean;
}

/**
 * Eén product uit het assortiment.
 *
 * Alles rekent in stuks — flesjes, fusten, glazen. De verpakking bepaalt
 * alleen hoe er ingevoerd wordt: bij `alleenPerVerpakking` vraagt de app
 * kratten en rekent zelf om. Zo blijft een koelkast van 12 flesjes mogelijk
 * terwijl het magazijn nooit losse flesjes hoeft te tellen.
 *
 * Er is geen verkoopprijs: NBC verkoopt per pakket, niet per product. De
 * omzet wordt per evenement ingevuld en daar rekent de marge mee.
 */
export interface Product {
  id: string;
  naam: string;
  categorie: ProductCategorie;
  /**
   * Inkoopprijs en statiegeld zijn alleen voor de beheerder te lezen
   * (migratie 019). Voor andere rollen staan ze hier op 0 — reken er dus
   * alleen mee op een plek die `zietBedragen` respecteert.
   */
  inkoopprijs: number;
  /** Eenheid waarin geteld wordt: fles, fust, kop, glas. */
  eenheid: string;
  /** Inhoud per stuk zoals op de leverancierslijst: "0,2 L", "20 L". */
  inhoud?: string;
  /** Naam van de verpakkingseenheid ("krat"), of leeg als het product los gaat. */
  verpakking?: string;
  /** Aantal stuks in één verpakking; 1 wanneer er geen verpakking is. */
  stuksPerVerpakking: number;
  /** true = in het magazijn nooit los boeken of tellen, altijd per verpakking. */
  alleenPerVerpakking: boolean;
  statiegeldPerStuk: number;
  statiegeldPerVerpakking: number;
  /** true = geen fysieke voorraad. Koffie en water: verbruik komt uit de machines. */
  voorraadloos: boolean;
  sku?: string;
  barcode?: string;
  /** Barcode op de krat of doos — in het magazijn scan je meestal die. */
  barcodeVerpakking?: string;
  leverancier?: string;
  /**
   * Mag in de kantine en de kroeg: de grote flessen fris, radler,
   * alcoholvrij bier en wijn. Zie migratie 027.
   */
  voorPersoneel: boolean;
}

/** Voorraadstand van één product op één locatie. */
export interface Voorraad {
  locatieId: string;
  productId: string;
  aantal: number;
  minVoorraad: number;
}

/**
 * Core event fields, kept separable from MVP-only fields (see Evenement)
 * so a future SEM import can populate exactly this shape without a migration.
 */
export interface EvenementCore {
  id: string;
  naam: string;
  datum: string;
  merk: Merk;
  opdrachtgever?: string;
  status: EvenementStatus;
  /** Hoeveel gasten er waren — voor de consumpties per persoon. */
  aantalPersonen?: number;
}

export interface Evenement extends EvenementCore {
  /** Alleen voor de beheerder te lezen (migratie 019); anders 0. */
  omzet: number;
}

/** Een soort emballage waar borg op zit: krat, fust, PET-fles. */
export interface EmballageSoort {
  id: string;
  naam: string;
  /** Het nummer op de retourbon van de leverancier, bijvoorbeeld 800163. */
  artikelnummer?: string;
  leverancier?: string;
  actief: boolean;
  /** Borg per stuk emballage. Alleen voor de beheerder; anders 0. */
  borg: number;
}

/** Eén keer lege emballage mee terug naar de leverancier. */
export interface EmballageRetour {
  id: string;
  leverancier: string;
  bonnummer?: string;
  opmerking?: string;
  gebruikerId: string;
  aangemaaktOp: string;
}

export interface EmballageRetourregel {
  id: string;
  retourId: string;
  emballageId: string;
  aantal: number;
}

export type MutatieType =
  | "magazijn-naar-evenement"
  | "evenement-naar-magazijn"
  | "magazijn-naar-magazijn"
  | "inkoop"
  | "beschadigd"
  | "correctie"
  | "personeelsverbruik";

/**
 * Eén voorraadbeweging. Append-only: mutaties worden nooit gewijzigd of
 * verwijderd — een correctie is zelf weer een mutatie. Samen met gebruikerId
 * en datumTijd vormt deze tabel het volledige audit trail.
 */
export interface Mutatie {
  id: string;
  productId: string;
  aantal: number;
  type: MutatieType;
  vanLocatieId?: string;
  naarLocatieId?: string;
  evenementId?: string;
  pakbonId?: string;
  gebruikerId: string;
  notitie?: string;
  datumTijd: string;
}

/**
 * Eén overdrachtsmoment magazijn → evenement, ondertekend door de ontvanger.
 * De producten zelf staan niet in deze tabel maar in `mutaties`: elke mutatie
 * met dit pakbonId is een regel op de pakbon. Zo blijft het audit trail de
 * enige bron van waarheid over wat er daadwerkelijk is uitgegeven.
 */
export interface Pakbon {
  id: string;
  evenementId: string;
  vanLocatieId: string;
  ontvangerNaam: string;
  /** PNG als data-URL; leeg wanneer er niet is ondertekend. */
  handtekening?: string;
  gebruikerId: string;
  aangemaaktOp: string;
}

/**
 * Pakbon zonder de handtekening. Een handtekening is een PNG van tientallen
 * kilobytes; die van álle pakbonnen meeladen bij elke herlaad zou de app
 * onnodig traag maken. De lijstweergaven hebben hem niet nodig — alleen de
 * pakbon zelf, en die haalt hem los op.
 */
export type PakbonSamenvatting = Omit<Pakbon, "handtekening">;

/** Eén regel op een nog niet vastgelegde pakbon. */
export interface PakbonRegel {
  productId: string;
  aantal: number;
}

export type TellingStatus = "open" | "afgerond";

export interface Telling {
  id: string;
  locatieId: string;
  status: TellingStatus;
  gebruikerId: string;
  aangemaaktOp: string;
  afgerondOp?: string;
}

export interface Tellingregel {
  id: string;
  tellingId: string;
  productId: string;
  /** Voorraad op het moment dat de telling startte. */
  verwachtAantal: number;
  /** null = nog niet geteld; die producten blijven bij afronden ongemoeid. */
  geteldAantal: number | null;
  /** Wat er met een tekort in het magazijn gebeurd is. */
  reden?: TellingReden;
  redenToelichting?: string;
}

/**
 * Over datum en kapot worden derving; een andere reden blijft een
 * telverschil, met die reden erbij. Zie migratie 027.
 */
export type TellingReden = "over_datum" | "kapot" | "anders";

/** Welk product er hoort bij een artikelnummer op de afleverbon. */
export interface LeverancierArtikel {
  leverancier: string;
  artikelnummer: string;
  omschrijving?: string;
  productId: string;
  /** Stuks in één eenheid op de bon: krat 24, tray 12, fust 1. */
  stuksPerEenheid: number;
}

/** Personeelsverbruik: gaat van de kantine of de kroeg af en nergens heen. */
export const PERSONEELSVERBRUIK: MutatieType = "personeelsverbruik";

/** Mutatietypen die meetellen als uitgifte richting een evenement. */
export const UITGIFTE_TYPES: MutatieType[] = ["magazijn-naar-evenement"];

/** Mutatietypen die meetellen als retour vanaf een evenement. */
export const RETOUR_TYPES: MutatieType[] = ["evenement-naar-magazijn"];

// ─── Zalen, vulplekken en machines ────────────────────────────────────────────

/** Een ruimte waar een evenement plaatsvindt. Hier wordt géén drank naartoe geboekt. */
export interface Zaal {
  id: string;
  naam: string;
  actief: boolean;
}

export type VulplekType = "koelkast" | "bar";

/**
 * Een koelkast of bar die bijgevuld wordt. Bewust géén voorraadlocatie: uit een
 * koelkast wordt niet geboekt, er wordt uit gedronken. Zou de app er voorraad
 * van bijhouden, dan bleef die eeuwig vol staan.
 */
export interface Vulplek {
  id: string;
  naam: string;
  type: VulplekType;
  zaalId?: string;
  actief: boolean;
}

/** Eén regel van de standaardvulling van een vulplek, in stuks. */
export interface VulplekRegel {
  vulplekId: string;
  productId: string;
  aantal: number;
}

export type KoppelingSoort = "franke" | "aquablu";

/**
 * Een koppeling met het systeem van een leverancier. `actief` staat op false
 * zolang die er niet is; er wordt dan handmatig ingevoerd, op precies dezelfde
 * plek. Er staat geen sleutel of wachtwoord in — die horen in de omgeving van
 * de Edge Function die de import doet.
 */
export interface Koppeling {
  id: string;
  soort: KoppelingSoort;
  naam: string;
  actief: boolean;
  apiBasisUrl?: string;
  notitie?: string;
  laatsteImport?: string;
  laatsteFout?: string;
}

/** Een koffiemachine of watertappunt, gekoppeld aan de zaal waar hij staat. */
export interface Machine {
  id: string;
  koppelingId: string;
  naam: string;
  /** Het nummer waaronder de machine bij Franke of Aquablu bekend staat. */
  externId?: string;
  productId: string;
  zaalId?: string;
  actief: boolean;
}

export type MetingBron = "handmatig" | "koppeling";

/**
 * Het dagtotaal van één machine. Geen voorraadmutatie: er is geen voorraad om
 * af te boeken. Eén regel per machine per dag — een dagtotaal is een waarneming
 * die je corrigeert, niet een boeking die je terugdraait.
 */
export interface Meting {
  id: string;
  machineId: string;
  datum: string;
  aantal: number;
  bron: MetingBron;
  evenementId?: string;
  gebruikerId?: string;
  notitie?: string;
}

// ─── Leveringen ───────────────────────────────────────────────────────────────

/**
 * Eén levering die is aangenomen.
 *
 * `aangenomenDoor` is een ingetypte naam en geen gebruiker, omdat Post met
 * één gedeeld account werkt: er loopt elke dag iemand anders beneden. Wie het
 * aannam typ je in, zodat je bij een verschil niet het rooster erbij hoeft
 * te pakken.
 */
export interface Levering {
  id: string;
  locatieId: string;
  leverancier?: string;
  bonnummer?: string;
  aangenomenDoor: string;
  gebruikerId: string;
  opmerking?: string;
  aangemaaktOp: string;
}

/**
 * Eén regel van een levering: wat er op de bon stond en wat er werkelijk was.
 *
 * De voorraad gaat omhoog met `aantalWerkelijk`, nooit met `aantalBon`. Het
 * verschil blijft staan als openstaand punt richting de leverancier tot
 * iemand het afhandelt.
 */
export interface Leveringregel {
  id: string;
  leveringId: string;
  productId: string;
  aantalBon: number;
  aantalWerkelijk: number;
  /** aantalWerkelijk − aantalBon. Negatief = er kwam te weinig. */
  verschil: number;
  notitie?: string;
  afgehandeldOp?: string;
  afgehandeldDoor?: string;
}

/** Eén regel op een levering die nog niet is vastgelegd. */
export interface NieuweLeveringregel {
  productId: string;
  aantalBon: number;
  aantalWerkelijk: number;
  notitie?: string;
}
