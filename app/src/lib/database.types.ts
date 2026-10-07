/**
 * Handgeschreven typen die exact overeenkomen met de database: supabase/schema.sql
 * plus alle migraties in supabase/migraties/. Bij een schemawijziging: schrijf
 * een migratie én pas dit bestand aan.
 *
 * Let op: dit moeten `type`-aliassen zijn, geen `interface`s. Een interface
 * heeft in TypeScript geen impliciete index-signature en is daardoor niet
 * toewijsbaar aan het `Record<string, unknown>` dat supabase-js verwacht —
 * het gevolg is dat elke query stilletjes op `never` uitkomt.
 */
import type {
  EvenementStatus,
  GebruikerRol,
  KoppelingSoort,
  LocatieType,
  Merk,
  MetingBron,
  MutatieType,
  ProductCategorie,
  TellingStatus,
  VulplekType,
} from "../data/types";

export type ProfileRow = {
  id: string;
  naam: string;
  rol: GebruikerRol;
  /* `email` staat wel in de tabel maar is voor gewone gebruikers ingetrokken;
     alleen gebruikers_overzicht() geeft hem terug. Zie migratie 017. */
  email: string | null;
  actief: boolean;
  aangemaakt_op: string;
};

export type LeveringRow = {
  id: string;
  locatie_id: string;
  leverancier: string | null;
  bonnummer: string | null;
  aangenomen_door: string;
  gebruiker_id: string;
  opmerking: string | null;
  client_id: string | null;
  aangemaakt_op: string;
};

export type LeveringregelRow = {
  id: string;
  levering_id: string;
  product_id: string;
  aantal_bon: number;
  aantal_werkelijk: number;
  verschil: number;
  notitie: string | null;
  afgehandeld_op: string | null;
  afgehandeld_door: string | null;
};

export type LocatieRow = {
  id: string;
  naam: string;
  type: LocatieType;
  merk: Merk | null;
  voor_personeel: boolean;
  aangemaakt_op: string;
};

export type ProductRow = {
  id: string;
  naam: string;
  sku: string | null;
  barcode: string | null;
  /** Barcode op de krat of doos. Zie migratie 022. */
  barcode_verpakking: string | null;
  categorie: ProductCategorie;
  leverancier: string | null;
  inkoopprijs: number;
  eenheid: string;
  inhoud: string | null;
  verpakking: string | null;
  stuks_per_verpakking: number;
  alleen_per_verpakking: boolean;
  statiegeld_per_stuk: number;
  statiegeld_per_verpakking: number;
  voorraadloos: boolean;
  aangemaakt_op: string;
};

/**
 * Wat iedereen van een product mag lezen. De geldkolommen zijn sinds
 * migratie 019 alleen via productbedragen() te lezen, en alleen door een
 * beheerder.
 */
export type ProductBasisRow = Omit<
  ProductRow,
  "inkoopprijs" | "statiegeld_per_stuk" | "statiegeld_per_verpakking"
>;

export type ZaalRow = {
  id: string;
  naam: string;
  actief: boolean;
  aangemaakt_op: string;
};

export type EvenementZaalRow = {
  evenement_id: string;
  zaal_id: string;
};

export type VulplekRow = {
  id: string;
  naam: string;
  type: VulplekType;
  zaal_id: string | null;
  actief: boolean;
  aangemaakt_op: string;
};

export type VulplekStandaardRow = {
  vulplek_id: string;
  product_id: string;
  aantal: number;
};

export type KoppelingRow = {
  id: string;
  soort: KoppelingSoort;
  naam: string;
  actief: boolean;
  api_basis_url: string | null;
  notitie: string | null;
  laatste_import: string | null;
  laatste_fout: string | null;
  aangemaakt_op: string;
};

export type MachineRow = {
  id: string;
  koppeling_id: string;
  naam: string;
  extern_id: string | null;
  product_id: string;
  zaal_id: string | null;
  actief: boolean;
  aangemaakt_op: string;
};

export type MetingRow = {
  id: string;
  machine_id: string;
  datum: string;
  aantal: number;
  bron: MetingBron;
  extern_id: string | null;
  evenement_id: string | null;
  gebruiker_id: string | null;
  notitie: string | null;
  aangemaakt_op: string;
  bijgewerkt_op: string;
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

/** Zonder omzet: die is alleen via evenementomzet() te lezen (migratie 019). */
export type EvenementBasisRow = Omit<EvenementRow, "omzet">;

/** Een soort emballage. De borg is alleen via emballageborg() te lezen. */
export type EmballageRow = {
  id: string;
  naam: string;
  leverancier: string | null;
  actief: boolean;
  aangemaakt_op: string;
};

export type EmballageRetourRow = {
  id: string;
  leverancier: string;
  bonnummer: string | null;
  opmerking: string | null;
  gebruiker_id: string;
  client_id: string | null;
  aangemaakt_op: string;
};

export type EmballageMutatieRow = {
  id: string;
  emballage_id: string;
  aantal: number;
  type: "uit" | "retour" | "naar-leverancier" | "vermist";
  evenement_id: string | null;
  mutatie_id: string | null;
  retour_id: string | null;
  gebruiker_id: string;
  notitie: string | null;
  datum_tijd: string;
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
  levering_id: string | null;
  gebruiker_id: string;
  notitie: string | null;
  /** Gezet bij een boeking die in de wachtrij stond; uniek in de database. */
  client_id: string | null;
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
        Insert: MetDefaults<ProfileRow, "naam" | "rol" | "email" | "actief" | "aangemaakt_op">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      locaties: {
        Row: LocatieRow;
        Insert: MetDefaults<LocatieRow, "id" | "merk" | "voor_personeel" | "aangemaakt_op">;
        Update: Partial<LocatieRow>;
        Relationships: [];
      };
      producten: {
        Row: ProductRow;
        Insert: MetDefaults<
          ProductRow,
          | "id" | "sku" | "barcode" | "barcode_verpakking" | "categorie" | "leverancier"
          | "inkoopprijs" | "eenheid" | "inhoud" | "verpakking"
          | "stuks_per_verpakking" | "alleen_per_verpakking"
          | "statiegeld_per_stuk" | "statiegeld_per_verpakking"
          | "voorraadloos" | "aangemaakt_op"
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
          | "pakbon_id" | "levering_id" | "client_id" | "notitie" | "datum_tijd"
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
      zalen: {
        Row: ZaalRow;
        Insert: MetDefaults<ZaalRow, "id" | "actief" | "aangemaakt_op">;
        Update: Partial<ZaalRow>;
        Relationships: [];
      };
      evenement_zalen: {
        Row: EvenementZaalRow;
        Insert: EvenementZaalRow;
        Update: Partial<EvenementZaalRow>;
        Relationships: [];
      };
      vulplekken: {
        Row: VulplekRow;
        Insert: MetDefaults<VulplekRow, "id" | "zaal_id" | "actief" | "aangemaakt_op">;
        Update: Partial<VulplekRow>;
        Relationships: [];
      };
      vulplek_standaard: {
        Row: VulplekStandaardRow;
        Insert: VulplekStandaardRow;
        Update: Partial<VulplekStandaardRow>;
        Relationships: [];
      };
      koppelingen: {
        Row: KoppelingRow;
        Insert: MetDefaults<
          KoppelingRow,
          "id" | "actief" | "api_basis_url" | "notitie" | "laatste_import" | "laatste_fout" | "aangemaakt_op"
        >;
        Update: Partial<KoppelingRow>;
        Relationships: [];
      };
      machines: {
        Row: MachineRow;
        Insert: MetDefaults<MachineRow, "id" | "extern_id" | "zaal_id" | "actief" | "aangemaakt_op">;
        Update: Partial<MachineRow>;
        Relationships: [];
      };
      leveringen: {
        Row: LeveringRow;
        Insert: MetDefaults<
          LeveringRow,
          "id" | "leverancier" | "bonnummer" | "aangenomen_door" | "opmerking" | "client_id" | "aangemaakt_op"
        >;
        Update: Partial<LeveringRow>;
        Relationships: [];
      };
      leveringregels: {
        Row: LeveringregelRow;
        Insert: MetDefaults<
          LeveringregelRow,
          "id" | "verschil" | "notitie" | "afgehandeld_op" | "afgehandeld_door"
        >;
        Update: Partial<LeveringregelRow>;
        Relationships: [];
      };
      emballage: {
        Row: EmballageRow;
        Insert: MetDefaults<EmballageRow, "id" | "leverancier" | "actief" | "aangemaakt_op">;
        Update: Partial<EmballageRow>;
        Relationships: [];
      };
      emballage_retouren: {
        Row: EmballageRetourRow;
        Insert: MetDefaults<
          EmballageRetourRow,
          "id" | "bonnummer" | "opmerking" | "client_id" | "aangemaakt_op"
        >;
        Update: Partial<EmballageRetourRow>;
        Relationships: [];
      };
      emballage_mutaties: {
        Row: EmballageMutatieRow;
        Insert: MetDefaults<
          EmballageMutatieRow,
          "id" | "evenement_id" | "mutatie_id" | "retour_id" | "notitie" | "datum_tijd"
        >;
        Update: Partial<EmballageMutatieRow>;
        Relationships: [];
      };
      machine_metingen: {
        Row: MetingRow;
        Insert: MetDefaults<
          MetingRow,
          | "id" | "bron" | "extern_id" | "evenement_id" | "gebruiker_id"
          | "notitie" | "aangemaakt_op" | "bijgewerkt_op"
        >;
        Update: Partial<MetingRow>;
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
      boek_levering: {
        Args: {
          p_locatie_id: string;
          p_leverancier: string | null;
          p_bonnummer: string | null;
          p_aangenomen_door: string;
          p_opmerking: string | null;
          p_regels: {
            product_id: string;
            aantal_bon: number;
            aantal_werkelijk: number;
            notitie?: string | null;
          }[];
          p_client_id?: string | null;
        };
        Returns: string;
      };
      handel_verschil_af: {
        Args: { p_regel_id: string; p_notitie: string | null };
        Returns: undefined;
      };
      gebruikers_overzicht: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          naam: string;
          rol: GebruikerRol;
          email: string | null;
          actief: boolean;
          aangemaakt_op: string;
        }[];
      };
      boek_meting: {
        Args: {
          p_machine_id: string;
          p_datum: string;
          p_aantal: number;
          p_evenement_id?: string | null;
          p_notitie?: string | null;
        };
        Returns: string;
      };
      /**
       * De ingang voor Franke en Aquablu. De app roept hem niet aan — dat doet
       * straks de Edge Function die bij hun API langsgaat. Hij staat hier zodat
       * de vorm van wat er binnenkomt vastligt en meegetypecheckt wordt.
       */
      importeer_metingen: {
        Args: {
          p_soort: KoppelingSoort;
          p_metingen: { machine: string; datum: string; aantal: number; extern_id?: string }[];
        };
        Returns: { verwerkt: number; onbekende_machines: string[] };
      };
      /* ─── Bedragen: alleen voor de beheerder (migratie 019 en 021) ─── */
      productbedragen: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          inkoopprijs: number;
          statiegeld_per_stuk: number;
          statiegeld_per_verpakking: number;
        }[];
      };
      evenementomzet: {
        Args: Record<string, never>;
        Returns: { id: string; omzet: number }[];
      };
      emballageborg: {
        Args: Record<string, never>;
        Returns: { id: string; borg: number }[];
      };
      stel_productbedragen: {
        Args: {
          p_product_id: string;
          p_inkoopprijs: number;
          p_statiegeld_per_stuk: number;
          p_statiegeld_per_verpakking: number;
        };
        Returns: undefined;
      };
      stel_omzet: {
        Args: { p_evenement_id: string; p_omzet: number };
        Returns: undefined;
      };
      boek_emballage_retour: {
        Args: {
          p_leverancier: string;
          p_bonnummer: string | null;
          p_opmerking: string | null;
          p_regels: { emballage_id: string; aantal: number }[];
          p_client_id?: string | null;
        };
        Returns: string;
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
      vulplek_type: VulplekType;
      koppeling_soort: KoppelingSoort;
      meting_bron: MetingBron;
    };
    CompositeTypes: Record<string, never>;
  };
};
