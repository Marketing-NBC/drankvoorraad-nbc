import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import type {
  EvenementRow,
  LocatieRow,
  MutatieRow,
  PakbonRow,
  ProductRow,
  ProfileRow,
  TellingRow,
  TellingregelRow,
  VoorraadRow,
} from "../lib/database.types";
import type {
  Evenement,
  GebruikerRol,
  Locatie,
  Mutatie,
  Pakbon,
  PakbonRegel,
  PakbonSamenvatting,
  Product,
  Profiel,
  Telling,
  Tellingregel,
  Voorraad,
} from "../data/types";
import { useAuth } from "./AuthContext";

// ─── Row → app-model mapping (snake_case in de database, camelCase in de app) ──

function naarProduct(r: ProductRow): Product {
  return {
    id: r.id,
    naam: r.naam,
    categorie: r.categorie,
    inkoopprijs: Number(r.inkoopprijs),
    verkoopprijs: Number(r.verkoopprijs),
    eenheid: r.eenheid,
    sku: r.sku ?? undefined,
    barcode: r.barcode ?? undefined,
    leverancier: r.leverancier ?? undefined,
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
  return { id: r.id, naam: r.naam, type: r.type, merk: r.merk };
}

function naarProfiel(r: Pick<ProfileRow, "id" | "naam" | "rol">): Profiel {
  return { id: r.id, naam: r.naam, rol: r.rol };
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
}

interface AppStateContextValue {
  state: AppState;
  laden: boolean;
  fout: string | null;
  mutatiesPerEvenement: Map<string, Mutatie[]>;
  /** Het gedeelde hoofdmagazijn (merk === null). */
  hoofdmagazijn: Locatie | undefined;
  herlaad: () => Promise<void>;
  voegEvenementToe: (evenement: Evenement) => Promise<void>;
  wijzigEvenement: (id: string, changes: Partial<Omit<Evenement, "id">>) => Promise<void>;
  verwijderEvenement: (id: string) => Promise<void>;
  voegProductToe: (product: Omit<Product, "id">) => Promise<Product | null>;
  wijzigProduct: (id: string, changes: Partial<Omit<Product, "id">>) => Promise<void>;
  verwijderProduct: (id: string) => Promise<void>;
  voegMutatieToe: (mutatie: Omit<Mutatie, "id" | "gebruikerId" | "datumTijd">) => Promise<void>;
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
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const legeState: AppState = {
  producten: [], evenementen: [], mutaties: [], locaties: [], voorraad: [],
  profielen: [], tellingen: [], pakbonnen: [],
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState<AppState>(legeState);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const alEensGeladen = useRef(false);

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
      ] = await Promise.all([
        supabase.from("producten").select("*").order("naam"),
        supabase.from("evenementen").select("*").order("datum"),
        supabase.from("mutaties").select("*").order("datum_tijd", { ascending: false }),
        supabase.from("locaties").select("*").order("naam"),
        supabase.from("voorraad").select("*"),
        supabase.from("profiles").select("id, naam, rol").order("naam"),
        supabase.from("tellingen").select("*").order("aangemaakt_op", { ascending: false }),
        // Bewust zonder `handtekening`: zie PakbonSamenvatting.
        supabase
          .from("pakbonnen")
          .select("id, evenement_id, van_locatie_id, ontvanger_naam, gebruiker_id, aangemaakt_op")
          .order("aangemaakt_op", { ascending: false }),
      ]);
      const eersteFout =
        producten.error ?? evenementen.error ?? mutaties.error ?? locaties.error ??
        voorraad.error ?? profielen.error ?? tellingen.error ?? pakbonnen.error;
      return {
        producten, evenementen, mutaties, locaties, voorraad, profielen, tellingen, pakbonnen, eersteFout,
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
            verkoopprijs: product.verkoopprijs,
            eenheid: product.eenheid,
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
            ...(changes.verkoopprijs !== undefined && { verkoopprijs: changes.verkoopprijs }),
            ...(changes.eenheid !== undefined && { eenheid: changes.eenheid }),
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

      async voegMutatieToe(mutatie) {
        if (!session) throw new Error("Niet ingelogd.");
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
        });
        if (error) throw error;
        await herlaad();
      },

      async voegLocatieToe(locatie) {
        const { error } = await supabase.from("locaties").insert({
          naam: locatie.naam,
          type: locatie.type,
          merk: locatie.merk,
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
    [state, laden, fout, mutatiesPerEvenement, hoofdmagazijn, herlaad, session]
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
