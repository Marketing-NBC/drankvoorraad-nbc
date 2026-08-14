/**
 * Handgeschreven typen die exact overeenkomen met supabase/schema.sql.
 * Bij een schemawijziging: pas hier én in schema.sql aan.
 *
 * Let op: dit moeten `type`-aliassen zijn, geen `interface`s. Een interface
 * heeft in TypeScript geen impliciete index-signature en is daardoor niet
 * toewijsbaar aan het `Record<string, unknown>` dat supabase-js verwacht —
 * het gevolg is dat elke query stilletjes op `never` uitkomt.
 */
import type {
  EvenementStatus,
  GebruikerRol,
  LocatieType,
  Merk,
  MutatieType,
  ProductCategorie,
  TellingStatus,
} from "../data/types";

export type ProfileRow = {
  id: string;
  naam: string;
  rol: GebruikerRol;
  aangemaakt_op: string;
};

export type LocatieRow = {
  id: string;
  naam: string;
  type: LocatieType;
  merk: Merk | null;
  aangemaakt_op: string;
};

export type ProductRow = {
  id: string;
  naam: string;
  sku: string | null;
  barcode: string | null;
  categorie: ProductCategorie;
  leverancier: string | null;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  aangemaakt_op: string;
};

export type VoorraadRow = {
  locatie_id: string;
  product_id: string;
  aantal: number;
  min_voorraad: number;
};

export type EvenementRow = {
  id: string;
  naam: string;
  datum: string;
  merk: Merk;
  opdrachtgever: string | null;
  status: EvenementStatus;
  omzet: number;
  aangemaakt_op: string;
};

export type MutatieRow = {
  id: string;
  product_id: string;
  aantal: number;
  type: MutatieType;
  van_locatie_id: string | null;
  naar_locatie_id: string | null;
  evenement_id: string | null;
  pakbon_id: string | null;
  gebruiker_id: string;
  notitie: string | null;
  datum_tijd: string;
};

export type TellingRow = {
  id: string;
  locatie_id: string;
  status: TellingStatus;
  gebruiker_id: string;
  aangemaakt_op: string;
  afgerond_op: string | null;
};

export type TellingregelRow = {
  id: string;
  telling_id: string;
  product_id: string;
  verwacht_aantal: number;
  geteld_aantal: number | null;
};

export type PakbonRow = {
  id: string;
  evenement_id: string;
  van_locatie_id: string;
  ontvanger_naam: string;
  handtekening: string | null;
  gebruiker_id: string;
  aangemaakt_op: string;
};

/** Velden met een databasedefault mogen bij insert weggelaten worden. */
type MetDefaults<Row, OptioneleVelden extends keyof Row> = Omit<Row, OptioneleVelden> &
  Partial<Pick<Row, OptioneleVelden>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: MetDefaults<ProfileRow, "naam" | "rol" | "aangemaakt_op">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      locaties: {
        Row: LocatieRow;
        Insert: MetDefaults<LocatieRow, "id" | "merk" | "aangemaakt_op">;
        Update: Partial<LocatieRow>;
        Relationships: [];
      };
      producten: {
        Row: ProductRow;
        Insert: MetDefaults<
          ProductRow,
          | "id" | "sku" | "barcode" | "categorie" | "leverancier"
          | "inkoopprijs" | "verkoopprijs" | "eenheid" | "aangemaakt_op"
        >;
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      voorraad: {
        Row: VoorraadRow;
        Insert: MetDefaults<VoorraadRow, "aantal" | "min_voorraad">;
        Update: Partial<VoorraadRow>;
        Relationships: [];
      };
      evenementen: {
        Row: EvenementRow;
        Insert: MetDefaults<EvenementRow, "opdrachtgever" | "status" | "omzet" | "aangemaakt_op">;
        Update: Partial<EvenementRow>;
        Relationships: [];
      };
      mutaties: {
        Row: MutatieRow;
        Insert: MetDefaults<
          MutatieRow,
          | "id" | "van_locatie_id" | "naar_locatie_id" | "evenement_id"
          | "pakbon_id" | "notitie" | "datum_tijd"
        >;
        Update: Partial<MutatieRow>;
        Relationships: [];
      };
      pakbonnen: {
        Row: PakbonRow;
        Insert: MetDefaults<PakbonRow, "id" | "ontvanger_naam" | "handtekening" | "aangemaakt_op">;
        Update: Partial<PakbonRow>;
        Relationships: [];
      };
      tellingen: {
        Row: TellingRow;
        Insert: MetDefaults<TellingRow, "id" | "status" | "aangemaakt_op" | "afgerond_op">;
        Update: Partial<TellingRow>;
        Relationships: [];
      };
      tellingregels: {
        Row: TellingregelRow;
        Insert: MetDefaults<TellingregelRow, "id" | "verwacht_aantal" | "geteld_aantal">;
        Update: Partial<TellingregelRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      stel_min_voorraad: {
        Args: { p_locatie_id: string; p_product_id: string; p_min_voorraad: number };
        Returns: undefined;
      };
      start_telling: {
        Args: { p_locatie_id: string };
        Returns: string;
      };
      rond_telling_af: {
        Args: { p_telling_id: string };
        Returns: number;
      };
      annuleer_telling: {
        Args: { p_telling_id: string };
        Returns: undefined;
      };
      maak_pakbon: {
        Args: {
          p_evenement_id: string;
          p_van_locatie_id: string;
          p_ontvanger_naam: string;
          p_handtekening: string | null;
          p_regels: { product_id: string; aantal: number }[];
        };
        Returns: string;
      };
    };
    Enums: {
      gebruiker_rol: GebruikerRol;
      merk: Merk;
      locatie_type: LocatieType;
      evenement_status: EvenementStatus;
      product_categorie: ProductCategorie;
      mutatie_type: MutatieType;
      telling_status: TellingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
