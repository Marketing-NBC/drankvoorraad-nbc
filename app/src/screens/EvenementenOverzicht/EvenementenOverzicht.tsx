import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import { EventFilters, type EventFiltersValue } from "./EventFilters";
import { EventRow } from "./EventRow";
import { NewEventModal } from "./NewEventModal";

export function EvenementenOverzicht() {
  const { state, laden, fout, herlaad, mutatiesPerEvenement } = useAppState();
  const { mag } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EventFiltersValue>({ zoek: "", merk: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);

  const magEvenementenBeheren = mag("beheerder", "evenementmanager");

  const evenementen = useMemo(() => {
    return state.evenementen
      .filter((e) => (filters.merk ? e.merk === filters.merk : true))
      .filter((e) => (filters.status ? e.status === filters.status : true))
      .filter((e) => e.naam.toLowerCase().includes(filters.zoek.toLowerCase()))
      .sort((a, b) => a.datum.localeCompare(b.datum));
  }, [state.evenementen, filters]);

  return (
    <>
      <PageHeader
        eyebrow="welkom bij nbc & green village"
        title="Evenementen"
        actions={
          magEvenementenBeheren ? (
            <Button icon="plus" iconPosition="leading" onClick={() => setModalOpen(true)}>
              Nieuw evenement
            </Button>
          ) : null
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
        <div className="event-list">
          {evenementen.map((evenement) => (
            <EventRow
              key={evenement.id}
              evenement={evenement}
              mutaties={mutatiesPerEvenement.get(evenement.id) ?? []}
              producten={state.producten}
            />
          ))}
        </div>
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
