import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import { formatDateTime } from "../../utils/format";
import { foutBericht } from "../../utils/fouten";
import { ROUTES } from "../../routes/routes";

export function Tellingen() {
  const { state, laden, fout, herlaad, startTelling } = useAppState();
  const { mag } = useAuth();
  const navigate = useNavigate();
  const routeState = useLocation().state as { melding?: string } | null;

  const [startOpen, setStartOpen] = useState(false);
  const [locatieId, setLocatieId] = useState("");
  const [startFout, setStartFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const magTellen = mag("beheerder", "magazijnmedewerker");
  const locatieNaam = new Map(state.locaties.map((l) => [l.id, l.naam]));
  const gebruikerNaam = new Map(state.profielen.map((p) => [p.id, p.naam]));

  async function start() {
    const gekozen = locatieId || state.locaties[0]?.id;
    if (!gekozen) return;
    setBezig(true);
    setStartFout(null);
    try {
      const id = await startTelling(gekozen);
      navigate(ROUTES.tellingDetail(id));
    } catch (err) {
      const bericht = foutBericht(err);
      setStartFout(
        bericht.includes("loopt al")
          ? "Er loopt al een telling voor deze locatie. Rond die eerst af."
          : "De telling kon niet gestart worden. Probeer het opnieuw."
      );
      setBezig(false);
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="inventarisatie"
        title="Tellingen"
        actions={
          magTellen ? (
            <Button
              icon="plus"
              iconPosition="leading"
              onClick={() => {
                setLocatieId(state.locaties[0]?.id ?? "");
                setStartFout(null);
                setStartOpen(true);
              }}
            >
              Nieuwe telling
            </Button>
          ) : null
        }
      />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {routeState?.melding ? <p className="melding-goed">{routeState.melding}</p> : null}

      <p className="scherm-toelichting">
        Tel een locatie door de producten te scannen of de aantallen in te typen. Bij het afronden
        worden de verschillen automatisch als correctie geboekt, zodat de voorraad klopt met wat er
        werkelijk staat.
      </p>

      {state.tellingen.length === 0 ? (
        <EmptyState
          title="Nog geen tellingen"
          body="Start een telling om de voorraad van een locatie te controleren."
        />
      ) : (
        <div className="event-list">
          {state.tellingen.map((telling) => (
            <RouterLink
              key={telling.id}
              to={ROUTES.tellingDetail(telling.id)}
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <Card hover>
                <div className="event-row">
                  <div className="event-row__main">
                    <span className="event-row__title">{locatieNaam.get(telling.locatieId) ?? "Onbekende locatie"}</span>
                    <span className="event-row__meta">
                      <span>{formatDateTime(telling.aangemaaktOp)}</span>
                      <span>door {gebruikerNaam.get(telling.gebruikerId) ?? "onbekend"}</span>
                    </span>
                  </div>
                  <div className="event-row__marge">
                    <Badge variant={telling.status === "open" ? "tint" : "success"}>
                      {telling.status === "open" ? "Bezig" : "Afgerond"}
                    </Badge>
                  </div>
                </div>
              </Card>
            </RouterLink>
          ))}
        </div>
      )}

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Nieuwe telling">
        <div className="product-form">
          <p className="modal-toelichting">
            Kies de locatie die je gaat tellen. De app maakt een lijst met alle producten en de
            verwachte aantallen.
          </p>
          <div className="field-group">
            <span className="field-group__label">Locatie</span>
            <Select
              aria-label="Locatie"
              value={locatieId}
              onChange={(e) => setLocatieId(e.target.value)}
              options={state.locaties.map((l) => ({ value: l.id, label: l.naam }))}
            />
          </div>
          {startFout ? <p className="form-error">{startFout}</p> : null}
          <div className="modal-actions">
            <Button type="button" variant="ghost-dark" icon={null} onClick={() => setStartOpen(false)}>
              Annuleren
            </Button>
            <Button type="button" icon={null} onClick={() => void start()} disabled={bezig}>
              {bezig ? "Bezig…" : "Telling starten"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
