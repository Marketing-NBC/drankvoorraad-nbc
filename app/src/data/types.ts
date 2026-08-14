export type Merk = "NBC" | "Green Village";

export type GebruikerRol = "beheerder" | "magazijnmedewerker" | "evenementmanager";

export type EvenementStatus = "Gepland" | "Actief" | "Afgerond";

export type ProductCategorie = "bier" | "wijn" | "fris" | "sterke drank" | "overig";

export type LocatieType = "magazijn" | "koelcel" | "bar";

export interface Profiel {
  id: string;
  naam: string;
  rol: GebruikerRol;
}

/** merk === null betekent gedeeld tussen NBC en Green Village (het hoofdmagazijn). */
export interface Locatie {
  id: string;
  naam: string;
  type: LocatieType;
  merk: Merk | null;
}

export interface Product {
  id: string;
  naam: string;
  categorie: ProductCategorie;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  sku?: string;
  barcode?: string;
  leverancier?: string;
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
}

export interface Evenement extends EvenementCore {
  omzet: number;
}

export type MutatieType =
  | "magazijn-naar-evenement"
  | "evenement-naar-magazijn"
  | "magazijn-naar-magazijn"
  | "inkoop"
  | "beschadigd"
  | "correctie";

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
}

/** Mutatietypen die meetellen als uitgifte richting een evenement. */
export const UITGIFTE_TYPES: MutatieType[] = ["magazijn-naar-evenement"];

/** Mutatietypen die meetellen als retour vanaf een evenement. */
export const RETOUR_TYPES: MutatieType[] = ["evenement-naar-magazijn"];
