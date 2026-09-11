import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import {
  haalUitWachtrij,
  isAlBinnen,
  isNetwerkfout,
  leesWachtrij,
  nieuwKenmerk,
  voegToeAanWachtrij,
  werkItemBij,
  type WachtrijItem,
} from "../lib/wachtrij";
import type {
  EvenementRow,
  EvenementZaalRow,
  KoppelingRow,
  LeveringRow,
  LeveringregelRow,
  LocatieRow,
  MachineRow,
  MetingRow,
  MutatieRow,
  PakbonRow,
  ProductRow,
  ProfileRow,
  TellingRow,
  TellingregelRow,
  VoorraadRow,
  VulplekRow,
  VulplekStandaardRow,
  ZaalRow,
} from "../lib/database.types";
import type {
  Evenement,
  GebruikerRol,
  Gebruiker,
  Koppeling,
  Levering,
  Leveringregel,
  Locatie,
  Machine,
  NieuweLeveringregel,
  Meting,
  Mutatie,
  Pakbon,
  PakbonRegel,
  PakbonSamenvatting,
  Product,
  Profiel,
  Telling,
  Tellingregel,
  Voorraad,
  Vulplek,
  VulplekRegel,
  Zaal,
} from "../data/types";
import { useAuth } from "./AuthContext";

// ─── Row → app-model mapping (snake_case in de database, camelCase in de app) ──

function naarProduct(r: ProductRow): Product {
  return {
    id: r.id,
    naam: r.naam,
    categorie: r.categorie,
    inkoopprijs: Number(r.inkoopprijs),
    eenheid: r.eenheid,
    inhoud: r.inhoud ?? undefined,
    verpakking: r.verpakking ?? undefined,
    stuksPerVerpakking: r.stuks_per_verpakking ?? 1,
    alleenPerVerpakking: r.alleen_per_verpakking ?? false,
    statiegeldPerStuk: Number(r.statiegeld_per_stuk ?? 0),
    statiegeldPerVerpakking: Number(r.statiegeld_per_verpakking ?? 0),
    voorraadloos: r.voorraadloos ?? false,
    sku: r.sku ?? undefined,
    barcode: r.barcode ?? undefined,
    leverancier: r.leverancier ?? undefined,
  };
}

function naarZaal(r: ZaalRow): Zaal {
  return { id: r.id, naam: r.naam, actief: r.actief };
}

function naarVulplek(r: VulplekRow): Vulplek {
  return { id: r.id, naam: r.naam, type: r.type, zaalId: r.zaal_id ?? undefined, actief: r.actief };
}

function naarVulplekRegel(r: VulplekStandaardRow): VulplekRegel {
  return { vulplekId: r.vulplek_id, productId: r.product_id, aantal: r.aantal };
}

function naarKoppeling(r: KoppelingRow): Koppeling {
  return {
    id: r.id,
    soort: r.soort,
    naam: r.naam,
    actief: r.actief,
    apiBasisUrl: r.api_basis_url ?? undefined,
    notitie: r.notitie ?? undefined,
    laatsteImport: r.laatste_import ?? undefined,
    laatsteFout: r.laatste_fout ?? undefined,
  };
}

function naarMachine(r: MachineRow): Machine {
  return {
    id: r.id,
    koppelingId: r.koppeling_id,
    naam: r.naam,
    externId: r.extern_id ?? undefined,
    productId: r.product_id,
    zaalId: r.zaal_id ?? undefined,
    actief: r.actief,
  };
}

function naarMeting(r: MetingRow): Meting {
  return {
    id: r.id,
    machineId: r.machine_id,
    datum: r.datum,
    aantal: r.aantal,
    bron: r.bron,
    evenementId: r.evenement_id ?? undefined,
    gebruikerId: r.gebruiker_id ?? undefined,
    notitie: r.notitie ?? undefined,
  };
}

function naarEvenement(r: EvenementRow): Evenement {
  return {
    id: r.id,
    naam: r.naam,
    datum: r.datum,
    merk: r.merk,
    opdrachtgever: r.opdrachtgever ?? undefined,
    status: r.status,
    omzet: Number(r.omzet),
  };
}

function naarMutatie(r: MutatieRow): Mutatie {
  return {
    id: r.id,
    productId: r.product_id,
    aantal: r.aantal,
    type: r.type,
    vanLocatieId: r.van_locatie_id ?? undefined,
    naarLocatieId: r.naar_locatie_id ?? undefined,
    evenementId: r.evenement_id ?? undefined,
    pakbonId: r.pakbon_id ?? undefined,
    gebruikerId: r.gebruiker_id,
    notitie: r.notitie ?? undefined,
    datumTijd: r.datum_tijd,
  };
}

function naarLocatie(r: LocatieRow): Locatie {
  return {
    id: r.id,
    naam: r.naam,
    type: r.type,
    merk: r.merk,
    voorPersoneel: r.voor_personeel ?? false,
  };
}

function naarProfiel(r: Pick<ProfileRow, "id" | "naam" | "rol" | "actief">): Profiel {
  return { id: r.id, naam: r.naam, rol: r.rol, actief: r.actief ?? true };
}

function naarLevering(r: LeveringRow): Levering {
  return {
    id: r.id,
    locatieId: r.locatie_id,
    leverancier: r.leverancier ?? undefined,
    bonnummer: r.bonnummer ?? undefined,
    aangenomenDoor: r.aangenomen_door,
    gebruikerId: r.gebruiker_id,
    opmerking: r.opmerking ?? undefined,
    aangemaaktOp: r.aangemaakt_op,
  };
}

function naarLeveringregel(r: LeveringregelRow): Leveringregel {
  return {
    id: r.id,
    leveringId: r.levering_id,
    productId: r.product_id,
    aantalBon: r.aantal_bon,
    aantalWerkelijk: r.aantal_werkelijk,
    verschil: r.verschil,
    notitie: r.notitie ?? undefined,
    afgehandeldOp: r.afgehandeld_op ?? undefined,
    afgehandeldDoor: r.afgehandeld_door ?? undefined,
  };
}

function naarTelling(r: TellingRow): Telling {
  return {
    id: r.id,
    locatieId: r.locatie_id,
    status: r.status,
    gebruikerId: r.gebruiker_id,
    aangemaaktOp: r.aangemaakt_op,
    afgerondOp: r.afgerond_op ?? undefined,
  };
}

function naarTellingregel(r: TellingregelRow): Tellingregel {
  return {
    id: r.id,
    tellingId: r.telling_id,
    productId: r.product_id,
    verwachtAantal: r.verwacht_aantal,
    geteldAantal: r.geteld_aantal,
  };
}

function naarPakbonSamenvatting(r: Omit<PakbonRow, "handtekening">): PakbonSamenvatting {
  return {
    id: r.id,
    evenementId: r.evenement_id,
    vanLocatieId: r.van_locatie_id,
    ontvangerNaam: r.ontvanger_naam,
    gebruikerId: r.gebruiker_id,
    aangemaaktOp: r.aangemaakt_op,
  };
}

function naarPakbon(r: PakbonRow): Pakbon {
  return { ...naarPakbonSamenvatting(r), handtekening: r.handtekening ?? undefined };
}

function naarVoorraad(r: VoorraadRow): Voorraad {
  return {
    locatieId: r.locatie_id,
    productId: r.product_id,
    aantal: r.aantal,
    minVoorraad: r.min_voorraad,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface AppState {
  producten: Product[];
  evenementen: Evenement[];
  mutaties: Mutatie[];
  locaties: Locatie[];
  voorraad: Voorraad[];
  profielen: Profiel[];
  tellingen: Telling[];
  pakbonnen: PakbonSamenvatting[];
  zalen: Zaal[];
  /** Welke zalen bij welk evenement horen. */
  evenementZalen: { evenementId: string; zaalId: string }[];
  vulplekken: Vulplek[];
  standaardvulling: VulplekRegel[];
  koppelingen: Koppeling[];
  machines: Machine[];
  metingen: Meting[];
  leveringen: Levering[];
  leveringregels: Leveringregel[];
}

interface AppStateContextValue {
  state: AppState;
  laden: boolean;
  fout: string | null;
  mutatiesPerEvenement: Map<string, Mutatie[]>;
  /** Machineverbruik per evenement — koffie en water, gekoppeld via de zaal. */
  metingenPerEvenement: Map<string, Meting[]>;
  /** Het gedeelde hoofdmagazijn (merk === null). */
  hoofdmagazijn: Locatie | undefined;
  herlaad: () => Promise<void>;
  voegEvenementToe: (evenement: Evenement) => Promise<void>;
  wijzigEvenement: (id: string, changes: Partial<Omit<Evenement, "id">>) => Promise<void>;
  verwijderEvenement: (id: string) => Promise<void>;
  voegProductToe: (product: Omit<Product, "id">) => Promise<Product | null>;
  wijzigProduct: (id: string, changes: Partial<Omit<Product, "id">>) => Promise<void>;
  verwijderProduct: (id: string) => Promise<void>;
  /**
   * Boeking wegschrijven. Valt de verbinding weg, dan gaat hij niet verloren
   * maar de wachtrij in en wordt hij later alsnog verstuurd — de belofte aan
   * degene met de kar in zijn hand. `omschrijving` is wat er dan in die
   * wachtrij te lezen staat.
   */
  voegMutatieToe: (
    mutatie: Omit<Mutatie, "id" | "gebruikerId" | "datumTijd">,
    opties?: { omschrijving?: string }
  ) => Promise<{ inWachtrij: boolean }>;
  voegLocatieToe: (locatie: Omit<Locatie, "id">) => Promise<void>;
  wijzigLocatie: (id: string, changes: Partial<Omit<Locatie, "id">>) => Promise<void>;
  verwijderLocatie: (id: string) => Promise<void>;
  stelMinVoorraadIn: (locatieId: string, productId: string, minVoorraad: number) => Promise<void>;
  wijzigGebruiker: (id: string, changes: { naam?: string; rol?: GebruikerRol }) => Promise<void>;
  startTelling: (locatieId: string) => Promise<string>;
  haalTellingregels: (tellingId: string) => Promise<Tellingregel[]>;
  zetGeteldAantal: (regelId: string, aantal: number | null) => Promise<void>;
  rondTellingAf: (tellingId: string) => Promise<number>;
  annuleerTelling: (tellingId: string) => Promise<void>;
  maakPakbon: (pakbon: {
    evenementId: string;
    vanLocatieId: string;
    ontvangerNaam: string;
    handtekening: string | null;
    regels: PakbonRegel[];
  }) => Promise<string>;
  haalPakbon: (pakbonId: string) => Promise<Pakbon | null>;
  zetEvenementZalen: (evenementId: string, zaalIds: string[]) => Promise<void>;
  zetStandaardvulling: (vulplekId: string, productId: string, aantal: number) => Promise<void>;
  boekMeting: (meting: {
    machineId: string;
    datum: string;
    aantal: number;
    evenementId?: string | null;
    notitie?: string | null;
  }) => Promise<void>;
  voegMachineToe: (machine: Omit<Machine, "id">) => Promise<void>;
  wijzigMachine: (id: string, changes: Partial<Omit<Machine, "id">>) => Promise<void>;
  verwijderMachine: (id: string) => Promise<void>;
  wijzigKoppeling: (
    id: string,
    changes: { actief?: boolean; apiBasisUrl?: string | null; notitie?: string | null }
  ) => Promise<void>;
  boekLevering: (levering: {
    locatieId: string;
    leverancier?: string;
    bonnummer?: string;
    aangenomenDoor: string;
    opmerking?: string;
    regels: NieuweLeveringregel[];
  }) => Promise<{ inWachtrij: boolean }>;
  handelVerschilAf: (regelId: string, notitie: string) => Promise<void>;
  /** Boekingen die op verbinding wachten, van iedereen die dit apparaat gebruikte. */
  wachtrij: WachtrijItem[];
  verstuurWachtrij: () => Promise<void>;
  /** Weggooien wat nooit gaat lukken — alleen met de hand, nooit vanzelf. */
  verwijderUitWachtrij: (id: string) => void;
  haalGebruikers: () => Promise<Gebruiker[]>;
  maakGebruiker: (gegevens: {
    naam: string;
    email: string;
    wachtwoord: string;
    rol: GebruikerRol;
  }) => Promise<void>;
  zetWachtwoord: (gebruikerId: string, wachtwoord: string) => Promise<void>;
  zetToegang: (gebruikerId: string, actief: boolean) => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const legeState: AppState = {
  producten: [], evenementen: [], mutaties: [], locaties: [], voorraad: [],
  profielen: [], tellingen: [], pakbonnen: [], zalen: [], evenementZalen: [],
  vulplekken: [], standaardvulling: [], koppelingen: [], machines: [], metingen: [],
  leveringen: [], leveringregels: [],
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState<AppState>(legeState);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [wachtrij, setWachtrij] = useState<WachtrijItem[]>(() => leesWachtrij());
  const alEensGeladen = useRef(false);
  const versturenBezig = useRef(false);

  const herlaad = useCallback(async () => {
    // Alleen de allereerste keer een laadscherm tonen. Elke verversing daarna
    // — door realtime, of na een eigen actie — moet stil gebeuren. Zou `laden`
    // opnieuw true worden, dan vervangen alle schermen zichzelf door "Bezig met
    // laden…" en monteert React ze daarna opnieuw. Alles wat de gebruiker nog
    // niet had opgeslagen is dan weg: een half ingevulde pakbon, een gezette
    // handtekening. Dat gebeurt juist op een drukke dag, wanneer een collega
    // ergens anders in de app iets boekt.
    if (!alEensGeladen.current) setLaden(true);
    setFout(null);

    async function haalAllesOp() {
      const [
        producten, evenementen, mutaties, locaties, voorraad, profielen, tellingen, pakbonnen,
        zalen, evenementZalen, vulplekken, standaardvulling, koppelingen, machines, metingen,
        leveringen, leveringregels,
      ] = await Promise.all([
        supabase.from("producten").select("*").order("naam"),
        supabase.from("evenementen").select("*").order("datum"),
        supabase.from("mutaties").select("*").order("datum_tijd", { ascending: false }),
        supabase.from("locaties").select("*").order("naam"),
        supabase.from("voorraad").select("*"),
        supabase.from("profiles").select("id, naam, rol, actief").order("naam"),
        supabase.from("tellingen").select("*").order("aangemaakt_op", { ascending: false }),
        // Bewust zonder `handtekening`: zie PakbonSamenvatting.
        supabase
          .from("pakbonnen")
          .select("id, evenement_id, van_locatie_id, ontvanger_naam, gebruiker_id, aangemaakt_op")
          .order("aangemaakt_op", { ascending: false }),
        supabase.from("zalen").select("*").order("naam"),
        supabase.from("evenement_zalen").select("*"),
        supabase.from("vulplekken").select("*").order("naam"),
        supabase.from("vulplek_standaard").select("*"),
        supabase.from("koppelingen").select("*").order("naam"),
        supabase.from("machines").select("*").order("naam"),
        supabase.from("machine_metingen").select("*").order("datum", { ascending: false }),
        supabase.from("leveringen").select("*").order("aangemaakt_op", { ascending: false }),
        supabase.from("leveringregels").select("*"),
      ]);
      const eersteFout =
        producten.error ?? evenementen.error ?? mutaties.error ?? locaties.error ??
        voorraad.error ?? profielen.error ?? tellingen.error ?? pakbonnen.error ??
        zalen.error ?? evenementZalen.error ?? vulplekken.error ?? standaardvulling.error ??
        koppelingen.error ?? machines.error ?? metingen.error ??
        leveringen.error ?? leveringregels.error;
      return {
        producten, evenementen, mutaties, locaties, voorraad, profielen, tellingen, pakbonnen,
        zalen, evenementZalen, vulplekken, standaardvulling, koppelingen, machines, metingen,
        leveringen, leveringregels, eersteFout,
      };
    }

    // Eén keer opnieuw proberen: vlak na het inloggen kan de eerste aanvraag
    // nog net vóór de sessie aankomen, en een korte netwerkhapering hoeft de
    // gebruiker geen foutmelding op te leveren.
    let resultaat = await haalAllesOp();
    if (resultaat.eersteFout) {
      await new Promise((r) => setTimeout(r, 600));
      resultaat = await haalAllesOp();
    }

    if (resultaat.eersteFout) {
      setFout("Gegevens ophalen is niet gelukt. Controleer je verbinding en probeer opnieuw.");
      setLaden(false);
      return;
    }

    setState({
      producten: (resultaat.producten.data ?? []).map(naarProduct),
      evenementen: (resultaat.evenementen.data ?? []).map(naarEvenement),
      mutaties: (resultaat.mutaties.data ?? []).map(naarMutatie),
      locaties: (resultaat.locaties.data ?? []).map(naarLocatie),
      voorraad: (resultaat.voorraad.data ?? []).map(naarVoorraad),
      profielen: (resultaat.profielen.data ?? []).map(naarProfiel),
      tellingen: (resultaat.tellingen.data ?? []).map(naarTelling),
      pakbonnen: (resultaat.pakbonnen.data ?? []).map(naarPakbonSamenvatting),
      zalen: (resultaat.zalen.data ?? []).map(naarZaal),
      evenementZalen: (resultaat.evenementZalen.data ?? []).map((r: EvenementZaalRow) => ({
        evenementId: r.evenement_id,
        zaalId: r.zaal_id,
      })),
      vulplekken: (resultaat.vulplekken.data ?? []).map(naarVulplek),
      standaardvulling: (resultaat.standaardvulling.data ?? []).map(naarVulplekRegel),
      koppelingen: (resultaat.koppelingen.data ?? []).map(naarKoppeling),
      machines: (resultaat.machines.data ?? []).map(naarMachine),
      metingen: (resultaat.metingen.data ?? []).map(naarMeting),
      leveringen: (resultaat.leveringen.data ?? []).map(naarLevering),
      leveringregels: (resultaat.leveringregels.data ?? []).map(naarLeveringregel),
    });
    alEensGeladen.current = true;
    setLaden(false);
  }, []);

  useEffect(() => {
    if (!session) {
      setState(legeState);
      // Na uitloggen begint de volgende gebruiker weer met een leeg scherm,
      // dus mag het laadscherm er dan wél weer zijn.
      alEensGeladen.current = false;
      setLaden(false);
      return;
    }
    void herlaad();
  }, [session, herlaad]);

  // Realtime: wijzigingen op een ander apparaat komen automatisch binnen.
  useEffect(() => {
    if (!session) return;
    const kanaal = supabase
      .channel("drankvoorraad")
      .on("postgres_changes", { event: "*", schema: "public", table: "mutaties" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "evenementen" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "producten" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "voorraad" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "locaties" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "pakbonnen" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "evenement_zalen" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "machine_metingen" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "vulplek_standaard" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "leveringen" }, () => void herlaad())
      .on("postgres_changes", { event: "*", schema: "public", table: "leveringregels" }, () => void herlaad())
      .subscribe();

    return () => {
      void supabase.removeChannel(kanaal);
    };
  }, [session, herlaad]);

  const mutatiesPerEvenement = useMemo(() => {
    const map = new Map<string, Mutatie[]>();
    for (const m of state.mutaties) {
      if (!m.evenementId) continue;
      const list = map.get(m.evenementId) ?? [];
      list.push(m);
      map.set(m.evenementId, list);
    }
    return map;
  }, [state.mutaties]);

  /**
   * Eén wachtend item alsnog wegschrijven. Gooit door wat er misgaat; de
   * aanroeper hieronder beslist of dat wachten of weggooien betekent.
   */
  const verstuurItem = useCallback(async (item: WachtrijItem) => {
    if (item.soort === "mutatie") {
      const p = item.payload as Omit<Mutatie, "id" | "gebruikerId" | "datumTijd">;
      const { error } = await supabase.from("mutaties").insert({
        product_id: p.productId,
        aantal: p.aantal,
        type: p.type,
        van_locatie_id: p.vanLocatieId ?? null,
        naar_locatie_id: p.naarLocatieId ?? null,
        evenement_id: p.evenementId ?? null,
        pakbon_id: p.pakbonId ?? null,
        gebruiker_id: item.gebruikerId,
        notitie: p.notitie ?? null,
        client_id: item.id,
      });
      if (error) throw error;
      return;
    }

    const p = item.payload as {
      locatieId: string;
      leverancier?: string;
      bonnummer?: string;
      aangenomenDoor: string;
      opmerking?: string;
      regels: NieuweLeveringregel[];
    };
    const { error } = await supabase.rpc("boek_levering", {
      p_locatie_id: p.locatieId,
      p_leverancier: p.leverancier ?? null,
      p_bonnummer: p.bonnummer ?? null,
      p_aangenomen_door: p.aangenomenDoor,
      p_opmerking: p.opmerking ?? null,
      p_regels: p.regels.map((r) => ({
        product_id: r.productId,
        aantal_bon: r.aantalBon,
        aantal_werkelijk: r.aantalWerkelijk,
        notitie: r.notitie ?? null,
      })),
      p_client_id: item.id,
    });
    if (error) throw error;
  }, []);

  /**
   * De wachtrij leegmaken, op volgorde van binnenkomst.
   *
   * Alleen boekingen van wie er nú is ingelogd: elke boeking staat op naam,
   * en de database accepteert alleen mutaties op naam van de ingelogde
   * gebruiker. Wisselt er iemand van account op een gedeelde tablet, dan
   * blijven de boekingen van de ander gewoon staan tot die weer inlogt.
   *
   * Een netwerkfout stopt de hele ronde — heeft de verbinding het bij de
   * eerste al begeven, dan hoeven de rest ook niet. Een weigering van de
   * server is iets anders: die boeking gaat nooit landen, dus blijft hij
   * staan mét de melding erbij, zodat iemand ernaar kan kijken.
   */
  const verstuurWachtrij = useCallback(async () => {
    if (versturenBezig.current) return;
    const eigenaar = session?.user.id;
    if (!eigenaar) return;
    if (leesWachtrij().every((i) => i.gebruikerId !== eigenaar)) return;

    versturenBezig.current = true;
    let ietsGelukt = false;
    try {
      let items = leesWachtrij();
      for (const item of items) {
        if (item.gebruikerId !== eigenaar) continue;

        try {
          await verstuurItem(item);
          items = haalUitWachtrij(item.id);
          ietsGelukt = true;
        } catch (verzendfout) {
          if (isAlBinnen(verzendfout)) {
            // Was al binnen bij een eerdere poging; het kenmerk hield hem tegen.
            items = haalUitWachtrij(item.id);
            ietsGelukt = true;
            continue;
          }
          const bericht =
            verzendfout instanceof Error ? verzendfout.message : "Versturen is niet gelukt.";
          items = werkItemBij(item.id, {
            pogingen: item.pogingen + 1,
            laatsteFout: isNetwerkfout(verzendfout) ? "Nog geen verbinding." : bericht,
          });
          if (isNetwerkfout(verzendfout)) break;
        }
      }
      setWachtrij(items);
    } finally {
      versturenBezig.current = false;
    }

    if (ietsGelukt) await herlaad();
  }, [session, verstuurItem, herlaad]);

  /* Zodra het bereik terug is, en verder elke minuut: er is geen enkele
     reden om te wachten tot iemand de app weer openslaat. */
  useEffect(() => {
    if (!session) return;
    void verstuurWachtrij();

    const bijVerbinding = () => void verstuurWachtrij();
    window.addEventListener("online", bijVerbinding);
    const klok = window.setInterval(bijVerbinding, 60_000);

    return () => {
      window.removeEventListener("online", bijVerbinding);
      window.clearInterval(klok);
    };
  }, [session, verstuurWachtrij]);

  const metingenPerEvenement = useMemo(() => {
    const map = new Map<string, Meting[]>();
    for (const meting of state.metingen) {
      if (!meting.evenementId) continue;
      const list = map.get(meting.evenementId) ?? [];
      list.push(meting);
      map.set(meting.evenementId, list);
    }
    return map;
  }, [state.metingen]);

  const hoofdmagazijn = useMemo(
    () => state.locaties.find((l) => l.merk === null && l.type === "magazijn"),
    [state.locaties]
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      laden,
      fout,
      mutatiesPerEvenement,
      metingenPerEvenement,
      hoofdmagazijn,
      herlaad,

      async voegEvenementToe(evenement) {
        const { error } = await supabase.from("evenementen").insert({
          id: evenement.id,
          naam: evenement.naam,
          datum: evenement.datum,
          merk: evenement.merk,
          opdrachtgever: evenement.opdrachtgever ?? null,
          status: evenement.status,
          omzet: evenement.omzet,
        });
        if (error) throw error;
        await herlaad();
      },

      async wijzigEvenement(id, changes) {
        const { error } = await supabase
          .from("evenementen")
          .update({
            ...(changes.naam !== undefined && { naam: changes.naam }),
            ...(changes.datum !== undefined && { datum: changes.datum }),
            ...(changes.merk !== undefined && { merk: changes.merk }),
            ...(changes.opdrachtgever !== undefined && { opdrachtgever: changes.opdrachtgever ?? null }),
            ...(changes.status !== undefined && { status: changes.status }),
            ...(changes.omzet !== undefined && { omzet: changes.omzet }),
          })
          .eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      /**
       * Verwijdert een evenement. Lukt alleen zolang er niets aan hangt: de
       * database blokkeert het met `on delete restrict` zodra er mutaties,
       * of pakbonnen aan gekoppeld zijn. Dat is bewust —
       * een audit trail die verdwijnt omdat iemand een evenement weggooit is
       * geen audit trail. Bedoeld voor het opruimen van een evenement dat per
       * ongeluk is aangemaakt.
       */
      async verwijderEvenement(id) {
        const { error } = await supabase.from("evenementen").delete().eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async voegProductToe(product) {
        const { data, error } = await supabase
          .from("producten")
          .insert({
            naam: product.naam,
            categorie: product.categorie,
            inkoopprijs: product.inkoopprijs,
            eenheid: product.eenheid,
            inhoud: product.inhoud ?? null,
            verpakking: product.verpakking ?? null,
            stuks_per_verpakking: product.stuksPerVerpakking,
            alleen_per_verpakking: product.alleenPerVerpakking,
            statiegeld_per_stuk: product.statiegeldPerStuk,
            statiegeld_per_verpakking: product.statiegeldPerVerpakking,
            voorraadloos: product.voorraadloos,
            sku: product.sku ?? null,
            barcode: product.barcode ?? null,
            leverancier: product.leverancier ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        await herlaad();
        return data ? naarProduct(data) : null;
      },

      async wijzigProduct(id, changes) {
        const { error } = await supabase
          .from("producten")
          .update({
            ...(changes.naam !== undefined && { naam: changes.naam }),
            ...(changes.categorie !== undefined && { categorie: changes.categorie }),
            ...(changes.inkoopprijs !== undefined && { inkoopprijs: changes.inkoopprijs }),
            ...(changes.eenheid !== undefined && { eenheid: changes.eenheid }),
            ...(changes.inhoud !== undefined && { inhoud: changes.inhoud ?? null }),
            ...(changes.verpakking !== undefined && { verpakking: changes.verpakking ?? null }),
            ...(changes.stuksPerVerpakking !== undefined && {
              stuks_per_verpakking: changes.stuksPerVerpakking,
            }),
            ...(changes.alleenPerVerpakking !== undefined && {
              alleen_per_verpakking: changes.alleenPerVerpakking,
            }),
            ...(changes.statiegeldPerStuk !== undefined && {
              statiegeld_per_stuk: changes.statiegeldPerStuk,
            }),
            ...(changes.statiegeldPerVerpakking !== undefined && {
              statiegeld_per_verpakking: changes.statiegeldPerVerpakking,
            }),
            ...(changes.voorraadloos !== undefined && { voorraadloos: changes.voorraadloos }),
            ...(changes.sku !== undefined && { sku: changes.sku ?? null }),
            ...(changes.barcode !== undefined && { barcode: changes.barcode ?? null }),
            ...(changes.leverancier !== undefined && { leverancier: changes.leverancier ?? null }),
          })
          .eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async verwijderProduct(id) {
        const { error } = await supabase.from("producten").delete().eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async voegMutatieToe(mutatie, opties) {
        if (!session) throw new Error("Niet ingelogd.");
        const kenmerk = nieuwKenmerk();

        try {
          const { error } = await supabase.from("mutaties").insert({
            product_id: mutatie.productId,
            aantal: mutatie.aantal,
            type: mutatie.type,
            van_locatie_id: mutatie.vanLocatieId ?? null,
            naar_locatie_id: mutatie.naarLocatieId ?? null,
            evenement_id: mutatie.evenementId ?? null,
            pakbon_id: mutatie.pakbonId ?? null,
            gebruiker_id: session.user.id,
            notitie: mutatie.notitie ?? null,
            client_id: kenmerk,
          });
          if (error) throw error;
        } catch (boekfout) {
          /* Alleen een haperende verbinding gaat de wachtrij in. Een
             weigering van de database — geen rechten, personeelsverbruik aan
             een evenement — moet de gebruiker nú zien; die boeking gaat
             later ook niet lukken. */
          if (!isNetwerkfout(boekfout)) throw boekfout;

          setWachtrij(
            voegToeAanWachtrij({
              id: kenmerk,
              soort: "mutatie",
              gebruikerId: session.user.id,
              omschrijving: opties?.omschrijving ?? "Voorraadboeking",
              payload: mutatie,
              aangemaaktOp: new Date().toISOString(),
              pogingen: 1,
              laatsteFout: "Nog geen verbinding.",
            })
          );
          return { inWachtrij: true };
        }

        await herlaad();
        return { inWachtrij: false };
      },

      async voegLocatieToe(locatie) {
        const { error } = await supabase.from("locaties").insert({
          naam: locatie.naam,
          type: locatie.type,
          merk: locatie.merk,
          voor_personeel: locatie.voorPersoneel,
        });
        if (error) throw error;
        await herlaad();
      },

      async wijzigLocatie(id, changes) {
        const { error } = await supabase
          .from("locaties")
          .update({
            ...(changes.naam !== undefined && { naam: changes.naam }),
            ...(changes.type !== undefined && { type: changes.type }),
            ...(changes.merk !== undefined && { merk: changes.merk }),
            ...(changes.voorPersoneel !== undefined && { voor_personeel: changes.voorPersoneel }),
          })
          .eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async verwijderLocatie(id) {
        const { error } = await supabase.from("locaties").delete().eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async wijzigGebruiker(id, changes) {
        const { error } = await supabase
          .from("profiles")
          .update({
            ...(changes.naam !== undefined && { naam: changes.naam }),
            ...(changes.rol !== undefined && { rol: changes.rol }),
          })
          .eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async startTelling(locatieId) {
        const { data, error } = await supabase.rpc("start_telling", { p_locatie_id: locatieId });
        if (error) throw error;
        await herlaad();
        return data as string;
      },

      async haalTellingregels(tellingId) {
        const { data, error } = await supabase
          .from("tellingregels")
          .select("*")
          .eq("telling_id", tellingId);
        if (error) throw error;
        return (data ?? []).map(naarTellingregel);
      },

      async zetGeteldAantal(regelId, aantal) {
        const { error } = await supabase
          .from("tellingregels")
          .update({ geteld_aantal: aantal })
          .eq("id", regelId);
        if (error) throw error;
      },

      async rondTellingAf(tellingId) {
        const { data, error } = await supabase.rpc("rond_telling_af", { p_telling_id: tellingId });
        if (error) throw error;
        await herlaad();
        return (data as number) ?? 0;
      },

      async annuleerTelling(tellingId) {
        const { error } = await supabase.rpc("annuleer_telling", { p_telling_id: tellingId });
        if (error) throw error;
        await herlaad();
      },

      async maakPakbon({ evenementId, vanLocatieId, ontvangerNaam, handtekening, regels }) {
        const { data, error } = await supabase.rpc("maak_pakbon", {
          p_evenement_id: evenementId,
          p_van_locatie_id: vanLocatieId,
          p_ontvanger_naam: ontvangerNaam,
          p_handtekening: handtekening,
          p_regels: regels.map((r) => ({ product_id: r.productId, aantal: r.aantal })),
        });
        if (error) throw error;
        await herlaad();
        return data as string;
      },

      async haalPakbon(pakbonId) {
        const { data, error } = await supabase
          .from("pakbonnen")
          .select("*")
          .eq("id", pakbonId)
          .maybeSingle();
        if (error) throw error;
        return data ? naarPakbon(data) : null;
      },

      /**
       * Zalen van een evenement in één keer zetten. Weghalen en opnieuw
       * neerzetten: een zaal is geen boeking maar een eigenschap van het
       * evenement, dus er valt niets te bewaren.
       */
      async zetEvenementZalen(evenementId, zaalIds) {
        const { error: verwijderFout } = await supabase
          .from("evenement_zalen")
          .delete()
          .eq("evenement_id", evenementId);
        if (verwijderFout) throw verwijderFout;

        if (zaalIds.length > 0) {
          const { error } = await supabase
            .from("evenement_zalen")
            .insert(zaalIds.map((zaalId) => ({ evenement_id: evenementId, zaal_id: zaalId })));
          if (error) throw error;
        }
        await herlaad();
      },

      async zetStandaardvulling(vulplekId, productId, aantal) {
        if (aantal <= 0) {
          const { error } = await supabase
            .from("vulplek_standaard")
            .delete()
            .eq("vulplek_id", vulplekId)
            .eq("product_id", productId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("vulplek_standaard")
            .upsert({ vulplek_id: vulplekId, product_id: productId, aantal });
          if (error) throw error;
        }
        await herlaad();
      },

      /**
       * Het dagverbruik van één machine. Gaat via een RPC en niet via een
       * insert, omdat de database er zelf het juiste evenement bij zoekt aan
       * de hand van de zaal en de datum — en omdat een tweede invoer voor
       * dezelfde dag de eerste hoort te overschrijven in plaats van ernaast
       * te komen staan.
       */
      async boekMeting({ machineId, datum, aantal, evenementId, notitie }) {
        const { error } = await supabase.rpc("boek_meting", {
          p_machine_id: machineId,
          p_datum: datum,
          p_aantal: aantal,
          p_evenement_id: evenementId ?? null,
          p_notitie: notitie ?? null,
        });
        if (error) throw error;
        await herlaad();
      },

      async voegMachineToe(machine) {
        const { error } = await supabase.from("machines").insert({
          koppeling_id: machine.koppelingId,
          naam: machine.naam,
          extern_id: machine.externId ?? null,
          product_id: machine.productId,
          zaal_id: machine.zaalId ?? null,
          actief: machine.actief,
        });
        if (error) throw error;
        await herlaad();
      },

      async wijzigMachine(id, changes) {
        const { error } = await supabase
          .from("machines")
          .update({
            ...(changes.naam !== undefined && { naam: changes.naam }),
            ...(changes.externId !== undefined && { extern_id: changes.externId ?? null }),
            ...(changes.productId !== undefined && { product_id: changes.productId }),
            ...(changes.zaalId !== undefined && { zaal_id: changes.zaalId ?? null }),
            ...(changes.actief !== undefined && { actief: changes.actief }),
            ...(changes.koppelingId !== undefined && { koppeling_id: changes.koppelingId }),
          })
          .eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async verwijderMachine(id) {
        const { error } = await supabase.from("machines").delete().eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      async wijzigKoppeling(id, changes) {
        const { error } = await supabase
          .from("koppelingen")
          .update({
            ...(changes.actief !== undefined && { actief: changes.actief }),
            ...(changes.apiBasisUrl !== undefined && { api_basis_url: changes.apiBasisUrl }),
            ...(changes.notitie !== undefined && { notitie: changes.notitie }),
          })
          .eq("id", id);
        if (error) throw error;
        await herlaad();
      },

      /**
       * Een aangenomen levering vastleggen: de bon, wat er werkelijk stond,
       * en de voorraadmutaties die daaruit volgen — in één keer, in de
       * database. Net als een gewone boeking wacht hij op verbinding in
       * plaats van verloren te gaan; het kenmerk van de telefoon zorgt dat
       * een tweede poging niet dubbel telt.
       */
      async boekLevering(levering) {
        if (!session) throw new Error("Niet ingelogd.");
        const kenmerk = nieuwKenmerk();

        try {
          const { error } = await supabase.rpc("boek_levering", {
            p_locatie_id: levering.locatieId,
            p_leverancier: levering.leverancier ?? null,
            p_bonnummer: levering.bonnummer ?? null,
            p_aangenomen_door: levering.aangenomenDoor,
            p_opmerking: levering.opmerking ?? null,
            p_regels: levering.regels.map((r) => ({
              product_id: r.productId,
              aantal_bon: r.aantalBon,
              aantal_werkelijk: r.aantalWerkelijk,
              notitie: r.notitie ?? null,
            })),
            p_client_id: kenmerk,
          });
          if (error) throw error;
        } catch (boekfout) {
          if (!isNetwerkfout(boekfout)) throw boekfout;

          const aantalRegels = levering.regels.length;
          setWachtrij(
            voegToeAanWachtrij({
              id: kenmerk,
              soort: "levering",
              gebruikerId: session.user.id,
              omschrijving: `Levering ${levering.leverancier ?? ""} — ${aantalRegels} regel${
                aantalRegels === 1 ? "" : "s"
              }`.trim(),
              payload: levering,
              aangemaaktOp: new Date().toISOString(),
              pogingen: 1,
              laatsteFout: "Nog geen verbinding.",
            })
          );
          return { inWachtrij: true };
        }

        await herlaad();
        return { inWachtrij: false };
      },

      async handelVerschilAf(regelId, notitie) {
        const { error } = await supabase.rpc("handel_verschil_af", {
          p_regel_id: regelId,
          p_notitie: notitie || null,
        });
        if (error) throw error;
        await herlaad();
      },

      wachtrij,
      verstuurWachtrij,

      verwijderUitWachtrij(id) {
        setWachtrij(haalUitWachtrij(id));
      },

      /**
       * De gebruikerslijst mét inlognaam. Gaat via een functie en niet via een
       * gewone query: het e-mailadres is voor andere rollen ingetrokken.
       */
      async haalGebruikers() {
        const { data, error } = await supabase.rpc("gebruikers_overzicht");
        if (error) throw error;
        return (data ?? []).map((r) => ({
          id: r.id,
          naam: r.naam,
          rol: r.rol,
          email: r.email ?? undefined,
          actief: r.actief,
          aangemaaktOp: r.aangemaakt_op,
        }));
      },

      /* Aanmaken, een wachtwoord zetten en toegang intrekken kan alleen met
         de servicesleutel, en die hoort niet in een browser. Dat werk doet de
         Edge Function `gebruikers`; zie supabase/functions/gebruikers. */
      async maakGebruiker({ naam, email, wachtwoord, rol }) {
        const { error } = await supabase.functions.invoke("gebruikers", {
          body: { actie: "aanmaken", naam, email, wachtwoord, rol },
        });
        if (error) throw error;
        await herlaad();
      },

      async zetWachtwoord(gebruikerId, wachtwoord) {
        const { error } = await supabase.functions.invoke("gebruikers", {
          body: { actie: "wachtwoord", gebruiker_id: gebruikerId, wachtwoord },
        });
        if (error) throw error;
      },

      async zetToegang(gebruikerId, actief) {
        const { error } = await supabase.functions.invoke("gebruikers", {
          body: { actie: "toegang", gebruiker_id: gebruikerId, actief },
        });
        if (error) throw error;
        await herlaad();
      },

      async stelMinVoorraadIn(locatieId, productId, minVoorraad) {
        const { error } = await supabase.rpc("stel_min_voorraad", {
          p_locatie_id: locatieId,
          p_product_id: productId,
          p_min_voorraad: minVoorraad,
        });
        if (error) throw error;
        await herlaad();
      },
    }),
    [
      state, laden, fout, mutatiesPerEvenement, metingenPerEvenement, hoofdmagazijn, herlaad,
      session, wachtrij, verstuurWachtrij,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}

export function useEvenement(evenementId: string | undefined): Evenement | undefined {
  const { state } = useAppState();
  return state.evenementen.find((e) => e.id === evenementId);
}

/** Totale voorraad van één product over alle locaties heen. */
export function useTotaleVoorraad(productId: string): number {
  const { state } = useAppState();
  return state.voorraad.filter((v) => v.productId === productId).reduce((som, v) => som + v.aantal, 0);
}
