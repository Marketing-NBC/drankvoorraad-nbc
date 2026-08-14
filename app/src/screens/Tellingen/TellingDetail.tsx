import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, Icon } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { BarcodeScanner } from "../../components/ui/BarcodeScanner";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { useAppState } from "../../context/AppStateContext";
import type { Product, Tellingregel } from "../../data/types";
import { formatNumber } from "../../utils/format";
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
    return { geteld, totaal: regels.length, afwijkend };
  }, [regels, referentie]);

  async function bewaarAantal(regel: Regel, waarde: string) {
    const aantal = waarde.trim() === "" ? null : Number(waarde);
    if (aantal !== null && (Number.isNaN(aantal) || aantal < 0)) return;

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
    const nietGeteld = voortgang.totaal - voortgang.geteld;
    const bevestiging =
      nietGeteld > 0
        ? `${nietGeteld} product(en) zijn niet geteld en blijven ongewijzigd. ${voortgang.afwijkend} correctie(s) worden geboekt. Doorgaan?`
        : `${voortgang.afwijkend} correctie(s) worden geboekt. Doorgaan?`;
    if (!window.confirm(bevestiging)) return;

    setBezig(true);
    try {
      const aantal = await rondTellingAf(id!);
      navigate(ROUTES.tellingen, { state: { melding: `Telling afgerond met ${aantal} correctie(s).` } });
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

      <div className="telling-voortgang">
        <span>
          <strong>{voortgang.geteld}</strong> van {voortgang.totaal} geteld
        </span>
        {voortgang.afwijkend > 0 ? (
          <Badge variant="gold">{voortgang.afwijkend} afwijking(en)</Badge>
        ) : voortgang.geteld > 0 ? (
          <Badge variant="success" icon="check">alles klopt</Badge>
        ) : null}
      </div>

      {!afgerond ? (
        <div className="telling-scanbalk">
          <Button
            variant={scannen ? "primary" : "ghost-dark"}
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

      {scannen ? (
        <Card style={{ marginBottom: "var(--s-5)" }}>
          <BarcodeScanner
            actief={scannen}
            onGevonden={verwerkScan}
            onFout={(m) => {
              setFout(m);
              setScannen(false);
            }}
          />
        </Card>
      ) : null}

      {regelsLaden ? (
        <p className="app-laden">Telregels laden…</p>
      ) : (
        <div className="telling-lijst">
          {regels.map((regel) => {
            const basis = referentie(regel);
            const verschil = regel.geteldAantal === null ? null : regel.geteldAantal - basis;
            return (
              <Card
                key={regel.id}
                className={[
                  "telling-regel",
                  gemarkeerd === regel.id && "telling-regel--gemarkeerd",
                  regel.geteldAantal !== null && "telling-regel--geteld",
                ].filter(Boolean).join(" ")}
              >
                <div className="telling-regel__kop">
                  <span className="telling-regel__naam">{regel.product.naam}</span>
                  {regel.geteldAantal !== null ? (
                    <Icon name="check-circle" size={20} className="telling-regel__vink" />
                  ) : null}
                </div>

                <div className="telling-regel__body">
                  <span className="telling-regel__verwacht">
                    verwacht <strong>{formatNumber(basis)}</strong> {regel.product.eenheid}
                  </span>

                  <div className="telling-regel__invoer">
                    <label className="visueel-verborgen" htmlFor={`telling-${regel.id}`}>
                      Geteld aantal {regel.product.naam}
                    </label>
                    <input
                      id={`telling-${regel.id}`}
                      className="input telling-regel__veld"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="—"
                      disabled={afgerond}
                      defaultValue={regel.geteldAantal ?? ""}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => void bewaarAantal(regel, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                </div>

                {verschil !== null && verschil !== 0 ? (
                  <p className={["telling-regel__verschil", verschil < 0 && "telling-regel__verschil--tekort"]
                    .filter(Boolean).join(" ")}>
                    {verschil > 0 ? `${formatNumber(verschil)} meer dan verwacht` : `${formatNumber(Math.abs(verschil))} minder dan verwacht`}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
