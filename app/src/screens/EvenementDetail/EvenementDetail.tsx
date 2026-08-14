import { useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { Button, Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { ActieMenu } from "../../components/ui/ActieMenu";
import { BrandBadge } from "../../components/ui/BrandBadge";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { MutatieTabel } from "../../components/ui/MutatieTabel";

import { useAppState, useEvenement } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";

import {
  berekenMarge,
  productVerbruikPerEvenement,
  type ProductVerbruik,
} from "../../data/calculations";
import { formatCurrency, formatDate, formatDateTime } from "../../utils/format";
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
  const [modal, setModal] = useState<BoekingRichting | null>(null);
  const [exporteert, setExporteert] = useState(false);
  const [verwijderFout, setVerwijderFout] = useState<string | null>(null);

  if (laden) return <p className="app-laden">Bezig met laden…</p>;
  if (!evenement) return <Navigate to={ROUTES.overzicht} replace />;

  const mutaties = mutatiesPerEvenement.get(evenement.id) ?? [];
  const pakbonnen = state.pakbonnen.filter((p) => p.evenementId === evenement.id);
  const magPakbon = mag("beheerder", "magazijnmedewerker");
  const marge = berekenMarge(evenement.omzet, mutaties, state.producten);
  const productenById = new Map(state.producten.map((p) => [p.id, p]));

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
      <PageHeader
        eyebrow={evenement.id}
        title={evenement.naam}
        actions={
          <>
            <Button variant="ghost-dark" icon={null} onClick={() => void handleExportExcel()} disabled={exporteert}>
              {exporteert ? "Bezig…" : "Exporteren (Excel)"}
            </Button>
            <Button variant="ghost-dark" icon={null} onClick={() => window.print()}>Exporteren (PDF)</Button>
            {mag("beheerder") ? (
              <ActieMenu
                label="Beheren"
                items={[{ label: "Evenement verwijderen", onClick: () => void handleVerwijder() }]}
              />
            ) : null}
          </>
        }
      />

      {verwijderFout ? <FoutMelding melding={verwijderFout} /> : null}

      <div className="detail-grid">
        <div>
          <Card style={{ marginBottom: "var(--s-6)" }}>
            <div className="event-row__meta">
              <span>{formatDate(evenement.datum)}</span>
              <BrandBadge merk={evenement.merk} />
              <StatusKiezer evenement={evenement} />
              {evenement.opdrachtgever ? <span>Opdrachtgever: {evenement.opdrachtgever}</span> : null}
            </div>
          </Card>

          <div className="section-title">
            <h3>Geboekte producten</h3>
            <div className="button-row no-print">
              <Button variant="ghost-dark" icon="plus" iconPosition="leading" onClick={() => setModal("uitgifte")}>
                Product boeken
              </Button>
              <Button variant="ghost-dark" icon="arrow-left" iconPosition="leading" onClick={() => setModal("retour")}>
                Retour boeken
              </Button>
            </div>
          </div>
          <Card>
            <BookingTable mutaties={mutaties} producten={state.producten} />
          </Card>

          <div className="section-title" style={{ marginTop: "var(--s-7)" }}>
            <h3>Pakbonnen</h3>
            {magPakbon ? (
              <div className="button-row no-print">
                <Button
                  variant="ghost-dark"
                  icon="plus"
                  iconPosition="leading"
                  onClick={() => navigate(ROUTES.pakbonNieuw(evenement.id))}
                >
                  Pakbon maken
                </Button>
              </div>
            ) : null}
          </div>
          <Card>
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
                    </RouterLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="section-title" style={{ marginTop: "var(--s-7)" }}>
            <h3>Historie</h3>
          </div>
          <Card>
            <MutatieTabel
              mutaties={mutaties}
              producten={state.producten}
              locaties={state.locaties}
              profielen={state.profielen}
              legeMelding="Nog geen mutaties voor dit evenement."
            />
          </Card>
        </div>

        <div>
          <Card style={{ marginBottom: "var(--s-6)" }}>
            <OmzetInput
              value={evenement.omzet}
              onSave={(omzet) => void wijzigEvenement(evenement.id, { omzet })}
            />
          </Card>
          <Card>
            <MargeSummary marge={marge} />
          </Card>

        </div>
      </div>

      <BookingModal
        open={modal !== null}
        onClose={() => setModal(null)}
        evenementId={evenement.id}
        richting={modal ?? "uitgifte"}
        producten={state.producten}
      />
    </>
  );
}
