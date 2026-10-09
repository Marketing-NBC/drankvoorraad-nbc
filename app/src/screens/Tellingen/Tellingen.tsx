import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
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

  const magTellen = mag("beheerder", "medewerker", "housekeeping");
  /* Housekeeping telt alleen de kantine en de kroeg (026). */
  const telbareLocaties = mag("housekeeping") ? state.locaties.filter((l) => l.voorPersoneel) : state.locaties;
  const zichtbareTellingen = mag("housekeeping")
    ? state.tellingen.filter((t) => telbareLocaties.some((l) => l.id === t.locatieId))
    : state.tellingen;
  const lopend = zichtbareTellingen.filter((t) => t.status === "open").length;
  const locatieNaam = new Map(state.locaties.map((l) => [l.id, l.naam]));
  const gebruikerNaam = new Map(state.profielen.map((p) => [p.id, p.naam]));

  async function start() {
    const gekozen = locatieId || telbareLocaties[0]?.id;
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
        toelichting="Tel een locatie door de producten te scannen of de aantallen in te typen. Bij het afronden worden de verschillen automatisch geboekt, zodat de voorraad klopt met wat er werkelijk staat. In de kantine en de kroeg is een tekort geen verschil maar personeelsverbruik — daar is de telling dus de meting."
        actions={
          magTellen ? (
            <Button
              icon="plus"
              iconPosition="leading"
              onClick={() => {
                setLocatieId(telbareLocaties[0]?.id ?? "");
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

      {zichtbareTellingen.length === 0 ? (
        <EmptyState
          title="Nog geen tellingen"
          body="Start een telling om de voorraad van een locatie te controleren."
        />
      ) : (
        <Card>
          <KaartKop
            titel={`${zichtbareTellingen.length} ${zichtbareTellingen.length === 1 ? "telling" : "tellingen"}`}
            sub="nieuwste eerst"
            rechts={
              lopend > 0 ? <Badge>{lopend} {lopend === 1 ? "loopt" : "lopen"} nog</Badge> : null
            }
          />
          <div className="lijst">
            {zichtbareTellingen.map((telling) => (
              <RouterLink key={telling.id} className="event-rij" to={ROUTES.tellingDetail(telling.id)}>
                <span className="event-rij__main">
                  <span className="event-rij__titel">
                    {locatieNaam.get(telling.locatieId) ?? "Onbekende locatie"}
                  </span>
                  <span className="event-rij__meta">
                    {formatDateTime(telling.aangemaaktOp)}
                    <span>door {gebruikerNaam.get(telling.gebruikerId) ?? "onbekend"}</span>
                    <Badge variant={telling.status === "open" ? "tint" : "success"}>
                      {telling.status === "open" ? "Bezig" : "Afgerond"}
                    </Badge>
                  </span>
                </span>
                <span className="event-rij__openen" aria-hidden="true">Openen</span>
              </RouterLink>
            ))}
          </div>
        </Card>
      )}

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Nieuwe telling">
        <div className="product-form">
          <p className="modal-toelichting">
            Kies de locatie die je gaat tellen. De app maakt een lijst met alle producten en de
            verwachte aantallen.
          </p>
          {telbareLocaties.find((l) => l.id === (locatieId || telbareLocaties[0]?.id))?.voorPersoneel ? (
            <p className="melding-waarschuwing">
              Dit is een locatie voor personeel. Wat er minder staat dan verwacht wordt geboekt als
              personeelsverbruik, niet als telverschil.
            </p>
          ) : null}
          <div className="field-group">
            <span className="field-group__label">Locatie</span>
            <Select
              aria-label="Locatie"
              value={locatieId}
              onChange={(e) => setLocatieId(e.target.value)}
              options={telbareLocaties.map((l) => ({
                value: l.id,
                label: l.voorPersoneel ? `${l.naam} (personeel)` : l.naam,
              }))}
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
