import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, Icon } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { AppIcon } from "../../components/ui/AppIcon";
import { hoortBijProduct } from "../../data/barcode";
import { BarcodeScanner, type ScanUitkomst } from "../../components/ui/BarcodeScanner";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Product, TellingReden, Tellingregel } from "../../data/types";
import { formatCurrency, formatNumber } from "../../utils/format";
import {
  eenheidVan,
  heeftVerpakking,
  invoer,
  losOpLocatie,
  omschrijfAantal,
  verpakkingLabel,
} from "../../data/verpakking";
import { foutBericht } from "../../utils/fouten";
import { TekortKaart, type Tekort } from "./TekortKaart";
import { ROUTES } from "../../routes/routes";

interface Regel extends Tellingregel {
  product: Product;
  /** Huidige voorraad — kan afwijken van verwachtAantal als er tijdens het tellen geboekt is. */
  huidigeVoorraad: number;
}

export function TellingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, laden, haalTellingregels, zetGeteldAantal, zetTelReden, rondTellingAf, annuleerTelling } =
    useAppState();
  const { zietBedragen } = useAuth();

  const [regels, setRegels] = useState<Regel[]>([]);
  const [regelsLaden, setRegelsLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [scannen, setScannen] = useState(false);
  const [gemarkeerd, setGemarkeerd] = useState<string | null>(null);
  const teFocussen = useRef<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const telling = state.tellingen.find((t) => t.id === id);
  const locatie = state.locaties.find((l) => l.id === telling?.locatieId);
  /* In de kantine en de kroeg tel je flesjes, ook van wat het magazijn per
     krat telt. Zie losOpLocatie in src/data/verpakking.ts. */
  const perStuk = losOpLocatie(locatie);

  const laadRegels = useCallback(async () => {
    if (!id) return;
    setRegelsLaden(true);
    try {
      const opgehaald = await haalTellingregels(id);
      const productenById = new Map(state.producten.map((p) => [p.id, p]));
      const voorraadKey = (productId: string) =>
        state.voorraad.find((v) => v.productId === productId && v.locatieId === telling?.locatieId)?.aantal ?? 0;

      setRegels(
        opgehaald
          .map((r) => {
            const product = productenById.get(r.productId);
            return product ? { ...r, product, huidigeVoorraad: voorraadKey(r.productId) } : null;
          })
          .filter((r): r is Regel => r !== null)
          .sort((a, b) => a.product.naam.localeCompare(b.product.naam))
      );
    } catch {
      setFout("De telregels konden niet opgehaald worden.");
    } finally {
      setRegelsLaden(false);
    }
  }, [id, haalTellingregels, state.producten, state.voorraad, telling?.locatieId]);

  useEffect(() => {
    if (!laden) void laadRegels();
    // laadRegels verandert bij elke state-update; alleen op id + laden reageren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, laden]);

  const afgerond = telling?.status === "afgerond";

  /**
   * Waartegen we het getelde aantal afzetten verschilt per fase:
   * - Lopende telling: tegen de HUIDIGE voorraad, want dát bepaalt welke
   *   correctie er straks geboekt wordt.
   * - Afgeronde telling: tegen de momentopname van bij het starten. De
   *   huidige voorraad is inmiddels gelijkgetrokken, dus daartegen afzetten
   *   zou altijd "alles klopt" opleveren en juist verbergen wat er gevonden is.
   */
  const referentie = useCallback(
    (regel: Regel) => (afgerond ? regel.verwachtAantal : regel.huidigeVoorraad),
    [afgerond]
  );

  const voortgang = useMemo(() => {
    const geteld = regels.filter((r) => r.geteldAantal !== null).length;
    const afwijkend = regels.filter(
      (r) => r.geteldAantal !== null && r.geteldAantal !== referentie(r)
    ).length;
    /* Wat de correcties samen waard zijn, tegen inkoopprijs. Een min
       betekent dat er minder staat dan geboekt: dat kost geld. */
    const waarde = regels.reduce((som, r) => {
      if (r.geteldAantal === null) return som;
      return som + (r.geteldAantal - referentie(r)) * r.product.inkoopprijs;
    }, 0);
    return { geteld, totaal: regels.length, afwijkend, waarde, nietGeteld: regels.length - geteld };
  }, [regels, referentie]);

  /**
   * Een aantal in de eenheid waarin geteld wordt. Telt het magazijn kratten,
   * dan is een tekort ook "1 krat", niet "24" — dat was precies de fout:
   * kratten intypen en het verschil in flessen terugzien.
   */
  const omschrijf = useCallback(
    (product: Product, stuks: number) =>
      !perStuk && product.alleenPerVerpakking && heeftVerpakking(product)
        ? omschrijfAantal(product, stuks)
        : `${formatNumber(stuks)} ${eenheidVan(product, stuks)}`,
    [perStuk]
  );

  /* In de kantine en de kroeg ís een tekort het verbruik; daar hoeft niemand
     uit te zoeken wat er gebeurd is. In het magazijn wel. */
  const tekorten: Tekort[] = locatie?.voorPersoneel
    ? []
    : regels
        .filter((r) => r.geteldAantal !== null && r.geteldAantal < referentie(r))
        .map((r) => ({
          regelId: r.id,
          product: r.product,
          omschrijving: omschrijf(r.product, referentie(r) - (r.geteldAantal ?? 0)),
          reden: r.reden,
          toelichting: r.redenToelichting,
        }));
  const tekortenZonderReden = tekorten.filter(
    (t) => !t.reden || (t.reden === "anders" && !t.toelichting?.trim())
  );

  async function bewaarReden(regelId: string, reden: TellingReden, toelichting: string | null) {
    setRegels((huidig) =>
      huidig.map((r) =>
        r.id === regelId ? { ...r, reden, redenToelichting: toelichting ?? undefined } : r
      )
    );
    try {
      await zetTelReden(regelId, reden, toelichting);
    } catch {
      setFout("De reden kon niet opgeslagen worden. Controleer je verbinding.");
    }
  }

  const percentage = voortgang.totaal === 0 ? 0 : Math.round((voortgang.geteld / voortgang.totaal) * 100);

  /**
   * Het getelde aantal opslaan.
   *
   * Bij een product dat nooit los gaat telt de vloer kratten; de voorraad
   * blijft in stuks staan. De omrekening zit hier en nergens anders — zie
   * src/data/verpakking.ts.
   */
  async function bewaarAantal(regel: Regel, waarde: string) {
    const ingevoerd = waarde.trim() === "" ? null : Number(waarde);
    if (ingevoerd !== null && (Number.isNaN(ingevoerd) || ingevoerd < 0)) return;
    const aantal = ingevoerd === null ? null : ingevoerd * invoer(regel.product, { los: perStuk }).factor;

    setRegels((huidig) => huidig.map((r) => (r.id === regel.id ? { ...r, geteldAantal: aantal } : r)));
    try {
      await zetGeteldAantal(regel.id, aantal);
    } catch {
      setFout("Het getelde aantal kon niet opgeslagen worden. Controleer je verbinding.");
    }
  }

  function verwerkScan(code: string): ScanUitkomst {
    const regel = regels.find((r) => hoortBijProduct(r.product, code));
    if (!regel) return `Barcode ${code} hoort niet bij een product in deze lijst.`;
    setFout(null);
    setGemarkeerd(regel.id);
    teFocussen.current = regel.id;
  }

  /** Na het scannen krijgt het veld van het gescande product focus, zodat je
   *  meteen het aantal kunt intypen. */
  function sluitScanner() {
    setScannen(false);
    const regelId = teFocussen.current;
    teFocussen.current = null;
    if (!regelId) return;
    requestAnimationFrame(() => {
      const veld = document.getElementById(`telling-${regelId}`) as HTMLInputElement | null;
      veld?.focus();
      veld?.select();
      veld?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  async function afronden() {
    if (tekortenZonderReden.length > 0) {
      setFout(
        `Geef eerst bij elk tekort aan wat er gebeurd is: ${tekortenZonderReden
          .map((t) => t.product.naam)
          .join(", ")}.`
      );
      document.getElementById("tekorten")?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    const wat = locatie?.voorPersoneel ? "boeking(en)" : "correctie(s)";
    const bevestiging =
      voortgang.nietGeteld > 0
        ? `${voortgang.nietGeteld} product(en) zijn niet geteld en blijven ongewijzigd. ${voortgang.afwijkend} ${wat} worden geboekt. Doorgaan?`
        : `${voortgang.afwijkend} ${wat} worden geboekt. Doorgaan?`;
    if (!window.confirm(bevestiging)) return;

    setBezig(true);
    try {
      const aantal = await rondTellingAf(id!);
      navigate(ROUTES.tellingen, {
        state: {
          melding: locatie?.voorPersoneel
            ? `Telling afgerond. ${aantal} product(en) geboekt als personeelsverbruik.`
            : `Telling afgerond met ${aantal} correctie(s).`,
        },
      });
    } catch (err) {
      setFout(foutBericht(err) || "De telling kon niet afgerond worden. Probeer het opnieuw.");
      setBezig(false);
    }
  }

  async function annuleren() {
    if (!window.confirm("Telling annuleren? De ingevulde aantallen gaan verloren en er worden geen correcties geboekt."))
      return;
    setBezig(true);
    try {
      await annuleerTelling(id!);
      navigate(ROUTES.tellingen);
    } catch {
      setFout("De telling kon niet geannuleerd worden.");
      setBezig(false);
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;
  if (!telling) return <Navigate to={ROUTES.tellingen} replace />;

  return (
    <>
      <PageHeader
        eyebrow={afgerond ? "afgeronde telling" : "telling bezig"}
        title={locatie?.naam ?? "Telling"}
        toelichting={
          locatie?.voorPersoneel
            ? afgerond
              ? "Deze telling is afgerond. Wat er minder stond dan verwacht is geboekt als personeelsverbruik en staat bij Personeel."
              : "Tel door te scannen of in te typen. Wat er minder staat dan verwacht wordt bij afronden geboekt als personeelsverbruik — dit is de meting."
            : afgerond
              ? "Deze telling is afgerond. Tekorten die over datum of kapot waren staan als derving in Mutaties, de rest als correctie."
              : "Tel door te scannen of in te typen. Staat er minder dan verwacht, dan vraagt de app wat er gebeurd is: over datum of kapot wordt derving, een andere reden blijft een telverschil."
        }
        actions={
          afgerond ? null : (
            <>
              <Button icon={null} onClick={() => void afronden()} disabled={bezig || voortgang.geteld === 0}>
                {bezig ? "Bezig…" : "Telling afronden"}
              </Button>
              <Button variant="ghost-dark" icon={null} onClick={() => void annuleren()} disabled={bezig}>
                Annuleren
              </Button>
            </>
          )
        }
      />

      {fout ? <FoutMelding melding={fout} /> : null}

      <BarcodeScanner
        open={scannen}
        titel="Product scannen"
        context={locatie ? `Telling · ${locatie.naam}` : "Telling"}
        onGevonden={verwerkScan}
        onSluit={sluitScanner}
      />

      {/* Voortgang en de scanknop staan samen bovenaan: dit is wat je op de
          vloer nodig hebt zonder te scrollen. */}
      <Card>
        <div className="telling-voortgang">
          <div className="telling-voortgang__regel">
            <span className="telling-voortgang__tekst">
              <strong>{voortgang.geteld}</strong> van {voortgang.totaal} geteld
            </span>
            <span className="telling-voortgang__balk" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
              <span className="telling-voortgang__vulling" style={{ width: `${percentage}%` }} />
            </span>
            {voortgang.afwijkend > 0 ? (
              <Badge variant="gold">
                {voortgang.afwijkend} {voortgang.afwijkend === 1 ? "afwijking" : "afwijkingen"}
              </Badge>
            ) : voortgang.geteld > 0 ? (
              <Badge variant="success" icon="check">alles klopt</Badge>
            ) : null}
          </div>

          {!afgerond ? (
            <div className="telling-voortgang__acties alleen-touch">
              <Button
                icon={null}
                onClick={() => {
                  setFout(null);
                  setScannen(true);
                }}
              >
                Scan een product
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <TekortKaart
        tekorten={tekorten}
        afgerond={afgerond}
        onReden={(regelId, reden, toelichting) => void bewaarReden(regelId, reden, toelichting)}
      />

      <div className="telling-grid">
        <Card>
          <KaartKop titel="Telregels" sub="alfabetisch · geteld schuift niet van plek" />
          {regelsLaden ? (
            <p className="app-laden">Telregels laden…</p>
          ) : (
            <div className="telling-lijst">
              {regels.map((regel) => {
                const basis = referentie(regel);
                const verschil = regel.geteldAantal === null ? null : regel.geteldAantal - basis;
                const geteld = regel.geteldAantal !== null;
                return (
                  <div
                    key={regel.id}
                    className={[
                      "telling-regel",
                      geteld && (verschil === 0 ? "telling-regel--klopt" : "telling-regel--afwijkend"),
                      gemarkeerd === regel.id && "telling-regel--gemarkeerd",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="telling-regel__tekst">
                      <span className="telling-regel__naam">
                        {regel.product.naam}
                        {geteld ? <Icon name="check-circle" size={16} className="telling-regel__vink" /> : null}
                      </span>
                      <span className="telling-regel__verwacht">
                        verwacht <strong>{omschrijfAantal(regel.product, basis, { los: perStuk })}</strong>{" "}
                        {!perStuk && heeftVerpakking(regel.product) && regel.product.alleenPerVerpakking
                          ? verpakkingLabel(regel.product)
                          : regel.product.eenheid}
                        {verschil !== null && verschil !== 0 ? (
                          <>
                            {" · "}
                            <span
                              className={["telling-regel__verschil", verschil < 0 && "telling-regel__verschil--tekort"]
                                .filter(Boolean).join(" ")}
                            >
                              {verschil > 0
                                ? `${omschrijf(regel.product, verschil)} meer dan verwacht`
                                : `${omschrijf(regel.product, Math.abs(verschil))} minder dan verwacht`}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </div>

                    <label className="visueel-verborgen" htmlFor={`telling-${regel.id}`}>
                      Geteld aantal {regel.product.naam}
                    </label>
                    <input
                      id={`telling-${regel.id}`}
                      className={["telling-regel__veld", geteld && "telling-regel__veld--gevuld"]
                        .filter(Boolean).join(" ")}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="—"
                      disabled={afgerond}
                      /* In kratten invullen bij een product dat nooit los
                         gaat; de opslag blijft in stuks. */
                      defaultValue={
                        regel.geteldAantal === null
                          ? ""
                          : regel.geteldAantal / invoer(regel.product, { los: perStuk }).factor
                      }
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => void bewaarAantal(regel, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="detail-grid__kolom">
          {!afgerond ? (
            <Card className="scan-kaart--leeg alleen-touch">
              <div className="scanpaneel">
                <button
                  type="button"
                  className="scanpaneel__vlak"
                  aria-label="Scannen starten"
                  onClick={() => {
                    setFout(null);
                    setScannen(true);
                  }}
                >
                  <AppIcon name="scan" size={80} />
                </button>
                <span className="scanpaneel__uitleg">
                  Houd de barcode in beeld. Het veld van dat product krijgt meteen focus.
                </span>
              </div>
            </Card>
          ) : null}

          <Card>
            <KaartKop titel={afgerond ? "Wat er geboekt is" : "Bij afronden"} />
            <div className="regellijst">
              <div className="regellijst__regel">
                <span>{afgerond ? "Geboekte correcties" : "Correcties te boeken"}</span>
                <span>{formatNumber(voortgang.afwijkend)}</span>
              </div>
              <div className="regellijst__regel">
                <span>Niet geteld — blijft ongewijzigd</span>
                <span>{formatNumber(voortgang.nietGeteld)}</span>
              </div>
              {zietBedragen ? (
                <div className="regellijst__regel">
                  <span>Waarde afwijking</span>
                  <span>
                    {voortgang.waarde < 0 ? "− " : ""}
                    {formatCurrency(Math.abs(voortgang.waarde))}
                  </span>
                </div>
              ) : null}
            </div>
            <span className="regellijst__voet">
              Een correctie is zelf ook een mutatie en blijft terugvindbaar in Mutaties.
            </span>
          </Card>
        </div>
      </div>
    </>
  );
}
