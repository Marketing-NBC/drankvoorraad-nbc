import { useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card } from "../../design-system";
import { ActieMenu } from "../../components/ui/ActieMenu";
import { AppIcon } from "../../components/ui/AppIcon";
import { BrandBadge } from "../../components/ui/BrandBadge";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { MutatieTabel } from "../../components/ui/MutatieTabel";

import { useAppState, useEvenement } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";

import {
  berekenMarge,
  productVerbruikPerEvenement,
  type ProductVerbruik,
} from "../../data/calculations";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "../../utils/format";
import { exporteerNaarExcel } from "../../utils/excel";
import { ROUTES } from "../../routes/routes";
import { BookingModal, type BoekingRichting } from "./BookingModal";
import { BookingTable } from "./BookingTable";
import { MargeSummary } from "./MargeSummary";
import { OmzetInput } from "./OmzetInput";
import { StatusKiezer } from "./StatusKiezer";

export function EvenementDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, laden, wijzigEvenement, verwijderEvenement, mutatiesPerEvenement } = useAppState();
  const { mag } = useAuth();
  const navigate = useNavigate();
  const evenement = useEvenement(id);
  const [modal, setModal] = useState<{ richting: BoekingRichting; productId?: string } | null>(null);
  const [exporteert, setExporteert] = useState(false);
  const [verwijderFout, setVerwijderFout] = useState<string | null>(null);

  if (laden) return <p className="app-laden">Bezig met laden…</p>;
  if (!evenement) return <Navigate to={ROUTES.overzicht} replace />;

  const mutaties = mutatiesPerEvenement.get(evenement.id) ?? [];
  const pakbonnen = state.pakbonnen.filter((p) => p.evenementId === evenement.id);
  const magPakbon = mag("beheerder", "magazijnmedewerker");
  const magBoeken = mag("beheerder", "magazijnmedewerker");
  const marge = berekenMarge(evenement.omzet, mutaties, state.producten);
  const productenById = new Map(state.producten.map((p) => [p.id, p]));

  /* De drie cijfers boven het scherm: wat er heen ging, wat er terugkwam en
     wat er dus werkelijk doorheen is. */
  const verbruik = productVerbruikPerEvenement(mutaties).reduce(
    (som, r) => ({
      uit: som.uit + r.aantalUitgegeven,
      retour: som.retour + r.aantalRetour,
      verbruik: som.verbruik + r.werkelijkVerbruik,
    }),
    { uit: 0, retour: 0, verbruik: 0 }
  );

  /**
   * Verwijderen mag alleen zolang er niets aan het evenement hangt. De
   * database zou het sowieso weigeren, maar dan krijg je een technische
   * foutmelding. Hier controleren we het vooraf zodat de melding vertelt
   * wát er in de weg zit en wat je in plaats daarvan kunt doen.
   */
  function blokkadesVoorVerwijderen(): string[] {
    const ev = evenement!;
    const blokkades: string[] = [];
    const aantalMutaties = mutaties.length;
    const aantalPakbonnen = state.pakbonnen.filter((p) => p.evenementId === ev.id).length;

    if (aantalMutaties > 0) blokkades.push(`${aantalMutaties} boeking(en)`);
    if (aantalPakbonnen > 0) blokkades.push(`${aantalPakbonnen} pakbon(nen)`);
    return blokkades;
  }

  async function handleVerwijder() {
    const ev = evenement!;
    const blokkades = blokkadesVoorVerwijderen();

    if (blokkades.length > 0) {
      // Nederlandse opsomming: komma's, met "en" alleen voor het laatste deel.
      const opsomming =
        blokkades.length === 1
          ? blokkades[0]
          : `${blokkades.slice(0, -1).join(", ")} en ${blokkades[blokkades.length - 1]}`;
      setVerwijderFout(
        `Dit evenement heeft ${opsomming} en kan daarom niet verwijderd worden — ` +
          "de historie zou dan verdwijnen. Zet het op Afgerond als het niet is doorgegaan."
      );
      return;
    }

    if (!window.confirm(`Evenement ${ev.naam} (${ev.id}) verwijderen? Dit kan niet ongedaan gemaakt worden.`)) {
      return;
    }

    try {
      await verwijderEvenement(ev.id);
      navigate(ROUTES.overzicht);
    } catch {
      setVerwijderFout("Verwijderen is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    }
  }

  async function handleExportExcel() {
    const regels = productVerbruikPerEvenement(mutaties);
    const ev = evenement!;
    setExporteert(true);
    try {
      await exporteerNaarExcel<ProductVerbruik>({
        bestandsnaam: `verbruik-${ev.id}`,
        titel: ev.naam,
        ondertitel: `${ev.id} · ${formatDate(ev.datum)} · ${ev.merk}${ev.opdrachtgever ? ` · ${ev.opdrachtgever}` : ""}`,
        rijen: regels,
        kolommen: [
          { header: "Product", value: (r) => productenById.get(r.productId)?.naam ?? r.productId },
          { header: "Eenheid", value: (r) => productenById.get(r.productId)?.eenheid ?? "" },
          { header: "Uitgegeven", opmaak: "getal", value: (r) => r.aantalUitgegeven },
          { header: "Retour", opmaak: "getal", value: (r) => r.aantalRetour },
          { header: "Werkelijk verbruik", opmaak: "getal", value: (r) => r.werkelijkVerbruik },
          { header: "Inkoopprijs", opmaak: "bedrag", value: (r) => productenById.get(r.productId)?.inkoopprijs ?? 0 },
          {
            header: "Kostprijs",
            opmaak: "bedrag",
            value: (r) => r.werkelijkVerbruik * (productenById.get(r.productId)?.inkoopprijs ?? 0),
          },
        ],
        totalen: { 0: "Totaal kostprijs verbruik", 6: marge.kostprijsVerbruik },
      });
    } finally {
      setExporteert(false);
    }
  }

  return (
    <>
      {/* Boeken en retour staan altijd binnen bereik, boven de cijfers. */}
      <div className="actiebalk no-print">
        <RouterLink className="actiebalk__terug" to={ROUTES.overzicht}>
          <AppIcon name="arrow-left" size={16} />
          Evenementen
        </RouterLink>
        <div className="actiebalk__acties">
          {magBoeken ? (
            <>
              <Button icon="plus" iconPosition="leading" onClick={() => setModal({ richting: "uitgifte" })}>
                Product boeken
              </Button>
              <Button variant="ghost-dark" icon={null} onClick={() => setModal({ richting: "retour" })}>
                Retour boeken
              </Button>
            </>
          ) : null}
          {magPakbon ? (
            <Button variant="zacht" icon={null} onClick={() => navigate(ROUTES.pakbonNieuw(evenement.id))}>
              Pakbon maken
            </Button>
          ) : null}
          <Button variant="zacht" icon={null} onClick={() => void handleExportExcel()} disabled={exporteert}>
            {exporteert ? "Bezig…" : "Excel"}
          </Button>
          <Button variant="zacht" icon={null} onClick={() => window.print()}>PDF</Button>
          {mag("beheerder") ? (
            <ActieMenu
              label="Beheren"
              items={[{ label: "Evenement verwijderen", onClick: () => void handleVerwijder() }]}
            />
          ) : null}
        </div>
      </div>

      {verwijderFout ? <FoutMelding melding={verwijderFout} /> : null}

      <div className="detail-kop">
        <div>
          <span className="page-header__eyebrow eyebrow eyebrow--bare">{evenement.id}</span>
          <h1 className="page-header__title">{evenement.naam}</h1>
          <div className="detail-kop__meta">
            <span>{formatDate(evenement.datum)}</span>
            <BrandBadge merk={evenement.merk} />
            <StatusKiezer evenement={evenement} />
            {evenement.opdrachtgever ? <span>Opdrachtgever: {evenement.opdrachtgever}</span> : null}
          </div>
        </div>

        <div className="detail-cijfers">
          <div className="detail-cijfer">
            <span className="detail-cijfer__label">Uitgegeven</span>
            <div className="detail-cijfer__waarde">{formatNumber(verbruik.uit)}</div>
          </div>
          <div className="detail-cijfer">
            <span className="detail-cijfer__label">Retour</span>
            <div className="detail-cijfer__waarde">{formatNumber(verbruik.retour)}</div>
          </div>
          <div className="detail-cijfer detail-cijfer--petrol">
            <span className="detail-cijfer__label">Verbruik</span>
            <div className="detail-cijfer__waarde">{formatNumber(verbruik.verbruik)}</div>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-grid__kolom">
          <Card className="card--tabel">
            <KaartKop titel="Geboekte producten" sub="uitgifte, retour en werkelijk verbruik" />
            <BookingTable
              mutaties={mutaties}
              producten={state.producten}
              onUitgifte={
                magBoeken ? (product) => setModal({ richting: "uitgifte", productId: product.id }) : undefined
              }
              onRetour={
                magBoeken ? (product) => setModal({ richting: "retour", productId: product.id }) : undefined
              }
            />
          </Card>

          <Card>
            <KaartKop
              titel="Pakbonnen"
              rechts={
                magPakbon ? (
                  <Button
                    variant="ghost-dark"
                    size="sm"
                    icon={null}
                    className="no-print"
                    onClick={() => navigate(ROUTES.pakbonNieuw(evenement.id))}
                  >
                    Pakbon maken
                  </Button>
                ) : null
              }
            />
            {pakbonnen.length === 0 ? (
              <p className="data-table__empty">
                Nog geen pakbonnen. Maak er een bij de overdracht naar het evenement, zodat de
                ontvangst getekend vastligt.
              </p>
            ) : (
              <ul className="pakbon-lijst">
                {pakbonnen.map((pakbon) => (
                  <li key={pakbon.id}>
                    <RouterLink className="pakbon-lijst__link" to={ROUTES.pakbon(pakbon.id)}>
                      <span className="pakbon-lijst__nummer">{pakbon.id.slice(0, 8).toUpperCase()}</span>
                      <span className="pakbon-lijst__meta">
                        <span>{formatDateTime(pakbon.aangemaaktOp)}</span>
                        <span>ontvangen door {pakbon.ontvangerNaam}</span>
                      </span>
                      <span className="pakbon-lijst__status">
                        <Badge variant="success">vastgelegd</Badge>
                      </span>
                    </RouterLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="card--tabel">
            <KaartKop titel="Historie" sub="elke boeking op dit evenement" />
            <MutatieTabel
              compact
              mutaties={mutaties}
              producten={state.producten}
              locaties={state.locaties}
              profielen={state.profielen}
              legeMelding="Nog geen mutaties voor dit evenement."
            />
          </Card>
        </div>

        <div className="detail-grid__kolom">
          <Card>
            <OmzetInput
              value={evenement.omzet}
              onSave={(omzet) => void wijzigEvenement(evenement.id, { omzet })}
            />
          </Card>
          <Card>
            <KaartKop titel="Marge" />
            <MargeSummary marge={marge} />
          </Card>

          {/* Wat er nog buiten staat is geld dat je kwijtraakt als niemand
              het terugboekt — vandaar het gele vlak en één directe actie. */}
          {verbruik.verbruik > 0 && evenement.status !== "Afgerond" ? (
            <Card className="card--goud">
              <KaartKop titel="Nog niet retour" />
              <div className="stat-kaart__waarde" style={{ color: "inherit", margin: "0 0 6px" }}>
                {formatNumber(verbruik.verbruik)}
              </div>
              <span className="kaart-kop__sub" style={{ color: "inherit" }}>
                Boek retour zodra de bar leeg is, anders telt het als verbruik
                ({formatCurrency(marge.kostprijsVerbruik)}).
              </span>
              {magBoeken ? (
                <div className="button-row no-print" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="lage-voorraad__actie"
                    onClick={() => setModal({ richting: "retour" })}
                  >
                    Retour boeken
                  </button>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>

      <BookingModal
        open={modal !== null}
        onClose={() => setModal(null)}
        evenementId={evenement.id}
        richting={modal?.richting ?? "uitgifte"}
        standaardProductId={modal?.productId}
        producten={state.producten}
      />
    </>
  );
}
