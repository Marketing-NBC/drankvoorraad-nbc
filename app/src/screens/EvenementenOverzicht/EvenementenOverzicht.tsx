import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import { berekenMarge } from "../../data/calculations";
import type { Evenement } from "../../data/types";
import { exporteerNaarExcel } from "../../utils/excel";

import { EventFilters, type EventFiltersValue } from "./EventFilters";
import { EventRow } from "./EventRow";
import { NewEventModal } from "./NewEventModal";

const maandNotatie = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

export function EvenementenOverzicht() {
  const { state, laden, fout, herlaad, mutatiesPerEvenement } = useAppState();
  const { mag } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EventFiltersValue>({ zoek: "", merk: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [exporteert, setExporteert] = useState(false);

  const magEvenementenBeheren = mag("beheerder", "evenementmanager");

  const evenementen = useMemo(() => {
    return state.evenementen
      .filter((e) => (filters.merk ? e.merk === filters.merk : true))
      .filter((e) => (filters.status ? e.status === filters.status : true))
      .filter((e) => e.naam.toLowerCase().includes(filters.zoek.toLowerCase()))
      .sort((a, b) => a.datum.localeCompare(b.datum));
  }, [state.evenementen, filters]);

  const lopend = evenementen.filter((e) => e.status !== "Afgerond").length;
  const afgerond = evenementen.length - lopend;
  const maand = maandNotatie.format(new Date());

  async function exporteer() {
    setExporteert(true);
    try {
      await exporteerNaarExcel<Evenement>({
        bestandsnaam: `evenementen-${new Date().toISOString().slice(0, 10)}`,
        titel: "Evenementen",
        ondertitel: `${evenementen.length} evenementen · gesorteerd op datum`,
        rijen: evenementen,
        kolommen: [
          { header: "Evenement", value: (e) => e.naam },
          { header: "Evenementnummer", value: (e) => e.id },
          { header: "Datum", opmaak: "datum", value: (e) => new Date(e.datum) },
          { header: "Merk", value: (e) => e.merk },
          { header: "Status", value: (e) => e.status },
          { header: "Opdrachtgever", value: (e) => e.opdrachtgever ?? "" },
          { header: "Omzet", opmaak: "bedrag", value: (e) => e.omzet },
          {
            header: "Brutowinst",
            opmaak: "bedrag",
            value: (e) =>
              berekenMarge(e.omzet, mutatiesPerEvenement.get(e.id) ?? [], state.producten).brutowinst,
          },
          {
            header: "Brutomarge",
            value: (e) => {
              const marge = berekenMarge(e.omzet, mutatiesPerEvenement.get(e.id) ?? [], state.producten);
              return marge.brutomarge === null ? "" : `${Math.round(marge.brutomarge)}%`;
            },
          },
        ],
      });
    } finally {
      setExporteert(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="welkom bij nbc & green village"
        title="Evenementen"
        toelichting="Alles wat er dit seizoen staat, gesorteerd op datum. De marge staat op de rij, zodat je niet hoeft te openen om te zien of het klopt."
        actions={
          <>
            {magEvenementenBeheren ? (
              <Button icon="plus" iconPosition="leading" onClick={() => setModalOpen(true)}>
                Nieuw evenement
              </Button>
            ) : null}
            <Button
              variant="ghost-dark"
              icon={null}
              onClick={() => void exporteer()}
              disabled={evenementen.length === 0 || exporteert}
            >
              {exporteert ? "Bezig…" : "Exporteren (Excel)"}
            </Button>
          </>
        }
      />

      <EventFilters value={filters} onChange={setFilters} />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}

      {laden ? (
        <p className="app-laden">Bezig met laden…</p>
      ) : evenementen.length === 0 ? (
        <EmptyState
          title="Geen evenementen gevonden"
          body="Pas je filters aan of maak een nieuw evenement aan."
        />
      ) : (
        <Card>
          <KaartKop
            titel={`${evenementen.length} ${evenementen.length === 1 ? "evenement" : "evenementen"}`}
            sub={`${maand} · gesorteerd op datum`}
            rechts={
              <>
                {lopend > 0 ? <Badge>{lopend} actief of gepland</Badge> : null}
                {afgerond > 0 ? <Badge variant="success">{afgerond} afgerond</Badge> : null}
              </>
            }
          />
          <div className="lijst">
            {evenementen.map((evenement) => (
              <EventRow
                key={evenement.id}
                evenement={evenement}
                mutaties={mutatiesPerEvenement.get(evenement.id) ?? []}
                producten={state.producten}
              />
            ))}
          </div>
        </Card>
      )}

      <NewEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => {
          setModalOpen(false);
          navigate(`/evenementen/${encodeURIComponent(id)}`);
        }}
      />
    </>
  );
}
