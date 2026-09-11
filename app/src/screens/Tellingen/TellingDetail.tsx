import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, Icon } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { AppIcon } from "../../components/ui/AppIcon";
import { BarcodeScanner } from "../../components/ui/BarcodeScanner";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { useAppState } from "../../context/AppStateContext";
import type { Product, Tellingregel } from "../../data/types";
import { formatCurrency, formatNumber } from "../../utils/format";
import { invoer, omschrijfAantal, verpakkingLabel, heeftVerpakking } from "../../data/verpakking";
import { ROUTES } from "../../routes/routes";

interface Regel extends Tellingregel {
  product: Product;
  /** Huidige voorraad — kan afwijken van verwachtAantal als er tijdens het tellen geboekt is. */
  huidigeVoorraad: number;
}

export function TellingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, laden, haalTellingregels, zetGeteldAantal, rondTellingAf, annuleerTelling } = useAppState();

  const [regels, setRegels] = useState<Regel[]>([]);
  const [regelsLaden, setRegelsLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [scannen, setScannen] = useState(false);
  const [gemarkeerd, setGemarkeerd] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const telling = state.tellingen.find((t) => t.id === id);
  const locatie = state.locaties.find((l) => l.id === telling?.locatieId);

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
    const aantal = ingevoerd === null ? null : ingevoerd * invoer(regel.product).factor;

    setRegels((huidig) => huidig.map((r) => (r.id === regel.id ? { ...r, geteldAantal: aantal } : r)));
    try {
      await zetGeteldAantal(regel.id, aantal);
    } catch {
      setFout("Het getelde aantal kon niet opgeslagen worden. Controleer je verbinding.");
    }
  }

  function verwerkScan(code: string) {
    const regel = regels.find((r) => r.product.barcode === code.trim());
    if (!regel) {
      setFout(`Barcode ${code.trim()} hoort niet bij een product in deze lijst.`);
      return;
    }
    setFout(null);
    setGemarkeerd(regel.id);
    setScannen(false);
    // Het veld krijgt focus zodat je meteen het aantal kunt intypen.
    requestAnimationFrame(() => {
      const veld = document.getElementById(`telling-${regel.id}`) as HTMLInputElement | null;
      veld?.focus();
      veld?.select();
      veld?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  async function afronden() {
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
    } catch {
      setFout("De telling kon niet afgerond worden. Probeer het opnieuw.");
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
              ? "Deze telling is afgerond. De verschillen zijn als correctie geboekt en staan in Mutaties."
              : "Tel door te scannen of in te typen. Bij afronden worden de verschillen automatisch als correctie geboekt."
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
            <div className="telling-voortgang__acties">
              <Button
                variant={scannen ? "ghost-dark" : "primary"}
                icon={null}
                onClick={() => {
                  setFout(null);
                  setScannen(!scannen);
                }}
              >
                {scannen ? "Stop met scannen" : "Scan een product"}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

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
                        verwacht <strong>{omschrijfAantal(regel.product, basis)}</strong>{" "}
                        {heeftVerpakking(regel.product) && regel.product.alleenPerVerpakking
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
                                ? `${formatNumber(verschil)} meer dan verwacht`
                                : `${formatNumber(Math.abs(verschil))} minder dan verwacht`}
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
                          : regel.geteldAantal / invoer(regel.product).factor
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
            <Card className={scannen ? undefined : "scan-kaart--leeg"}>
              <div className="scanpaneel">
                {scannen ? (
                  <BarcodeScanner
                    actief={scannen}
                    onGevonden={verwerkScan}
                    onFout={(m) => {
                      setFout(m);
                      setScannen(false);
                    }}
                  />
                ) : (
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
                )}
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
              <div className="regellijst__regel">
                <span>Waarde afwijking</span>
                <span>
                  {voortgang.waarde < 0 ? "− " : ""}
                  {formatCurrency(Math.abs(voortgang.waarde))}
                </span>
              </div>
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
